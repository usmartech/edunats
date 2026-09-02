import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { setSessionSchool } from "@/lib/session";
import { usePortalSession, signOutPortal } from "@/lib/portal-session";
import { usePlatformIdentity } from "@/lib/platform";
import { usePlatformSettings } from "@/lib/hierarchy";
import { supabase } from "@/integrations/supabase/client";
import { setActiveSchoolId } from "@/lib/platform";
import { MODULE_GROUPS, MODULE_REGISTRY, schoolModules } from "@/lib/modules";
import { setTenantContext } from "@/lib/data/tenant";
import { ensureSeeded, getSettings, listSchools, type School } from "@/lib/tenancy";
import { NotificationCenter } from "@/components/NotificationCenter";
import { GlobalSearch } from "@/components/GlobalSearch";
import { DashboardWidgets } from "@/components/DashboardWidgets";
import { logActivity } from "@/lib/activity";

export const Route = createFileRoute("/portal")({
  head: () => ({
    meta: [
      { title: "Your Portal — Scholaris School Management" },
      {
        name: "description",
        content:
          "Role-aware portal workspace listing only the school modules your access level permits.",
      },
      { property: "og:title", content: "Your Portal — Scholaris School Management" },
      {
        property: "og:description",
        content: "Role-aware workspace showing only the modules your access level permits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalPage,
});

function PortalPage() {
  const { session, ready, role, cloud } = usePortalSession();
  const { identity } = usePlatformIdentity();
  const { platformName } = usePlatformSettings();
  const [cloudSchoolName, setCloudSchoolName] = useState<string | null>(null);

  /* The dashboard is named after the school the user is working in. */
  useEffect(() => {
    const id = session?.schoolId;
    if (!id) return setCloudSchoolName(null);
    void supabase
      .from("schools")
      .select("name")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setCloudSchoolName(data?.name ?? null));
  }, [session?.schoolId]);
  const navigate = useNavigate();
  const [schools, setSchools] = useState<School[]>([]);
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (ready && !session) navigate({ to: "/", replace: true });
  }, [ready, session, navigate]);

  /* Bind every data read/write in this workspace to the active school. */
  useEffect(() => {
    if (!session) return;
    setTenantContext({
      schoolId: session.schoolId ?? null,
      userId: session.userId,
      role: session.role,
      crossTenant: session.role === "super-admin",
    });
  }, [session]);

  /* Load the national school register + this school's own configuration. */
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void (async () => {
      await ensureSeeded();
      const rows = (await listSchools()).filter((sc) => sc.active);
      if (cancelled) return;
      setSchools(rows);
      const activeId = session.schoolId ?? rows[0]?.id;
      if (!activeId) return setFeatures({});
      const settings = await getSettings(activeId);
      if (!cancelled) setFeatures(settings.features ?? {});
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.schoolId, session]);

  const activeSchool = schools.find((sc) => sc.id === session?.schoolId) ?? null;

  const mine = useMemo(
    () => schoolModules(session?.role, features),
    [session?.role, features],
  );

  if (!ready || !session || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    );
  }

  const hidden = MODULE_REGISTRY.length - mine.length;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="hero-gradient px-5 py-8 text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-bold opacity-80">
              🏫 {platformName}
            </Link>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              {cloudSchoolName ??
                activeSchool?.name ??
                session.schoolName ??
                identity?.scopeLabel ??
                "Your school"}
            </h1>
            <p className="text-sm opacity-85">
              {role.icon} {session.fullName} · {role.name} · {session.accessLevel} access ·{" "}
              {mine.length} modules available
            </p>
            <p className="mt-1 text-xs opacity-70">
              {activeSchool
                ? `${activeSchool.name} · ${activeSchool.country}${activeSchool.region ? `, ${activeSchool.region}` : ""} · ${activeSchool.currency}`
                : session.schoolName ?? "No school selected"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
          <GlobalSearch schoolId={session.schoolId ?? null} />
          <NotificationCenter scopeId={session.schoolId ?? null} />
          {session.role === "super-admin" && schools.length > 0 && (
            <select
              aria-label="Switch school"
              value={session.schoolId ?? ""}
              onChange={(e) => {
                const next = schools.find((sc) => sc.id === e.target.value);
                if (!next) return;
                if (cloud) {
                  setActiveSchoolId(next.id);
                  window.location.reload();
                } else {
                  setSessionSchool(next.id, next.name);
                }
              }}
              className="h-9 rounded-md border border-primary-foreground/30 bg-transparent px-3 text-sm text-primary-foreground [&>option]:text-foreground"
            >
              {schools.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => {
              void logActivity({
                action: "user.signed_out",
                scope: "school",
                scopeId: session.schoolId ?? null,
                detail: { message: `${session.fullName} signed out` },
              })
                .catch(() => undefined)
                .then(() => signOutPortal(cloud))
                .then(() => navigate({ to: "/", replace: true }));
            }}
          >
            Sign out
          </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <DashboardWidgets
          role={session.role}
          fullName={session.fullName}
          accessLevel={session.accessLevel}
          moduleCount={mine.length}
          schoolId={session.schoolId ?? null}
        />

        {MODULE_GROUPS.map((group) => {
          const items = mine.filter((m) => m.group === group);
          if (!items.length) return null;
          return (
            <section key={group} className="mb-10">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                {group}
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <Link
                    key={m.key}
                    to="/modules/$moduleKey"
                    params={{ moduleKey: m.key }}
                    className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-lift"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{m.icon}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {m.route ? "Live" : "Coming soon"}
                      </span>
                    </div>
                    <h3 className="mt-3 font-bold">{m.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-primary">
                      {m.accessLevel} access
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {hidden > 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {hidden} additional module{hidden === 1 ? "" : "s"} exist in this school portal but are
            not available at your access level.
          </p>
        )}
      </main>
    </div>
  );
}
