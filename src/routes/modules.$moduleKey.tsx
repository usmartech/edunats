import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePortalSession } from "@/lib/portal-session";
import { getModule, hasModuleAccess, moduleEnabledForSchool } from "@/lib/modules";
import { setTenantContext } from "@/lib/data/tenant";
import { getSettings } from "@/lib/tenancy";

export const Route = createFileRoute("/modules/$moduleKey")({
  head: () => ({
    meta: [
      { title: "Module — Scholaris School Management" },
      {
        name: "description",
        content: "Access-controlled module workspace inside the Scholaris school portal.",
      },
      { property: "og:title", content: "Module — Scholaris School Management" },
      {
        property: "og:description",
        content: "Access-controlled module workspace inside the Scholaris school portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ModulePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-16">{children}</div>
    </div>
  );
}

function ModulePage() {
  const { moduleKey } = Route.useParams();
  const { session, ready } = usePortalSession();
  const navigate = useNavigate();
  const mod = getModule(moduleKey);
  const [features, setFeatures] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (ready && !session) navigate({ to: "/", replace: true });
  }, [ready, session, navigate]);

  useEffect(() => {
    if (!session) return;
    setTenantContext({
      schoolId: session.schoolId ?? null,
      userId: session.userId,
      role: session.role,
      crossTenant: session.role === "super-admin",
    });
    if (!session.schoolId) return setFeatures({});
    let cancelled = false;
    void getSettings(session.schoolId).then((s) => {
      if (!cancelled) setFeatures(s.features ?? {});
    });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!ready || !session) {
    return <Shell>Loading…</Shell>;
  }

  if (!mod) {
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold">Unknown module</h1>
        <p className="mt-2 text-muted-foreground">No module is registered under “{moduleKey}”.</p>
        <Button className="mt-6" asChild>
          <Link to="/portal">Back to portal</Link>
        </Button>
      </Shell>
    );
  }

  if (!hasModuleAccess(session.role, mod.key)) {
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold">Access denied</h1>
        <p className="mt-2 text-muted-foreground">
          You do not have permission to open {mod.name}. Required access level:{" "}
          <strong>{mod.accessLevel}</strong> — your level is <strong>{session.accessLevel}</strong>.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/portal">Back to portal</Link>
        </Button>
      </Shell>
    );
  }

  if (features && !moduleEnabledForSchool(mod.key, features)) {
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold">Module not enabled</h1>
        <p className="mt-2 text-muted-foreground">
          {mod.name} is not enabled for {session.schoolName ?? "this school"}. Each school
          configures its own modules — ask your school administrator to switch it on.
        </p>
        <Button className="mt-6" asChild>
          <Link to="/portal">Back to portal</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <Link to="/portal" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to portal
      </Link>
      <div className="mt-6 rounded-xl border border-border bg-card p-8 shadow-card">
        <div className="text-4xl">{mod.icon}</div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{mod.name}</h1>
        <p className="mt-2 text-muted-foreground">{mod.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-wider">
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {mod.group}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {mod.accessLevel} access
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
            {mod.roles.length} roles
          </span>
        </div>

        {mod.route ? (
          <div className="mt-8">
            <p className="text-sm text-muted-foreground">
              This module is implemented and lives at <code>{mod.route}</code>.
            </p>
            <Button className="mt-4" asChild>
              <a href={mod.route}>Open {mod.name}</a>
            </Button>
          </div>
        ) : (
          <div className="mt-8 rounded-lg border border-dashed border-border p-5">
            <p className="text-sm font-semibold">Module placeholder</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reserved slot for the {mod.name} module. Drop the implementation in and register its
              route in <code>src/lib/modules.ts</code> — access control, navigation and the portal
              grid pick it up automatically.
            </p>
          </div>
        )}
      </div>
    </Shell>
  );
}
