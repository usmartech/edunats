import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SCHOOL_ROLES = ["school_admin", "staff", "teacher", "parent", "student"] as const;

/**
 * True when the caller may administer this school: its school admin, or an
 * oversight admin whose scope (region / country / platform) contains it.
 */
async function authorizeSchoolAdmin(
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
    from: (table: string) => any;
  },
  userId: string,
  schoolId: string,
) {
  const { data: isSuper } = await supabase.rpc("is_super_admin", { _user_id: userId });
  if (isSuper) return;
  const { data: isSchoolAdmin } = await supabase.rpc("is_school_admin", {
    _user_id: userId,
    _school_id: schoolId,
  });
  if (isSchoolAdmin) return;

  const { data: school } = await supabase
    .from("schools")
    .select("country_id, region_id")
    .eq("id", schoolId)
    .maybeSingle();
  if (school?.country_id) {
    const { data: isNational } = await supabase.rpc("is_national_admin", {
      _user_id: userId,
      _country_id: school.country_id,
    });
    if (isNational) return;
  }
  if (school?.region_id) {
    const { data: isRegional } = await supabase.rpc("is_regional_admin", {
      _user_id: userId,
      _region_id: school.region_id,
    });
    if (isRegional) return;
  }
  throw new Error("Forbidden: you do not administer this school.");
}

/** Everyone attached to a school, with their role. Admins of that school only. */
export const listSchoolMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ schoolId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await authorizeSchoolAdmin(context.supabase as never, context.userId, data.schoolId);
    const { listMembers } = await import("./members.server");
    return { members: await listMembers(data.schoolId) };
  });

/** Invite a person into the school with a role (creates the account if new). */
export const inviteSchoolMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        schoolId: z.string().uuid(),
        email: z.string().email(),
        fullName: z.string().min(2),
        role: z.enum(SCHOOL_ROLES),
        password: z.string().min(8).nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await authorizeSchoolAdmin(context.supabase as never, context.userId, data.schoolId);
    const members = await import("./members.server");
    const server = await import("./registration.server");

    const { userId, created } = await members.findOrCreateAccount({
      email: data.email,
      fullName: data.fullName,
      password: data.password,
    });
    await members.setSchoolRole({ userId, schoolId: data.schoolId, role: data.role });
    await server.audit({
      actorId: context.userId,
      action: "school.member.invited",
      scope: "school",
      scopeId: data.schoolId,
      targetTable: "user_roles",
      targetId: userId,
      detail: { role: data.role, created },
    });
    return { ok: true, created };
  });

/** Change an existing member's role inside the school. */
export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        schoolId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.enum(SCHOOL_ROLES),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await authorizeSchoolAdmin(context.supabase as never, context.userId, data.schoolId);
    const members = await import("./members.server");
    const server = await import("./registration.server");

    if (data.role !== "school_admin") {
      const admins = await members.countSchoolAdmins(data.schoolId);
      const { members: current } = { members: await members.listMembers(data.schoolId) };
      const target = current.find((m) => m.userId === data.userId);
      if (target?.role === "school_admin" && admins <= 1)
        throw new Error("This is the school's only administrator. Transfer admin rights first.");
    }

    await members.setSchoolRole({
      userId: data.userId,
      schoolId: data.schoolId,
      role: data.role,
    });
    await server.audit({
      actorId: context.userId,
      action: "school.member.role_changed",
      scope: "school",
      scopeId: data.schoolId,
      targetTable: "user_roles",
      targetId: data.userId,
      detail: { role: data.role },
    });
    return { ok: true };
  });

/** Remove a member from the school entirely. */
export const removeSchoolMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ schoolId: z.string().uuid(), userId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await authorizeSchoolAdmin(context.supabase as never, context.userId, data.schoolId);
    const members = await import("./members.server");
    const server = await import("./registration.server");

    const current = await members.listMembers(data.schoolId);
    const target = current.find((m) => m.userId === data.userId);
    if (target?.role === "school_admin" && (await members.countSchoolAdmins(data.schoolId)) <= 1)
      throw new Error("You cannot remove the school's only administrator.");

    await members.removeSchoolRole(data.userId, data.schoolId);
    await server.audit({
      actorId: context.userId,
      action: "school.member.removed",
      scope: "school",
      scopeId: data.schoolId,
      targetTable: "user_roles",
      targetId: data.userId,
    });
    return { ok: true };
  });

/** Hand school admin rights to another member; the outgoing admin can step down. */
export const transferSchoolAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        schoolId: z.string().uuid(),
        userId: z.string().uuid(),
        stepDown: z.boolean().default(false),
        stepDownRole: z.enum(["staff", "teacher"]).default("staff"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await authorizeSchoolAdmin(context.supabase as never, context.userId, data.schoolId);
    const members = await import("./members.server");
    const server = await import("./registration.server");

    await members.setSchoolRole({
      userId: data.userId,
      schoolId: data.schoolId,
      role: "school_admin",
    });

    if (data.stepDown && data.userId !== context.userId) {
      const current = await members.listMembers(data.schoolId);
      const self = current.find((m) => m.userId === context.userId);
      if (self)
        await members.setSchoolRole({
          userId: context.userId,
          schoolId: data.schoolId,
          role: data.stepDownRole,
        });
    }

    await server.audit({
      actorId: context.userId,
      action: "school.admin.transferred",
      scope: "school",
      scopeId: data.schoolId,
      targetTable: "user_roles",
      targetId: data.userId,
      detail: { stepDown: data.stepDown },
    });
    return { ok: true };
  });
