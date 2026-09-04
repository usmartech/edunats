/* ------------------------------------------------------------------ *
 * Privileged hierarchy operations (service role).
 *
 * Bootstrap of the platform, creation of oversight administrators and
 * approval of school registrations all need to write rows the requester
 * is not yet allowed to write. They live here, behind server functions
 * that authorise the caller first.
 * ------------------------------------------------------------------ */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const ACCESS_LEVEL = {
  super_admin: 100,
  national_admin: 90,
  regional_admin: 80,
  school_admin: 70,
} as const;

export async function isBootstrapped(): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "super_admin");
  return (count ?? 0) > 0;
}

export async function createAccount(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create the account");

  await supabaseAdmin
    .from("profiles")
    .upsert({ id: data.user.id, email: input.email, full_name: input.fullName });

  return data.user.id;
}

export async function grantRole(input: {
  userId: string;
  role: "super_admin" | "national_admin" | "regional_admin" | "school_admin";
  schoolId?: string | null;
  regionId?: string | null;
  countryId?: string | null;
}) {
  const { error } = await supabaseAdmin.from("user_roles").insert({
    user_id: input.userId,
    role: input.role,
    school_id: input.schoolId ?? null,
    region_id: input.regionId ?? null,
    country_id: input.countryId ?? null,
    access_level: ACCESS_LEVEL[input.role],
  });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
}

export async function audit(entry: {
  actorId: string | null;
  action: string;
  scope: string;
  scopeId?: string | null;
  targetTable?: string | null;
  targetId?: string | null;
  detail?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("audit_log").insert({
    actor_id: entry.actorId,
    action: entry.action,
    scope: entry.scope,
    scope_id: entry.scopeId ?? null,
    target_table: entry.targetTable ?? null,
    target_id: entry.targetId ?? null,
    detail: (entry.detail ?? {}) as never,
  });
}

/** Confirms a pending school registration (regional admin step) and forwards it for national approval. */
export async function confirmRegistration(registrationId: string, reviewerId: string) {
  const { data: reg, error } = await supabaseAdmin
    .from("school_registrations")
    .select("*")
    .eq("id", registrationId)
    .maybeSingle();
  if (error || !reg) throw new Error("Registration not found");
  if (reg.status !== "pending") throw new Error(`Only pending registrations can be confirmed. Current status: ${reg.status}`);

  await supabaseAdmin
    .from("school_registrations")
    .update({
      status: "region_confirmed",
      confirmed_by: reviewerId,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", registrationId);

  await audit({
    actorId: reviewerId,
    action: "school.registration.confirmed_by_region",
    scope: "region",
    scopeId: reg.region_id,
    targetTable: "school_registrations",
    targetId: registrationId,
  });

  return { registrationId };
}

/** Creates the school from an approved registration and makes the requester its admin (super admin of the school). */
export async function approveRegistration(registrationId: string, reviewerId: string) {
  const { data: reg, error } = await supabaseAdmin
    .from("school_registrations")
    .select("*")
    .eq("id", registrationId)
    .maybeSingle();
  if (error || !reg) throw new Error("Registration not found");
  if (reg.status === "approved" && reg.school_id) return { schoolId: reg.school_id };

  const { data: country } = reg.country_id
    ? await supabaseAdmin.from("countries").select("name").eq("id", reg.country_id).maybeSingle()
    : { data: null };
  const { data: region } = reg.region_id
    ? await supabaseAdmin.from("regions").select("name").eq("id", reg.region_id).maybeSingle()
    : { data: null };

  const { data: school, error: schoolError } = await supabaseAdmin
    .from("schools")
    .insert({
      name: reg.school_name,
      code: reg.proposed_code,
      country: country?.name ?? "",
      country_id: reg.country_id,
      region: region?.name ?? null,
      region_id: reg.region_id,
      district: reg.district,
      mmda_id: reg.mmda_id,
      sub_metro_id: reg.sub_metro_id,
      locality_id: reg.locality_id,
      locality_name: reg.locality_name,
      postal_address: reg.postal_address,
      nearest_landmark: reg.nearest_landmark,
      area_community: reg.area_community,
      gps_lat: reg.gps_lat,
      gps_lng: reg.gps_lng,
      digital_address: reg.digital_address,
      type_code: reg.type_code,
      level_codes: reg.level_codes,
      status: "active",
      active: true,
      created_by: reg.requested_by,
    })
    .select("id")
    .single();
  if (schoolError || !school) throw new Error(schoolError?.message ?? "Could not create school");

  await grantRole({ userId: reg.requested_by, role: "school_admin", schoolId: school.id });

  await supabaseAdmin
    .from("school_registrations")
    .update({
      status: "approved",
      school_id: school.id,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", registrationId);

  await audit({
    actorId: reviewerId,
    action: "school.registration.approved",
    scope: "school",
    scopeId: school.id,
    targetTable: "school_registrations",
    targetId: registrationId,
  });

  return { schoolId: school.id };
}
