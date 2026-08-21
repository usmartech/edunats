/* ------------------------------------------------------------------ *
 * Storage-agnostic data layer.
 *
 * Feature code talks to `db` (a DataProvider) and `files` (an
 * ObjectStorage). Nothing imports localStorage directly. Swapping to OCI
 * (Autonomous DB / NoSQL + Object Storage) means writing one adapter that
 * satisfies the contracts in `./types` and calling
 * `configureData({ db, files })` at bootstrap — zero feature changes.
 * ------------------------------------------------------------------ */

import type {
  AdapterCapabilities,
  DataProvider,
  Entity,
  Filter,
  Id,
  IndexSpec,
  ObjectStorage,
  PageResult,
  Query,
  SortSpec,
} from "./types";

export type {
  AdapterCapabilities,
  DataProvider,
  Entity,
  Filter,
  FilterOp,
  FileStore,
  Id,
  IndexSpec,
  ObjectStorage,
  Page,
  PageResult,
  Query,
  SortSpec,
} from "./types";

/* --------------------------- helpers ------------------------------- */

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

export function encodeCursor(offset: number): string {
  return `o:${offset}`;
}

export function decodeCursor(cursor?: string | null): number {
  if (!cursor) return 0;
  const n = Number(cursor.replace(/^o:/, ""));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Normalise `where` shorthand + rich filters into one predicate list. */
export function toFilters<T>(query?: Query<T>): Filter[] {
  const out: Filter[] = [];
  for (const [field, value] of Object.entries(query?.where ?? {})) {
    if (value === undefined || value === "") continue;
    out.push({ field, op: "eq", value });
  }
  for (const f of query?.filters ?? []) out.push(f);
  return out;
}

function matches(row: Record<string, unknown>, f: Filter): boolean {
  const v = row[f.field];
  switch (f.op) {
    case "eq":
      return v === f.value;
    case "ne":
      return v !== f.value;
    case "in":
      return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
    case "gt":
      return (v as never) > (f.value as never);
    case "gte":
      return (v as never) >= (f.value as never);
    case "lt":
      return (v as never) < (f.value as never);
    case "lte":
      return (v as never) <= (f.value as never);
    case "contains":
      return String(v ?? "").toLowerCase().includes(String(f.value ?? "").toLowerCase());
    case "startsWith":
      return String(v ?? "").toLowerCase().startsWith(String(f.value ?? "").toLowerCase());
    default:
      return true;
  }
}

function sortRows<T extends Entity>(rows: T[], orderBy?: SortSpec | SortSpec[]): T[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  if (!specs.length) return rows;
  return [...rows].sort((a, b) => {
    for (const { field, dir = "asc" } of specs) {
      const av = (a as Record<string, unknown>)[field];
      const bv = (b as Record<string, unknown>)[field];
      const cmp = String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true });
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  });
}

function project<T extends Entity>(rows: T[], select?: Query<T>["select"]): T[] {
  if (!select?.length) return rows;
  const keys = ["id", "createdAt", "updatedAt", ...select.map(String)];
  return rows.map((r) => {
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = (r as Record<string, unknown>)[k];
    return out as T;
  });
}

/* ------------------- adapter: browser localStorage ------------------ */

const memory = new Map<string, unknown[]>();
/** Bumped on every write so cached indexes invalidate. */
const versions = new Map<string, number>();
const indexSpecs = new Map<string, string[][]>();
type IndexCache = { version: number; maps: Map<string, Map<string, Entity[]>> };
const indexCache = new Map<string, IndexCache>();

const bump = (collection: string) => versions.set(collection, (versions.get(collection) ?? 0) + 1);

function readRaw<T>(collection: string): T[] {
  if (typeof window === "undefined") return (memory.get(collection) as T[]) ?? [];
  try {
    return JSON.parse(window.localStorage.getItem(`ns:${collection}`) || "[]") as T[];
  } catch {
    return [];
  }
}

