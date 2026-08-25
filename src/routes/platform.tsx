import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScopeHeader } from "@/components/ScopeHeader";
import { OversightDashboard } from "@/components/OversightDashboard";
import { usePlatformIdentity } from "@/lib/platform";
import { fetchCountries, updatePlatformSettings, type Country } from "@/lib/hierarchy";
import { createNationalAdmin } from "@/lib/registration.functions";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title: "System Admin — Platform Control" },
      {
        name: "description",
        content:
          "Platform-wide control: rename the platform, manage countries, appoint national administrators and oversee every registered school.",
      },
      { property: "og:title", content: "System Admin — Platform Control" },
      {
        property: "og:description",
        content: "Full control over the entire education platform and every registered school.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlatformPage,
});

function PlatformPage() {
  const { identity, ready } = usePlatformIdentity();
  const navigate = useNavigate();
  const [countries, setCountries] = useState<Country[]>([]);
  const [platformName, setPlatformName] = useState("");
  const [admin, setAdmin] = useState({ fullName: "", email: "", password: "", countryId: "" });
  const [busy, setBusy] = useState(false);
  const addNationalAdmin = useServerFn(createNationalAdmin);

  useEffect(() => {
    if (ready && (!identity || identity.scope !== "platform")) navigate({ to: "/", replace: true });
  }, [ready, identity, navigate]);

  useEffect(() => {
    void fetchCountries().then(setCountries);
  }, []);

  useEffect(() => {
    if (identity) setPlatformName(identity.scopeLabel);
  }, [identity?.scopeLabel]);

  if (!ready || !identity || identity.scope !== "platform") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading platform control…
      </div>
    );
  }

  async function renamePlatform(event: FormEvent) {
    event.preventDefault();
    try {
      await updatePlatformSettings({ platform_name: platformName });
      toast.success("Platform name updated");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename the platform");
    }
  }

  async function submitAdmin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await addNationalAdmin({ data: admin });
      toast.success("National administrator created");
      setAdmin({ fullName: "", email: "", password: "", countryId: admin.countryId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the administrator");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <ScopeHeader identity={identity} subtitle="Full control of the entire system" />

      <div className="mx-auto max-w-6xl px-5 pt-10">
        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={renamePlatform} className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Platform identity
            </h2>
            <div className="mt-4 space-y-2">
              <Label htmlFor="platformName">Platform name</Label>
              <Input
                id="platformName"
                value={platformName}
                onChange={(e) => setPlatformName(e.target.value)}
              />
            </div>
            <Button type="submit" className="mt-4">
              Save
            </Button>
          </form>

          <form onSubmit={submitAdmin} className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
              Appoint a national administrator
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                value={admin.countryId}
                onChange={(e) => setAdmin({ ...admin, countryId: e.target.value })}
                required
              >
                <option value="">Select country…</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="mt-4" disabled={busy}>
              {busy ? "Creating…" : "Create administrator"}
            </Button>
          </form>
        </div>
      </div>

      <OversightDashboard filter={{}} />
    </div>
  );
}
