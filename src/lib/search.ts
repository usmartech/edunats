/* ------------------------------------------------------------------ *
 * Advanced / global search.
 *
 * Legacy `searchAllModules()` scanned six localStorage arrays and merged
 * the hits. Here the same six domains all live in the tenant-scoped
 * `records` table (plus the hierarchy tables for oversight admins), so
 * one scoped query per domain replaces six global scans, and row level
 * security guarantees a school never sees another school's rows.
 * ------------------------------------------------------------------ */

import { supabase } from "@/integrations/supabase/client";

export const SEARCH_DOMAINS = [
  { key: "students", label: "Students", collection: "students" },
  { key: "staff", label: "Staff", collection: "staff" },
  { key: "attendance", label: "Attendance", collection: "attendance" },
  { key: "results", label: "Results", collection: "results" },
  { key: "payments", label: "Payments", collection: "payments" },
  { key: "admissions", label: "Admissions", collection: "admissions" },
] as const;

export type SearchDomainKey = (typeof SEARCH_DOMAINS)[number]["key"];

export type SearchCriteria = {
  term?: string;
  domain?: SearchDomainKey | "schools" | "";
  startDate?: string;
  endDate?: string;
  status?: string;
};

export type SearchHit = {
  type: string;
  title: string;
  description: string;
  timestamp: string;
  data: Record<string, unknown>;
};

function textOf(value: unknown): string {
  return JSON.stringify(value ?? "").toLowerCase();
}

/** Port of legacy `matchesSearchCriteria`, minus the localStorage. */
function matches(
  data: Record<string, unknown>,
  timestamp: string,
  criteria: SearchCriteria,
): boolean {
  if (criteria.term && !textOf(data).includes(criteria.term.toLowerCase())) return false;
  if (criteria.startDate && new Date(timestamp) < new Date(criteria.startDate)) return false;
  if (criteria.endDate && new Date(timestamp) > new Date(`${criteria.endDate}T23:59:59`))
    return false;
  if (criteria.status && String(data["status"] ?? "") !== criteria.status) return false;
  return true;
}

function labelFor(collection: string, data: Record<string, unknown>): { title: string; description: string } {
  const s = (k: string) => (data[k] == null ? "" : String(data[k]));
  const name =
    s("fullName") ||
    [s("firstName"), s("lastName")].filter(Boolean).join(" ") ||
    s("name") ||
    s("studentName");

  switch (collection) {
    case "students":
      return { title: name || "Student", description: `ID: ${s("studentId") || "N/A"} · Class: ${s("class") || "N/A"}` };
    case "staff":
      return { title: name || "Staff member", description: `${s("position") || s("role") || "Staff"} · ${s("department") || "No department"}` };
    case "attendance":
      return { title: "Attendance record", description: `${name || "Student"} · ${s("date")} · ${s("status")}` };
    case "results":
      return { title: "Academic result", description: `${name || "Student"} · ${s("subject")} · ${s("score")}` };
    case "payments":
      return { title: "Payment record", description: `${name || "Student"} · ${s("amount")} · ${s("method")}` };
    case "admissions":
      return { title: name || "Application", description: `Status: ${s("status") || "pending"}` };
    default:
      return { title: name || collection, description: s("status") };
  }
}

/**
 * Search inside one school. `schoolId` null means "no tenant selected"
 * and returns nothing rather than leaking a cross-tenant scan.
 */
export async function searchSchool(
  schoolId: string | null,
  criteria: SearchCriteria,
  limit = 200,
): Promise<SearchHit[]> {
  if (!schoolId) return [];
  const domains = criteria.domain
    ? SEARCH_DOMAINS.filter((d) => d.key === criteria.domain)
    : SEARCH_DOMAINS;
  if (!domains.length) return [];

  const { data } = await supabase
    .from("records")
    .select("id, collection, data, created_at, updated_at")
    .eq("school_id", schoolId)
    .in(
      "collection",
      domains.map((d) => d.collection),
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  const hits: SearchHit[] = [];
  for (const row of data ?? []) {
    const payload = (row.data ?? {}) as Record<string, unknown>;
    const timestamp = String(payload["date"] ?? payload["createdAt"] ?? row.created_at);
    if (!matches(payload, timestamp, criteria)) continue;
    const { title, description } = labelFor(row.collection, payload);
    hits.push({ type: row.collection, title, description, timestamp, data: payload });
  }
  return hits.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

/**
 * Oversight search: regional / national / platform admins search the
 * school register itself. RLS narrows the rows to their scope.
 */
export async function searchSchools(
  criteria: SearchCriteria,
  scope?: { countryId?: string | null; regionId?: string | null },
): Promise<SearchHit[]> {
  let query = supabase
    .from("schools")
    .select("id, name, code, country, region, district, status, active, created_at")
    .order("name")
    .limit(200);
  if (scope?.countryId) query = query.eq("country_id", scope.countryId);
  if (scope?.regionId) query = query.eq("region_id", scope.regionId);
  const { data } = await query;

  return (data ?? [])
    .filter((row) => matches(row as unknown as Record<string, unknown>, row.created_at, criteria))
    .map((row) => ({
      type: "school",
      title: row.name,
      description: `${row.code} · ${row.region ?? row.country} · ${row.status}`,
      timestamp: row.created_at,
      data: row as unknown as Record<string, unknown>,
    }));
}
