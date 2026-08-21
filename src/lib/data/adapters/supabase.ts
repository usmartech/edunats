/* ------------------------------------------------------------------ *
 * Centralized cloud adapter.
 *
 * Implements the DataProvider contract against the national database:
 *   schools           -> public.schools          (platform registry)
 *   education_levels  -> public.education_levels (national catalogue)
 *   school_types      -> public.school_types     (national catalogue)
 *   settings          -> public.school_settings  (one config row per school)
 *   everything else   -> public.records          (per-school document store)
 *
 * Row-level security in the database — not this file — is the real
 * isolation boundary: a school only ever sees its own rows, platform
 * admins see the whole nation. Feature code is unchanged; it still talks
 * to `db` / repositories.
 * ------------------------------------------------------------------ */

import { supabase } from "@/integrations/supabase/client";
import type {
  AdapterCapabilities,
  DataProvider,
  Entity,
  Filter,
  Id,
  PageResult,
  Query,
  SortSpec,
} from "../types";
import { decodeCursor, encodeCursor, toFilters } from "../provider";

/* ------------------------- table routing --------------------------- */

type Mapping =
  | { kind: "table"; table: "schools" | "education_levels" | "school_types" }
  | { kind: "settings" }
  | { kind: "record" };

function mapping(collection: string): Mapping {
  switch (collection) {
    case "schools":
      return { kind: "table", table: "schools" };
    case "education_levels":
      return { kind: "table", table: "education_levels" };
    case "school_types":
      return { kind: "table", table: "school_types" };
    case "settings":
      return { kind: "settings" };
    default:
      return { kind: "record" };
  }
}

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (key: string) => key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

const RESERVED = new Set(["id", "createdAt", "updatedAt", "schoolId", "collection"]);

function rowToEntity(row: Record<string, unknown>): Entity {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[camel(k)] = v;
  return out as Entity;
}

function entityFromRecord(row: Record<string, unknown>): Entity {
  const data = (row["data"] ?? {}) as Record<string, unknown>;
  return {
    ...data,
    id: row["id"] as string,
    schoolId: (row["school_id"] ?? null) as string | null,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  } as Entity;
}

function entityFromSettings(row: Record<string, unknown>): Entity {
  const settings = (row["settings"] ?? {}) as Record<string, unknown>;
  return {
    ...settings,
    id: row["id"] as string,
    schoolId: row["school_id"] as string,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  } as Entity;
}

/** Split an entity payload into (columns, jsonb payload) for `records`. */
function splitRecordPayload(data: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (RESERVED.has(k)) continue;
    payload[k] = v;
  }
  return { schoolId: (data["schoolId"] ?? null) as string | null, payload };
}

function columnFor(map: Mapping, field: string): string {
  if (field === "id") return "id";
  if (field === "createdAt") return "created_at";
  if (field === "updatedAt") return "updated_at";
  if (field === "schoolId") return "school_id";
  if (map.kind === "record" || map.kind === "settings") {
    // jsonb text extraction — works for equality, prefix and ordering on strings
    return map.kind === "record" ? `data->>${field}` : `settings->>${field}`;
  }
  return snake(field);
}

type Result = { data: Record<string, unknown> | null; error: { message: string } | null };

type Builder = {
  select: (cols: string, opts?: unknown) => Builder;
  insert: (values: unknown) => Builder;
  update: (values: unknown) => Builder;
  upsert: (values: unknown) => Builder;
  delete: () => Builder;
  eq: (c: string, v: unknown) => Builder;
  neq: (c: string, v: unknown) => Builder;
  in: (c: string, v: readonly unknown[]) => Builder;
  gt: (c: string, v: unknown) => Builder;
  gte: (c: string, v: unknown) => Builder;
  lt: (c: string, v: unknown) => Builder;
  lte: (c: string, v: unknown) => Builder;
  is: (c: string, v: null) => Builder;
  ilike: (c: string, v: string) => Builder;
  order: (c: string, o: { ascending: boolean }) => Builder;
  range: (from: number, to: number) => Builder;
  single: () => Promise<Result>;
  maybeSingle: () => Promise<Result>;
};