function writeRaw<T>(collection: string, rows: T[]) {
  bump(collection);
  if (typeof window === "undefined") {
    memory.set(collection, rows as unknown[]);
    return;
  }
  window.localStorage.setItem(`ns:${collection}`, JSON.stringify(rows));
}

const keyOf = (row: Record<string, unknown>, fields: string[]) => fields.map((f) => String(row[f] ?? "")).join("\u0000");

/**
 * Indexed lookup: when the query's equality filters cover a registered
 * index prefix, read the candidate set from a cached hash index instead of
 * scanning the collection. Mirrors what a SQL adapter gets from a
 * composite B-tree index on the same fields.
 */
function candidates<T extends Entity>(collection: string, filters: Filter[]): { rows: T[]; used: Filter[] } {
  const all = readRaw<T>(collection);
  const specs = indexSpecs.get(collection);
  if (!specs?.length) return { rows: all, used: [] };

  const eq = new Map(filters.filter((f) => f.op === "eq").map((f) => [f.field, f]));
  const spec = specs.find((fields) => fields.every((f) => eq.has(f)));
  if (!spec) return { rows: all, used: [] };

  const version = versions.get(collection) ?? 0;
  let cache = indexCache.get(collection);
  if (!cache || cache.version !== version) {
    cache = { version, maps: new Map() };
    indexCache.set(collection, cache);
  }
  const name = spec.join(",");
  let map = cache.maps.get(name);
  if (!map) {
    map = new Map();
    for (const row of all as Entity[]) {
      const k = keyOf(row, spec);
      const bucket = map.get(k);
      if (bucket) bucket.push(row);
      else map.set(k, [row]);
    }
    cache.maps.set(name, map);
  }
  const lookup = keyOf(
    Object.fromEntries(spec.map((f) => [f, eq.get(f)!.value])) as Record<string, unknown>,
    spec,
  );
  return { rows: (map.get(lookup) ?? []) as T[], used: spec.map((f) => eq.get(f)!) };
}

function runQuery<T extends Entity>(collection: string, query?: Query<T>) {
  const filters = toFilters(query);
  const { rows, used } = candidates<T>(collection, filters);
  const remaining = filters.filter((f) => !used.includes(f));
  const filtered = remaining.length ? rows.filter((r) => remaining.every((f) => matches(r as never, f))) : rows;
  return sortRows(filtered, query?.orderBy);
}

const localCapabilities: AdapterCapabilities = {
  serverSidePagination: false,
  cursorPagination: true,
  rowLevelSecurity: false,
  transactions: false,
  fullTextSearch: false,
};

export const localDataProvider: DataProvider = {
  name: "local",
  capabilities: localCapabilities,

  async ensureIndexes(specs: IndexSpec[]) {
    for (const s of specs) {
      const list = indexSpecs.get(s.collection) ?? [];
      if (!list.some((f) => f.join(",") === s.fields.join(","))) list.push(s.fields);
      indexSpecs.set(s.collection, list);
    }
    indexCache.clear();
  },

  async list(collection, query) {
    const sorted = runQuery(collection, query);
    const offset = query?.offset ?? decodeCursor(query?.cursor);
    const sliced = query?.limit ? sorted.slice(offset, offset + query.limit) : sorted.slice(offset);
    return project(sliced, query?.select) as never;
  },

  async listPage<T extends Entity>(collection: string, query?: Query<T>): Promise<PageResult<T>> {
    const sorted = runQuery<T>(collection, query);
    const offset = query?.offset ?? decodeCursor(query?.cursor);
    const limit = query?.limit ?? 50;
    const rows = project(sorted.slice(offset, offset + limit), query?.select);
    const end = offset + rows.length;
    const hasMore = end < sorted.length;
    return {
      rows,
      hasMore,
      nextCursor: hasMore ? encodeCursor(end) : null,
      ...(query?.withTotal ? { total: sorted.length } : {}),
    };
  },

  async count(collection, query) {
    return runQuery(collection, { ...(query as object), limit: undefined, offset: undefined } as never).length;
  },

  async get(collection, id) {
    return (readRaw<Entity>(collection).find((r) => r.id === id) ?? null) as never;
  },

  async create(collection, data) {
    const now = new Date().toISOString();
    const row = { ...(data as object), id: newId(), createdAt: now, updatedAt: now } as Entity;
    const rows = readRaw<Entity>(collection);
    rows.push(row);
    writeRaw(collection, rows);
    return row as never;
  },

  async update(collection, id, patch) {
    const rows = readRaw<Entity>(collection);
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) throw new Error(`${collection}/${id} not found`);
    rows[i] = { ...rows[i]!, ...(patch as object), updatedAt: new Date().toISOString() } as Entity;
    writeRaw(collection, rows);
    return rows[i] as never;
  },

  async remove(collection, id) {
    writeRaw(
      collection,
      readRaw<Entity>(collection).filter((r) => r.id !== id),
    );
  },

  async bulkPut(collection, rows) {
    const existing = readRaw<Entity>(collection);
    const byId = new Map(existing.map((r) => [r.id, r]));
    for (const r of rows) byId.set(r.id, r as Entity);
    writeRaw(collection, [...byId.values()]);
  },
};

