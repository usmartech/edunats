/* ------------------------------------------------------------------ *
 * Storage adapter contracts.
 *
 * These are the ONLY types a backend author needs to satisfy. Feature
 * code never imports an adapter — it imports `db` / `files` from
 * `provider.ts`, which resolve to whatever was registered at bootstrap.
 *
 * Implement `DataProvider` + `ObjectStorage` for OCI (Autonomous DB /
 * NoSQL + Object Storage), Postgres, or anything else, call
 * `configureData({ db, files })`, and nothing else changes.
 * ------------------------------------------------------------------ */

export type Id = string;

export type Entity = { id: Id; createdAt: string; updatedAt: string } & Record<string, unknown>;

/** Comparison operators an adapter must translate to its native dialect. */
export type FilterOp = "eq" | "ne" | "in" | "gt" | "gte" | "lt" | "lte" | "contains" | "startsWith";

export type Filter = { field: string; op: FilterOp; value: unknown };

export type SortSpec = { field: string; dir?: "asc" | "desc" };

/**
 * Cursor pagination is the scalable default (stable under inserts, no
 * OFFSET scan). `offset` remains for small admin tables and legacy calls.
 */
export type Page = { limit?: number; cursor?: string | null; offset?: number };

export type Query<T = Entity> = {
  /** Equality shorthand — merged into `filters` by adapters. */
  where?: Partial<Record<keyof T | "schoolId", unknown>>;
  /** Rich predicates for indexed range/prefix scans. */
  filters?: Filter[];
  orderBy?: SortSpec | SortSpec[];
  limit?: number;
  offset?: number;
  cursor?: string | null;
  /** Projection: adapters may fetch only these columns. */
  select?: (keyof T | string)[];
  /** Ask the adapter for a total row count alongside the page. */
  withTotal?: boolean;
};

export type PageResult<T> = {
  rows: T[];
  /** Opaque cursor for the next page; `null` when exhausted. */
  nextCursor: string | null;
  /** Present only when `withTotal` was requested and supported. */
  total?: number;
  hasMore: boolean;
};

/**
 * Declarative index hints. The local adapter builds in-memory maps from
 * these; a SQL adapter emits `CREATE INDEX`; a NoSQL adapter maps them to
 * secondary indexes. Tenant-scoped collections should always lead with
 * `schoolId` so every scoped read is index-covered.
 */
export type IndexSpec = { collection: string; fields: string[]; unique?: boolean };

export type AdapterCapabilities = {
  /** True when the store filters/sorts/paginates server-side. */
  serverSidePagination: boolean;
  cursorPagination: boolean;
  /** True when isolation is enforced by the database (RLS/VPD), not in-process. */
  rowLevelSecurity: boolean;
  transactions: boolean;
  fullTextSearch: boolean;
};

export interface DataProvider {
  readonly name: string;
  readonly capabilities: AdapterCapabilities;

  /** Register index hints; called once at bootstrap. */
  ensureIndexes?(specs: IndexSpec[]): Promise<void>;

  list<T extends Entity>(collection: string, query?: Query<T>): Promise<T[]>;
  /** Paginated read — preferred for any collection that can grow. */
  listPage<T extends Entity>(collection: string, query?: Query<T>): Promise<PageResult<T>>;
  count<T extends Entity>(collection: string, query?: Query<T>): Promise<number>;

  get<T extends Entity>(collection: string, id: Id): Promise<T | null>;
  create<T extends Entity>(collection: string, data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T>;
  update<T extends Entity>(collection: string, id: Id, patch: Partial<T>): Promise<T>;
  remove(collection: string, id: Id): Promise<void>;
  bulkPut<T extends Entity>(collection: string, rows: T[]): Promise<void>;

  /** Optional atomic unit of work; callers must tolerate its absence. */
  transaction?<T>(fn: () => Promise<T>): Promise<T>;
}

export interface ObjectStorage {
  readonly name: string;
  put(path: string, blob: Blob, opts?: { contentType?: string; public?: boolean }): Promise<{ url: string }>;
  url(path: string, opts?: { expiresInSeconds?: number }): Promise<string>;
  remove(path: string): Promise<void>;
  list?(prefix: string): Promise<string[]>;
}

/** Back-compat alias — earlier code referred to the file adapter as FileStore. */
export type FileStore = ObjectStorage;
