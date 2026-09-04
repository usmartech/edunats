/* ------------------------------------------------------------------ *
 * Hierarchy reads (browser side, RLS-scoped).
 *
 * Platform -> country -> region -> school. Every oversight dashboard
 * reads through these helpers so the visible data always matches the
 * caller's scope, enforced again by row level security.
 * ------------------------------------------------------------------ */

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Country = { id: string; name: string; code: string; active: boolean };
export type Region = { id: string; name: string; code: string; country_id: string; active: boolean };

export const DEFAULT_COUNTRY = {
  name: "Ghana",
  code: "GH",
};

export const GHANA_16_REGIONS: Array<{ code: string; name: string }> = [
  { code: "GAR", name: "Greater Accra" },
  { code: "ASH", name: "Ashanti" },
  { code: "WHR", name: "Western" },
  { code: "WNR", name: "Western North" },
  { code: "CPR", name: "Central" },
  { code: "EPR", name: "Eastern" },
  { code: "VTR", name: "Volta" },
  { code: "OTR", name: "Oti" },
  { code: "NPR", name: "Northern" },
  { code: "SVR", name: "Savannah" },
  { code: "NER", name: "North East" },
  { code: "UER", name: "Upper East" },
  { code: "UWR", name: "Upper West" },
  { code: "BAR", name: "Bono" },
  { code: "BER", name: "Bono East" },
  { code: "AHR", name: "Ahafo" },
];
export type PlatformSettings = {
  id: string;
  platform_name: string;
  tagline: string;
  support_email: string | null;
  auto_approve_registrations: boolean;
};

export type SchoolRow = {
  id: string;
  name: string;
  code: string;
  country: string;
  country_id: string | null;
  region: string | null;
  region_id: string | null;
  district: string | null;
  status: string;
  active: boolean;
  created_at: string;
};

export type RegistrationRow = {
  id: string;
  school_name: string;
  proposed_code: string;
  country_id: string | null;
  region_id: string | null;
  district: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  rejection_reason: string | null;
  requested_by: string;
};

export async function fetchPlatformSettings(): Promise<PlatformSettings | null> {
  const { data } = await supabase
    .from("platform_settings")
    .select("id, platform_name, tagline, support_email, auto_approve_registrations")
    .maybeSingle();
  return data ?? null;
}

export async function updatePlatformSettings(patch: Partial<PlatformSettings>) {
  const { error } = await supabase.from("platform_settings").update(patch).eq("singleton", true);
  if (error) throw new Error(error.message);
}

export async function fetchCountries(): Promise<Country[]> {
  const { data } = await supabase
    .from("countries")
    .select("id, name, code, active")
    .order("name");
  return data ?? [];
}

export async function fetchRegions(countryId?: string | null): Promise<Region[]> {
  let query = supabase.from("regions").select("id, name, code, country_id, active").order("name");
  if (countryId) query = query.eq("country_id", countryId);
  const { data } = await query;
  return data ?? [];
}

/* -------------------------- geo master data ------------------------- */

export type GeoUnit = {
  id: string;
  code: string;
  name: string;
  unit_type: string;
  capital: string | null;
  parent_id: string | null;
  region_id: string | null;
  country_id: string;
  active: boolean;
};

const GEO_COLUMNS = "id, code, name, unit_type, capital, parent_id, region_id, country_id, active";

/** Geo units for one level (REGION | MMDA | SUBMETRO | LOCALITY), optionally under a parent. */
export async function fetchGeoUnits(
  levelCode: "REGION" | "MMDA" | "SUBMETRO" | "LOCALITY",
  filter?: { parentId?: string | null; regionId?: string | null; countryId?: string | null },
): Promise<GeoUnit[]> {
  const levels = await supabase.from("geo_levels").select("id, code, country_id").eq("code", levelCode);
  const levelIds = (levels.data ?? []).map((l) => l.id);
  if (levelIds.length === 0) return [];

  let query = supabase
    .from("geo_units")
    .select(GEO_COLUMNS)
    .in("level_id", levelIds)
    .eq("active", true)
    .order("name");
  if (filter?.parentId) query = query.eq("parent_id", filter.parentId);
  if (filter?.regionId) query = query.eq("region_id", filter.regionId);
  if (filter?.countryId) query = query.eq("country_id", filter.countryId);
  const { data } = await query;
  return data ?? [];
}


export async function fetchSchools(filter?: {
  countryId?: string | null;
  regionId?: string | null;
}): Promise<SchoolRow[]> {
  let query = supabase
    .from("schools")
    .select(
      "id, name, code, country, country_id, region, region_id, district, status, active, created_at",
    )
    .order("name");
  if (filter?.countryId) query = query.eq("country_id", filter.countryId);
  if (filter?.regionId) query = query.eq("region_id", filter.regionId);
  const { data } = await query;
  return data ?? [];
}

/** Registration requests, always narrowed to the caller's slice of the hierarchy. */
export async function fetchRegistrations(
  status?: string,
  scope?: { countryId?: string | null; regionId?: string | null },
): Promise<RegistrationRow[]> {
  let query = supabase
    .from("school_registrations")
    .select(
      "id, school_name, proposed_code, country_id, region_id, district, status, created_at, reviewed_at, confirmed_at, confirmed_by, rejection_reason, requested_by",
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (scope?.countryId) query = query.eq("country_id", scope.countryId);
  if (scope?.regionId) query = query.eq("region_id", scope.regionId);
  const { data } = await query;
  return data ?? [];
}

/* --------------------- super admin configuration -------------------- */

export async function saveCountry(input: {
  id?: string;
  name: string;
  code: string;
  active?: boolean;
}) {
  const payload = { name: input.name, code: input.code.toUpperCase(), active: input.active ?? true };
  const { error } = input.id
    ? await supabase.from("countries").update(payload).eq("id", input.id)
    : await supabase.from("countries").insert(payload);
  if (error) throw new Error(error.message);
}

export async function saveRegion(input: {
  id?: string;
  countryId: string;
  name: string;
  code: string;
  active?: boolean;
}) {
  const payload = {
    country_id: input.countryId,
    name: input.name,
    code: input.code.toUpperCase(),
    active: input.active ?? true,
  };
  const { error } = input.id
    ? await supabase.from("regions").update(payload).eq("id", input.id)
    : await supabase.from("regions").insert(payload);
  if (error) throw new Error(error.message);
}

export async function deleteRegion(id: string) {
  const { error } = await supabase.from("regions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateSchool(
  id: string,
  patch: { name?: string; code?: string; active?: boolean; status?: string; region_id?: string | null },
) {
  const { error } = await supabase.from("schools").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteSchool(id: string) {
  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) throw new Error(error.message);
}


export function usePlatformSettings() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetchPlatformSettings().then((value) => {
      if (cancelled) return;
      setSettings(value);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return { settings, ready, platformName: settings?.platform_name ?? "EduNat" };
}
