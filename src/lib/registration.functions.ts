import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Public: does the platform still need its first-time setup? */
export const getBootstrapState = createServerFn({ method: "GET" }).handler(async () => {
  const { isBootstrapped } = await import("./registration.server");
  return { bootstrapped: await isBootstrapped() };
});

/** Public, and only usable once: creates the super admin + the first country. */
export const bootstrapPlatform = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        platformName: z.string().min(2),
        tagline: z.string().default(""),
        countryName: z.string().min(2),
        countryCode: z.string().min(2).max(3),
        fullName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const server = await import("./registration.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (await server.isBootstrapped()) throw new Error("The platform is already set up.");

    await supabaseAdmin
      .from("platform_settings")
      .upsert(
        { singleton: true, platform_name: data.platformName, tagline: data.tagline },
        { onConflict: "singleton" },
      );

    const { data: country, error: countryError } = await supabaseAdmin
      .from("countries")
      .upsert(
        { name: data.countryName, code: data.countryCode.toUpperCase() },
        { onConflict: "code" },
      )
      .select("id")
      .single();
    if (countryError || !country) throw new Error(countryError?.message ?? "Country failed");

    const userId = await server.createAccount({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
    });
    await server.grantRole({ userId, role: "super_admin" });
    await server.audit({
      actorId: userId,
      action: "platform.bootstrapped",
      scope: "platform",
      detail: { platformName: data.platformName },
    });

    return { ok: true, countryId: country.id };
  });

/** Super admin only: create a national administrator for a country. */
export const createNationalAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fullName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        countryId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("Forbidden");

    const server = await import("./registration.server");
    const userId = await server.createAccount({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
    });
    await server.grantRole({ userId, role: "national_admin", countryId: data.countryId });
    await server.audit({
      actorId: context.userId,
      action: "national_admin.created",
      scope: "country",
      scopeId: data.countryId,
      targetTable: "user_roles",
      targetId: userId,
    });
    return { ok: true };
  });

/** Super or national admin: create a regional administrator. */
export const createRegionalAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        fullName: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        regionId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    const { data: isNational } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "national_admin",
    });
    if (!isSuper && !isNational) throw new Error("Forbidden");

    const server = await import("./registration.server");
    const userId = await server.createAccount({
      email: data.email,
      password: data.password,
      fullName: data.fullName,
    });
    await server.grantRole({ userId, role: "regional_admin", regionId: data.regionId });
    await server.audit({
      actorId: context.userId,
      action: "regional_admin.created",
      scope: "region",
      scopeId: data.regionId,
      targetTable: "user_roles",
      targetId: userId,
    });
    return { ok: true };
  });

/** Any signed-in user: register a school and become its admin. */
export const submitSchoolRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        schoolName: z.string().min(2),
        proposedCode: z.string().min(2).max(24),
        countryId: z.string().uuid(),
        regionId: z.string().uuid().nullable().default(null),
        district: z.string().nullable().default(null),
        typeCode: z.string().default("public"),
        levelCodes: z.array(z.string()).default([]),
        contactPhone: z.string().nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const server = await import("./registration.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: reg, error } = await supabaseAdmin
      .from("school_registrations")
      .insert({
        school_name: data.schoolName,
        proposed_code: data.proposedCode.toUpperCase(),
        country_id: data.countryId,
        region_id: data.regionId,
        district: data.district,
        type_code: data.typeCode,
        level_codes: data.levelCodes,
        contact_phone: data.contactPhone,
        requested_by: context.userId,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !reg) throw new Error(error?.message ?? "Could not submit the registration");

    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("auto_approve_registrations")
      .maybeSingle();

    if (settings?.auto_approve_registrations !== false) {
      const { schoolId } = await server.approveRegistration(reg.id, context.userId);
      return { status: "approved" as const, registrationId: reg.id, schoolId };
    }

    await server.audit({
      actorId: context.userId,
      action: "school.registration.submitted",
      scope: "platform",
      targetTable: "school_registrations",
      targetId: reg.id,
    });
    return { status: "pending" as const, registrationId: reg.id, schoolId: null };
  });

/** Oversight admins: approve or reject a pending school registration. */
export const reviewSchoolRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        registrationId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        reason: z.string().nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const allowed = (roles.data ?? []).some((r) =>
      ["super_admin", "national_admin", "regional_admin"].includes(r.role),
    );
    if (!allowed) throw new Error("Forbidden");

    const server = await import("./registration.server");
    if (data.decision === "approve") {
      return await server.approveRegistration(data.registrationId, context.userId);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("school_registrations")
      .update({
        status: "rejected",
        rejection_reason: data.reason,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.registrationId);
    return { schoolId: null };
  });
