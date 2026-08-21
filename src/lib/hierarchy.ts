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

export async function fetchRegistrations(status?: string): Promise<RegistrationRow[]> {
  let query = supabase
    .from("school_registrations")
    .select(
      "id, school_name, proposed_code, country_id, region_id, district, status, created_at, requested_by",
    )
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return data ?? [];
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