export const localFileStore: ObjectStorage = {
  name: "local",
  async put(path, blob) {
    return { url: URL.createObjectURL(blob) + `#${encodeURIComponent(path)}` };
  },
  async url(path) {
    return path;
  },
  async remove() {
    /* no-op in local mode */
  },
  async list() {
    return [];
  },
};

/* --------------------------- registry ------------------------------ */

let currentDb: DataProvider = localDataProvider;
let currentFiles: ObjectStorage = localFileStore;

/** Call once at bootstrap to swap in OCI (or Postgres, or any backend). */
export function configureData(next: { db?: DataProvider; files?: ObjectStorage }) {
  if (next.db) currentDb = next.db;
  if (next.files) currentFiles = next.files;
}

export const db: DataProvider = new Proxy({} as DataProvider, {
  get: (_t, prop) => {
    const value = (currentDb as unknown as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(currentDb) : value;
  },
});

export const files: ObjectStorage = new Proxy({} as ObjectStorage, {
  get: (_t, prop) => {
    const value = (currentFiles as unknown as Record<string, unknown>)[prop as string];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(currentFiles) : value;
  },
});

export const COLLECTIONS = {
  schools: "schools",
  levels: "education_levels",
  schoolTypes: "school_types",
  subjects: "subjects",
  staff: "staff",
  performances: "performances",
  schedules: "schedules",
  offers: "offers",
  settings: "settings",
  audit: "audit_logs",
} as const;

/**
 * Index plan. Tenant-scoped collections lead with `schoolId` so every
 * scoped read is index-covered; adapters translate these to composite
 * B-tree (SQL) or secondary (NoSQL) indexes.
 */
export const INDEXES: IndexSpec[] = [
  { collection: COLLECTIONS.staff, fields: ["schoolId"] },
  { collection: COLLECTIONS.staff, fields: ["schoolId", "department"] },
  { collection: COLLECTIONS.staff, fields: ["schoolId", "status"] },
  { collection: COLLECTIONS.performances, fields: ["schoolId"] },
  { collection: COLLECTIONS.performances, fields: ["schoolId", "staffId"] },
  { collection: COLLECTIONS.schedules, fields: ["schoolId"] },
  { collection: COLLECTIONS.schedules, fields: ["schoolId", "staffId"] },
  { collection: COLLECTIONS.offers, fields: ["schoolId"] },
  { collection: COLLECTIONS.offers, fields: ["schoolId", "status"] },
  { collection: COLLECTIONS.subjects, fields: ["schoolId", "levelId"] },
  { collection: COLLECTIONS.settings, fields: ["schoolId"] },
];

let indexesReady: Promise<void> | null = null;

/** Idempotent: safe to call from any module that needs indexed reads. */
export function ensureIndexes() {
  if (!indexesReady) indexesReady = currentDb.ensureIndexes?.(INDEXES) ?? Promise.resolve();
  return indexesReady;
}

void ensureIndexes();
