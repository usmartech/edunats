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

    await server.audit({
      actorId: context.userId,
      action: "school.registration.submitted",
      scope: "platform",
      targetTable: "school_registrations",
      targetId: reg.id,
    });
    return { status: "pending" as const, registrationId: reg.id, schoolId: null };
  });

/** Oversight admins: review, confirm, approve or reject a school registration.
 * Flow:
 * - Regional Admin confirms a pending request -> status becomes "region_confirmed".
 * - National Admin (or Super Admin) approves a region_confirmed request -> status becomes "approved" and school & super admin role created.
 * - Any authorized admin can reject a pending or region_confirmed request.
 */
export const reviewSchoolRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        registrationId: z.string().uuid(),
        decision: z.enum(["confirm", "approve", "reject"]),
        reason: z.string().nullable().default(null),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg } = await supabaseAdmin
      .from("school_registrations")
      .select("id, status, country_id, region_id")
      .eq("id", data.registrationId)
      .maybeSingle();
    if (!reg) throw new Error("Registration not found");
    if (reg.status === "approved" || reg.status === "rejected") {
      throw new Error(`This request was already ${reg.status}.`);
    }

    const { data: isSuper } = await context.supabase.rpc("is_super_admin", {
      _user_id: context.userId,
    });
    const isNational = reg.country_id
      ? Boolean(
          (
            await context.supabase.rpc("is_national_admin", {
              _user_id: context.userId,
              _country_id: reg.country_id,
            })
          ).data,
        )
      : false;
    const isRegional = reg.region_id
      ? Boolean(
          (
            await context.supabase.rpc("is_regional_admin", {
              _user_id: context.userId,
              _region_id: reg.region_id,
            })
          ).data,
        )
      : false;

    const server = await import("./registration.server");

    if (data.decision === "confirm") {
      // Regional confirmation: permitted for Regional, National or Super Admins when status is 'pending'
      if (!isSuper && !isNational && !isRegional) {
        throw new Error("Forbidden: Regional confirmation required.");
      }
      if (reg.status !== "pending") {
        throw new Error("Only pending registration requests can be confirmed.");
      }
      return await server.confirmRegistration(data.registrationId, context.userId);
    }

    if (data.decision === "approve") {
      // National approval: permitted for National or Super Admins
      if (!isSuper && !isNational) {
        throw new Error("Forbidden: National approval required.");
      }
      if (reg.status !== "region_confirmed") {
        throw new Error("Only region confirmed registration requests can be approved.");
      }
      return await server.approveRegistration(data.registrationId, context.userId);
    }

    if (data.decision === "reject") {
      if (!isSuper && !isNational && !isRegional) {
        throw new Error("Forbidden: this school is outside your scope.");
      }
      await supabaseAdmin
        .from("school_registrations")
        .update({
          status: "rejected",
          rejection_reason: data.reason,
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", data.registrationId);
      await server.audit({
        actorId: context.userId,
        action: "school.registration.rejected",
        scope: "platform",
        targetTable: "school_registrations",
        targetId: data.registrationId,
        detail: { reason: data.reason },
      });
      return { schoolId: null };
    }

    throw new Error("Invalid decision");
  });

