/* ------------------------------------------------------------------ *
 * National platform identity.
 *
 * One central directory of people; each person is either a platform-level
 * actor (super admin / national officer) or attached to one or more
 * schools with a role. This module resolves that identity from the cloud
 * backend and publishes it into the tenant context so every scoped read
 * and write is automatically confined to the right school.
 * ------------------------------------------------------------------ */

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { setTenantContext } from "./data/tenant";
import { activateCloudStore } from "./data/bootstrap";
import type { RoleId } from "./access-control";
import { ROLE_ACCESS_LEVEL, type AccessLevel } from "./modules";

export type PlatformRole =
  | "super_admin"
  | "national_admin"
  | "regional_admin"
  | "school_admin"
  | "staff"
  | "teacher"
  | "parent"
  | "student";

export type RoleAssignment = {
  id: string;
  role: PlatformRole;
  schoolId: string | null;
  accessLevel: number;
};

export type SchoolSummary = { id: string; name: string; code: string; region: string | null };

export type PlatformIdentity = {
  userId: string;
  email: string | null;
  fullName: string | null;
  assignments: RoleAssignment[];
  /** Platform-wide actors see the whole nation; school actors see one school. */
  platformWide: boolean;
  schoolIds: string[];
  activeSchoolId: string | null;
  /** Portal role, mapped onto the app's existing 5-role access model. */
  portalRole: RoleId;
  accessLevel: AccessLevel;
};

/** Cloud role -> the portal's consolidated role model. */
const PORTAL_ROLE: Record<PlatformRole, RoleId> = {
  super_admin: "super-admin",
  national_admin: "super-admin",
  regional_admin: "admin",
  school_admin: "admin",
  staff: "staff",
  teacher: "staff",
  parent: "parent",
  student: "student",
};

const RANK: PlatformRole[] = [
  "super_admin",
  "national_admin",
  "regional_admin",
  "school_admin",
  "staff",
  "teacher",
  "parent",
  "student",
];

const ACTIVE_SCHOOL_KEY = "naede.activeSchoolId";

function readStoredSchoolId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_SCHOOL_KEY);
}

export function setActiveSchoolId(schoolId: string | null) {
  if (typeof window === "undefined") return;
  if (schoolId) window.localStorage.setItem(ACTIVE_SCHOOL_KEY, schoolId);
  else window.localStorage.removeItem(ACTIVE_SCHOOL_KEY);
}

export function isPlatformRole(role: PlatformRole) {
  return role === "super_admin" || role === "national_admin";
}

/**
 * The two layers of the ecosystem are separate destinations:
 * national oversight (all registered schools) vs. a single school workspace.
 */
export function landingRoute(identity: PlatformIdentity | null): "/national" | "/portal" {
  return identity?.platformWide ? "/national" : "/portal";
}

async function loadIdentity(): Promise<PlatformIdentity | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: rows } = await supabase
    .from("user_roles")
    .select("id, role, school_id, access_level")
    .eq("user_id", user.id);

  const assignments: RoleAssignment[] = (rows ?? []).map((r) => ({
    id: r.id,
    role: r.role as PlatformRole,
    schoolId: r.school_id,
    accessLevel: r.access_level,
  }));

  const platformWide = assignments.some((a) => a.schoolId === null && isPlatformRole(a.role));
  const schoolIds = [...new Set(assignments.filter((a) => a.schoolId).map((a) => a.schoolId!))];
  const stored = readStoredSchoolId();
  const activeSchoolId =
    stored && (platformWide || schoolIds.includes(stored)) ? stored : (schoolIds[0] ?? null);

  const strongest =
    RANK.find((role) => assignments.some((a) => a.role === role)) ?? ("student" as PlatformRole);
  const portalRole = PORTAL_ROLE[strongest];

  return {
    userId: user.id,
    email: user.email ?? null,
    fullName: (user.user_metadata?.["full_name"] as string | undefined) ?? null,
    assignments,
    platformWide,
    schoolIds,
    activeSchoolId,
    portalRole,
    accessLevel: ROLE_ACCESS_LEVEL[portalRole],
  };
}

/**
 * Signed-in identity for the whole app. While a session exists the cloud
 * store is the active data provider, so every module reads and writes
 * against the central database under row-level security.
 */
export function usePlatformIdentity() {
  const [identity, setIdentity] = useState<PlatformIdentity | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const next = await loadIdentity();
    setIdentity(next);
    if (next) {
      activateCloudStore();
      setTenantContext({
        schoolId: next.activeSchoolId,
        userId: next.userId,
        role: next.portalRole,
        crossTenant: next.platformWide,
      });
    } else {
      setTenantContext({ schoolId: null, crossTenant: false });
    }
    return next;
  }, []);

  useEffect(() => {
    void refresh().finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void refresh();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const switchSchool = useCallback(
    async (schoolId: string | null) => {
      setActiveSchoolId(schoolId);
      return refresh();
    },
    [refresh],
  );

  return { identity, ready, refresh, switchSchool };
}

/* --------------------------- auth actions -------------------------- */

export async function signUpWithEmail(input: { email: string; password: string; fullName: string }) {
  const redirect = typeof window !== "undefined" ? `${window.location.origin}/portal` : undefined;
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      ...(redirect ? { emailRedirectTo: redirect } : {}),
      data: { full_name: input.fullName },
    },
  });
}

export async function signInWithEmail(input: { email: string; password: string }) {
  return supabase.auth.signInWithPassword({ email: input.email, password: input.password });
}

export async function requestPasswordReset(email: string) {
  const redirect =
    typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
  return supabase.auth.resetPasswordForEmail(email, redirect ? { redirectTo: redirect } : {});
}

export async function signInWithGoogle() {
  return lovable.auth.signInWithOAuth("google", {
    redirect_uri: typeof window !== "undefined" ? window.location.origin : "",
  });
}

export async function signOutPlatform() {
  setActiveSchoolId(null);
  await supabase.auth.signOut();
}

/* ------------------------ national oversight ----------------------- */

export type NationalRow = {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  country: string;
  region: string | null;
  typeCode: string;
  levelCodes: string[];
  active: boolean;
  recordCount: number;
  staffCount: number;
  configured: boolean;
  lastActivity: string;
};

/** Nation-wide rollup. Returns [] for anyone without platform-level access. */
export async function fetchNationalOverview(): Promise<NationalRow[]> {
  const { data, error } = await supabase.rpc("national_overview");
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    schoolId: r.school_id,
    schoolName: r.school_name,
    schoolCode: r.school_code,
    country: r.country,
    region: r.region,
    typeCode: r.type_code,
    levelCodes: r.level_codes ?? [],
    active: r.active,
    recordCount: Number(r.record_count ?? 0),
    staffCount: Number(r.staff_count ?? 0),
    configured: r.configured,
    lastActivity: r.last_activity,
  }));
}

export async function listAllSchools(): Promise<SchoolSummary[]> {
  const { data, error } = await supabase
    .from("schools")
    .select("id, name, code, region")
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, code: s.code, region: s.region }));
}
