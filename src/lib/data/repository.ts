/* ------------------------------------------------------------------ *
 * Scoped repositories — the only API feature code should use.
 *
 * Guarantees, enforced here regardless of which DataProvider is active:
 *   1. Reads are always filtered by the active tenant.
 *   2. Writes always stamp the active tenant; a caller-supplied schoolId
 *      that differs is rejected.
 *   3. Update/delete re-read the row and verify ownership before acting
 *      (defence in depth for stores without server-side RLS).
 *
 * Swapping to OCI means implementing DataProvider once. Feature modules
 * (`staff.ts`, future students/attendance/fees) are untouched, because
 * they only ever see this interface.
 * ------------------------------------------------------------------ */

import { db, ensureIndexes, type Entity, type Id, type PageResult, type Query } from "./provider";
import {
  TENANT_KEY,
  TenantIsolationError,
  getTenantContext,
  requireSchoolId,
  type TenantContext,
} from "./tenant";

export type ScopeOptions = {
  /** Rows with schoolId === null are shared platform templates (e.g. subject catalogue). */
  includeGlobal?: boolean;
};

export type TenantScopedInput<T extends Entity> = Omit<T, keyof Entity | "schoolId"> &
  Partial<Record<"schoolId", string>>;

export interface Repository<T extends Entity> {
  readonly collection: string;
  list(query?: Query<T>, opts?: ScopeOptions): Promise<T[]>;
  /**
   * Paginated read — the default for anything that can grow. Pass the
   * returned `nextCursor` back in to fetch the next page; the adapter
   * decides whether that is a keyset scan (SQL/OCI) or an offset slice.
   */
  listPage(query?: Query<T>): Promise<PageResult<T>>;
  /** Async iterator over every page — for exports and background jobs. */
  iterate(query?: Query<T>, pageSize?: number): AsyncGenerator<T[], void, unknown>;
  get(id: Id): Promise<T | null>;
  create(data: TenantScopedInput<T>): Promise<T>;
  update(id: Id, patch: Partial<T>): Promise<T>;
  remove(id: Id): Promise<void>;
  count(query?: Query<T>): Promise<number>;
}

/** Scoped query: tenant predicate first so it matches the leading index column. */
function scopedQuery<T extends Entity>(query: Query<T> | undefined, schoolId: string | null): Query<T> {
  return {
    ...query,
    where: { [TENANT_KEY]: schoolId, ...(query?.where ?? {}) } as never,
  };
}


function assertOwned<T extends Entity>(collection: string, row: T | null, ctx: TenantContext, id: Id): T {
  if (!row) throw new TenantIsolationError(collection, id);
  const owner = (row as Record<string, unknown>)[TENANT_KEY];
  if (ctx.crossTenant) return row;
  if (owner !== ctx.schoolId) throw new TenantIsolationError(collection, id);
  return row;
}

/** Tenant-scoped repository. Every call resolves the tenant at call time. */
export function createRepository<T extends Entity>(collection: string): Repository<T> {
  return {
    collection,

    async list(query, opts) {
      await ensureIndexes();
      const ctx = getTenantContext();
      if (ctx.crossTenant && !query?.where?.[TENANT_KEY]) {
        return db.list<T>(collection, query);
      }
      if (!ctx.schoolId) return [];
      const rows = await db.list<T>(collection, scopedQuery(query, ctx.schoolId));
      if (!opts?.includeGlobal) return rows;
      const globals = await db.list<T>(collection, scopedQuery(query, null));
      return [...globals, ...rows];
    },

    async listPage(query) {
      await ensureIndexes();
      const ctx = getTenantContext();
      const empty: PageResult<T> = { rows: [], nextCursor: null, hasMore: false, total: 0 };
      if (ctx.crossTenant && !query?.where?.[TENANT_KEY]) {
        return db.listPage<T>(collection, query);
      }
      if (!ctx.schoolId) return empty;
      return db.listPage<T>(collection, scopedQuery(query, ctx.schoolId));
    },

    async *iterate(query, pageSize = 200) {
      let cursor: string | null | undefined = query?.cursor ?? null;
      for (;;) {
        const page: PageResult<T> = await this.listPage({ ...query, limit: pageSize, cursor });
        if (page.rows.length) yield page.rows;
        if (!page.hasMore || !page.nextCursor) return;
        cursor = page.nextCursor;
      }
    },


    async get(id) {
      const ctx = getTenantContext();
      const row = await db.get<T>(collection, id);
      if (!row) return null;
      const owner = (row as Record<string, unknown>)[TENANT_KEY];
      if (ctx.crossTenant || owner === ctx.schoolId || owner == null) return row;
      return null; // isolation: an out-of-tenant row simply does not exist
    },

    async create(data) {
      const schoolId = requireSchoolId();
      const supplied = (data as Record<string, unknown>)[TENANT_KEY];
      if (supplied != null && supplied !== schoolId) throw new TenantIsolationError(collection);
      return db.create<T>(collection, { ...(data as object), [TENANT_KEY]: schoolId } as never);
    },

    async update(id, patch) {
      const ctx = getTenantContext();
      assertOwned(collection, await db.get<T>(collection, id), ctx, id);
      const { [TENANT_KEY]: _ignored, ...safe } = patch as Record<string, unknown>;
      return db.update<T>(collection, id, safe as Partial<T>);
    },

    async remove(id) {
      const ctx = getTenantContext();
      assertOwned(collection, await db.get<T>(collection, id), ctx, id);
      await db.remove(collection, id);
    },

    /** Delegates to the adapter so SQL backends issue a COUNT(*), not a fetch-all. */
    async count(query) {
      await ensureIndexes();
      const ctx = getTenantContext();
      if (ctx.crossTenant && !query?.where?.[TENANT_KEY]) return db.count<T>(collection, query);
      if (!ctx.schoolId) return 0;
      return db.count<T>(collection, scopedQuery(query, ctx.schoolId));
    },
  };
}

/**
 * Platform-level (non tenant-scoped) collections: schools, education
 * levels, school types. Reserved for super-admin control-plane code.
 */
export function createGlobalRepository<T extends Entity>(collection: string) {
  return {
    collection,
    list: (query?: Query<T>) => db.list<T>(collection, query),
    listPage: (query?: Query<T>) => db.listPage<T>(collection, query),
    count: (query?: Query<T>) => db.count<T>(collection, query),
    get: (id: Id) => db.get<T>(collection, id),
    create: (data: Omit<T, keyof Entity>) => db.create<T>(collection, data as never),
    update: (id: Id, patch: Partial<T>) => db.update<T>(collection, id, patch),
    remove: (id: Id) => db.remove(collection, id),
  };
}

