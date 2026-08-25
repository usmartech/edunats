/* ------------------------------------------------------------------ *
 * School membership (service role).
 *
 * School Role Hierarchy:
 * Super Admin (100/platform) -> School Manager (school_admin: 70) -> Staff (50) -> Student (10) -> Parent (20)
 *
 * Listing members needs the auth directory and profile rows the caller
 * cannot read directly, so those reads happen here — always behind a
 * server function that has already authorised the caller for the school.
 * ------------------------------------------------------------------ */

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SchoolRole = "school_admin" | "staff" | "teacher" | "parent" | "student";

export const SCHOOL_ROLE_LEVEL: Record<SchoolRole, number> = {
  school_admin: 70,
  staff: 50,
  teacher: 40,
  parent: 20,
  student: 10,
};

export type MemberRow = {
  roleId: string;
  userId: string;
  role: SchoolRole;
  fullName: string | null;
  email: string | null;
  createdAt: string;
};

export async function listMembers(schoolId: string): Promise<MemberRow[]> {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("id, user_id, role, created_at")
    .eq("school_id", schoolId)
    .order("created_at");
  if (error) throw new Error(error.message);
  const rows = roles ?? [];
  if (rows.length === 0) return [];

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, email")
    .in(
      "id",
      rows.map((r) => r.user_id),
    );
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((r) => ({
    roleId: r.id,
    userId: r.user_id,
    role: r.role as SchoolRole,
    fullName: byId.get(r.user_id)?.full_name ?? null,
    email: byId.get(r.user_id)?.email ?? null,
    createdAt: r.created_at,
  }));
}

/** Finds an existing account by email, or creates one with a temporary password. */
export async function findOrCreateAccount(input: {
  email: string;
  fullName: string;
  password?: string | null;
}): Promise<{ userId: string; created: boolean }> {
  const email = input.email.trim().toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (existing) return { userId: existing.id, created: false };

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: input.password || `Temp-${crypto.randomUUID().slice(0, 12)}!`,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create the account");

  await supabaseAdmin
    .from("profiles")
    .upsert({ id: data.user.id, email, full_name: input.fullName });

  return { userId: data.user.id, created: true };
}

export async function setSchoolRole(input: {
  userId: string;
  schoolId: string;
  role: SchoolRole;
}) {
  await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", input.userId)
    .eq("school_id", input.schoolId);

  const { error } = await supabaseAdmin.from("user_roles").insert({
    user_id: input.userId,
    school_id: input.schoolId,
    role: input.role,
    access_level: SCHOOL_ROLE_LEVEL[input.role],
  });
  if (error) throw new Error(error.message);
}

export async function removeSchoolRole(userId: string, schoolId: string) {
  const { error } = await supabaseAdmin
    .from("user_roles")
    .delete()
    .eq("user_id", userId)
    .eq("school_id", schoolId);
  if (error) throw new Error(error.message);
}

export async function countSchoolAdmins(schoolId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("role", "school_admin");
  return count ?? 0;
}