/**
 * The generated client is typed per known table; this adapter routes by
 * collection name at runtime, so it uses a structurally typed view of the
 * same client. RLS still applies — only the TypeScript surface is looser.
 */
const sb = supabase as unknown as { from: (table: string) => Builder };


function applyFilter(builder: Builder, map: Mapping, f: Filter): Builder {
  const col = columnFor(map, f.field);
  switch (f.op) {
    case "eq":
      return f.value === null ? builder.is(col, null) : builder.eq(col, f.value);
    case "ne":
      return builder.neq(col, f.value);
    case "in":
      return builder.in(col, (f.value as unknown[]) ?? []);
    case "gt":
      return builder.gt(col, f.value);
    case "gte":
      return builder.gte(col, f.value);
    case "lt":
      return builder.lt(col, f.value);
    case "lte":
      return builder.lte(col, f.value);
    case "contains":
      return builder.ilike(col, `%${String(f.value ?? "")}%`);
    case "startsWith":
      return builder.ilike(col, `${String(f.value ?? "")}%`);
    default:
      return builder;
  }
}

function applyOrder(builder: Builder, map: Mapping, orderBy?: SortSpec | SortSpec[]): Builder {
  const specs = orderBy ? (Array.isArray(orderBy) ? orderBy : [orderBy]) : [];
  let b = builder;
  for (const spec of specs) {
    b = b.order(columnFor(map, spec.field), { ascending: (spec.dir ?? "asc") === "asc" });
  }
  return b;
}

function tableOf(map: Mapping): string {
  if (map.kind === "table") return map.table;
  if (map.kind === "settings") return "school_settings";
  return "records";
}

function decode(map: Mapping, row: Record<string, unknown>): Entity {
  if (map.kind === "record") return entityFromRecord(row);
  if (map.kind === "settings") return entityFromSettings(row);
  return rowToEntity(row);
}

function encode(map: Mapping, collection: string, data: Record<string, unknown>) {
  if (map.kind === "record") {
    const { schoolId, payload } = splitRecordPayload(data);
    return { collection, school_id: schoolId, data: payload } as Record<string, unknown>;
  }
  if (map.kind === "settings") {
    const { schoolId, payload } = splitRecordPayload(data);
    return { school_id: schoolId, settings: payload } as Record<string, unknown>;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === "id" || k === "createdAt" || k === "updatedAt") continue;
    out[snake(k)] = v;
  }
  return out;
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

const capabilities: AdapterCapabilities = {
  serverSidePagination: true,
  cursorPagination: true,
  rowLevelSecurity: true,
  transactions: false,
  fullTextSearch: true,
};

