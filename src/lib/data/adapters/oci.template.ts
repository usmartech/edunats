/* ------------------------------------------------------------------ *
 * OCI adapter template (not wired up).
 *
 * This is the ONLY file that needs to be written when the backend moves
 * to Oracle Cloud Infrastructure. Implement DataProvider + FileStore,
 * then at bootstrap:
 *
 *   configureData({ db: ociDataProvider, files: ociObjectStorage });
 *
 * Feature modules keep importing the scoped repositories and never
 * change. Isolation is enforced twice: in `repository.ts` (process-side)
 * and — once this adapter exists — in the database itself via VPD/RLS,
 * so a bug in app code cannot leak rows across schools.
 *
 * Recommended server-side policy (Autonomous DB):
 *
 *   -- every tenant table carries school_id NOT NULL
 *   CREATE INDEX ix_staff_school ON staff (school_id, created_at DESC);
 *
 *   -- VPD predicate function returns: school_id = SYS_CONTEXT('app_ctx','school_id')
 *   BEGIN
 *     DBMS_RLS.ADD_POLICY(
 *       object_schema   => 'APP',
 *       object_name     => 'STAFF',
 *       policy_name     => 'STAFF_TENANT',
 *       function_schema => 'APP',
 *       policy_function => 'TENANT_PREDICATE',
 *       statement_types => 'SELECT,INSERT,UPDATE,DELETE');
 *   END;
 *
 * The adapter sets app_ctx.school_id from the request's TenantContext on
 * every connection checkout, so the DB rejects cross-tenant access even
 * for hand-written queries.
 * ------------------------------------------------------------------ */

import type {
  DataProvider,
  Entity,
  Id,
  IndexSpec,
  ObjectStorage,
  PageResult,
  Query,
  SortSpec,
} from "../types";
import { getTenantContext } from "../tenant";

/** Shape of the HTTP surface the adapter talks to (API Gateway -> Functions). */
type ApiCall = <R>(path: string, init?: RequestInit) => Promise<R>;

export function createOciDataProvider(call: ApiCall): DataProvider {
  const withTenantHeaders = (init?: RequestInit): RequestInit => {
    const { schoolId, userId } = getTenantContext();
    const headers = new Headers(init?.headers);
    if (schoolId) headers.set("x-tenant-id", schoolId);
    if (userId) headers.set("x-actor-id", userId);
    return { ...init, headers };
  };

  return {
    name: "oci",
    capabilities: {
      serverSidePagination: true,
      cursorPagination: true,
      rowLevelSecurity: true,
      transactions: true,
      fullTextSearch: true,
    },
    async ensureIndexes(specs: IndexSpec[]) {
      // Migrations own DDL in production; this is a no-op safety net.
      await call<void>(`/admin/indexes`, { method: "POST", body: JSON.stringify(specs) }).catch(() => undefined);
    },
    async list<T extends Entity>(collection: string, query?: Query<T>) {
      return call<T[]>(`/${collection}${encodeQuery(query)}`, withTenantHeaders());
    },
    async listPage<T extends Entity>(collection: string, query?: Query<T>) {
      // Server returns { rows, nextCursor, total? } — keyset pagination on
      // (school_id, created_at, id), which stays O(limit) at any depth.
      return call<PageResult<T>>(`/${collection}/page${encodeQuery(query)}`, withTenantHeaders());
    },
    async count<T extends Entity>(collection: string, query?: Query<T>) {
      const { total } = await call<{ total: number }>(
        `/${collection}/count${encodeQuery(query)}`,
        withTenantHeaders(),
      );
      return total;
    },
    async get<T extends Entity>(collection: string, id: Id) {
      return call<T | null>(`/${collection}/${id}`, withTenantHeaders());
    },
    async create<T extends Entity>(collection: string, data: unknown) {
      return call<T>(`/${collection}`, withTenantHeaders({ method: "POST", body: JSON.stringify(data) }));
    },
    async update<T extends Entity>(collection: string, id: Id, patch: unknown) {
      return call<T>(`/${collection}/${id}`, withTenantHeaders({ method: "PATCH", body: JSON.stringify(patch) }));
    },
    async remove(collection: string, id: Id) {
      await call<void>(`/${collection}/${id}`, withTenantHeaders({ method: "DELETE" }));
    },
    async bulkPut(collection: string, rows: unknown[]) {
      await call<void>(`/${collection}:bulk`, withTenantHeaders({ method: "PUT", body: JSON.stringify(rows) }));
    },
  } as DataProvider;
}

export function createOciObjectStorage(call: ApiCall): ObjectStorage {
  return {
    name: "oci-object-storage",
    async put(path, blob) {
      // Pre-authenticated request (PAR) issued server-side, scoped to /<tenant>/<path>
      const { url, uploadUrl } = await call<{ url: string; uploadUrl: string }>(
        `/storage/par?path=${encodeURIComponent(path)}`,
        { method: "POST" },
      );
      await fetch(uploadUrl, { method: "PUT", body: blob });
      return { url };
    },
    async url(path) {
      return (await call<{ url: string }>(`/storage/par?path=${encodeURIComponent(path)}`)).url;
    },
    async remove(path) {
      await call<void>(`/storage?path=${encodeURIComponent(path)}`, { method: "DELETE" });
    },
    async list(prefix) {
      return call<string[]>(`/storage/list?prefix=${encodeURIComponent(prefix)}`);
    },
  };
}

function encodeQuery(query?: Query<never>): string {
  if (!query) return "";
  const params = new URLSearchParams();
  if (query.where) params.set("where", JSON.stringify(query.where));
  if (query.filters?.length) params.set("filters", JSON.stringify(query.filters));
  if (query.orderBy) {
    const specs: SortSpec[] = Array.isArray(query.orderBy) ? query.orderBy : [query.orderBy];
    params.set("orderBy", specs.map((s) => `${String(s.field)}:${s.dir ?? "asc"}`).join(","));
  }
  if (query.select?.length) params.set("select", query.select.map(String).join(","));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.withTotal) params.set("withTotal", "1");
  const s = params.toString();
  return s ? `?${s}` : "";
}

