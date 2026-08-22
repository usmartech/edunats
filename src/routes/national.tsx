import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScopeHeader } from "@/components/ScopeHeader";
import { OversightDashboard } from "@/components/OversightDashboard";
import { usePlatformIdentity } from "@/lib/platform";
import { fetchRegions, type Region } from "@/lib/hierarchy";
import { createRegionalAdmin } from "@/lib/registration.functions";

export const Route = createFileRoute("/national")({
  head: () => ({
    meta: [
      { title: "National Dashboard — Country-wide School Oversight" },
      {
        name: "description",
        content:
          "National oversight of every registered school across the country, with regional administrators and registration approvals.",
      },
      { property: "og:title", content: "National Dashboard — Country-wide School Oversight" },
      {
        property: "og:description",
        content: "Every school across the country in one oversight dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NationalPage,
});

function NationalPage() {
  const { identity, ready } = usePlatformIdentity();
  const navigate = useNavigate();
  const [regions, setRegions] = useState<Region[]>([]);
  const [admin, setAdmin] = useState({ fullName: "", email: "", password: "", regionId: "" });
  const [busy, setBusy] = useState(false);
  const addRegionalAdmin = useServerFn(createRegionalAdmin);

  useEffect(() => {
    if (ready && (!identity || identity.scope !== "national")) navigate({ to: "/", replace: true });
  }, [ready, identity, navigate]);

  useEffect(() => {
    if (identity?.countryId) void fetchRegions(identity.countryId).then(setRegions);
  }, [identity?.countryId]);

  if (!ready || !identity || identity.scope !== "national") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading national oversight…
      </div>
    );
  }

  async function submitAdmin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await addRegionalAdmin({ data: admin });
      toast.success("Regional administrator created");
      setAdmin({ fullName: "", email: "", password: "", regionId: admin.regionId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the administrator");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <ScopeHeader identity={identity} subtitle="All registered schools across the country" />

      {regions.length > 0 && (
        <div className="mx-auto max-w-6xl px-5 pt-10">
          <form onSubmit={submitAdmin} className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Appoint a regional administrator
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                placeholder="Full name"
                value={admin.fullName}
                onChange={(e) => setAdmin({ ...admin, fullName: e.target.value })}
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={admin.email}
                onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                required
              />
              <Input
                type="password"
                placeholder="Temporary password"
                value={admin.password}
                onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                minLength={8}
                required
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={admin.regionId}
                onChange={(e) => setAdmin({ ...admin, regionId: e.target.value })}
                required
              >
                <option value="">Select region…</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="mt-4" disabled={busy}>
              {busy ? "Creating…" : "Create administrator"}
            </Button>
          </form>
        </div>
      )}

      <OversightDashboard filter={{ countryId: identity.countryId }} />
    </div>
  );
}