export const supabaseDataProvider: DataProvider = {
  name: "cloud",
  capabilities,

  // Indexes are created by migrations; nothing to do at runtime.
  async ensureIndexes() {},

  async list<T extends Entity>(collection: string, query?: Query<T>): Promise<T[]> {
    const page = await this.listPage<T>(collection, { ...query, limit: query?.limit ?? 1000 });
    return page.rows;
  },

  async listPage<T extends Entity>(collection: string, query?: Query<T>): Promise<PageResult<T>> {
    const map = mapping(collection);
    let builder = sb
      .from(tableOf(map))
      .select("*", query?.withTotal ? { count: "exact" } : undefined) as unknown as Builder;

    if (map.kind === "record") builder = builder.eq("collection", collection);
    for (const f of toFilters(query)) builder = applyFilter(builder, map, f);
    builder = applyOrder(builder, map, query?.orderBy);

    const offset = query?.offset ?? decodeCursor(query?.cursor);
    const limit = query?.limit ?? 50;
    builder = builder.range(offset, offset + limit - 1);

    const { data, error, count } = (await (builder as unknown as Promise<{
      data: Record<string, unknown>[] | null;
      error: { message: string } | null;
      count: number | null;
    }>)) as { data: Record<string, unknown>[] | null; error: { message: string } | null; count: number | null };
    fail(`list ${collection}`, error);

    const rows = (data ?? []).map((r) => decode(map, r) as T);
    const hasMore = rows.length === limit;
    return {
      rows,
      hasMore,
      nextCursor: hasMore ? encodeCursor(offset + rows.length) : null,
      ...(typeof count === "number" ? { total: count } : {}),
    };
  },

  async count<T extends Entity>(collection: string, query?: Query<T>): Promise<number> {
    const map = mapping(collection);
    let builder = sb
      .from(tableOf(map))
      .select("id", { count: "exact", head: true }) as unknown as Builder;
    if (map.kind === "record") builder = builder.eq("collection", collection);
    for (const f of toFilters(query)) builder = applyFilter(builder, map, f);
    const { error, count } = (await (builder as unknown as Promise<{
      error: { message: string } | null;
      count: number | null;
    }>)) as { error: { message: string } | null; count: number | null };
    fail(`count ${collection}`, error);
    return count ?? 0;
  },

  async get<T extends Entity>(collection: string, id: Id): Promise<T | null> {
    const map = mapping(collection);
    const { data, error } = await sb.from(tableOf(map)).select("*").eq("id", id).maybeSingle();
    if (error) fail(`get ${collection}`, error);
    return data ? (decode(map, data as Record<string, unknown>) as T) : null;
  },

  async create<T extends Entity>(collection: string, input: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T> {
    const map = mapping(collection);
    const payload = encode(map, collection, input as Record<string, unknown>);
    // A school holds exactly one policy row, and provisioning + first read can
    // both ask for it. Upsert so the second caller adopts the existing row
    // instead of colliding with the one-config-per-school constraint.
    const table = sb.from(tableOf(map)) as unknown as {
      insert: (p: unknown) => Builder;
      upsert: (p: unknown, o?: { onConflict?: string }) => Builder;
    };
    const builder =
      map.kind === "settings"
        ? table.upsert(payload, { onConflict: "school_id" })
        : table.insert(payload);
    const { data, error } = (await (builder as unknown as {
      select: (s: string) => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
    })
      .select("*")
      .single()) as { data: unknown; error: { message: string } | null };
    fail(`create ${collection}`, error);
    return decode(map, data as Record<string, unknown>) as T;
  },

  async update<T extends Entity>(collection: string, id: Id, patch: Partial<T>): Promise<T> {
    const map = mapping(collection);
    if (map.kind === "record" || map.kind === "settings") {
      // Merge into the jsonb payload so partial updates behave like a patch.
      const current = await this.get<T>(collection, id);
      if (!current) throw new Error(`${collection}/${id} not found`);
      const merged = { ...(current as Record<string, unknown>), ...(patch as Record<string, unknown>) };
      const { payload } = splitRecordPayload(merged);
      const column = map.kind === "record" ? "data" : "settings";
      const { data, error } = await sb
        .from(tableOf(map))
        .update({ [column]: payload })
        .eq("id", id)
        .select("*")
        .single();
      fail(`update ${collection}`, error);
      return decode(map, data as Record<string, unknown>) as T;
    }
    const { data, error } = await sb
      .from(tableOf(map))
      .update(encode(map, collection, patch as Record<string, unknown>))
      .eq("id", id)
      .select("*")
      .single();
    fail(`update ${collection}`, error);
    return decode(map, data as Record<string, unknown>) as T;
  },

  async remove(collection: string, id: Id): Promise<void> {
    const map = mapping(collection);
    const { error } = (await (sb.from(tableOf(map)).delete().eq("id", id) as unknown as Promise<Result>));
    fail(`remove ${collection}`, error);
  },

  async bulkPut<T extends Entity>(collection: string, rows: T[]): Promise<void> {
    const map = mapping(collection);
    if (!rows.length) return;
    const payload = rows.map((row) => {
      const encoded = encode(map, collection, row as Record<string, unknown>);
      const id = (row as Record<string, unknown>)["id"];
      return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? { ...encoded, id } : encoded;
    });
    const { error } = (await (sb.from(tableOf(map)).upsert(payload) as unknown as Promise<Result>));
    fail(`bulkPut ${collection}`, error);
  },
};
