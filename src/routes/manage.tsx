import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScopeHeader } from "@/components/ScopeHeader";
import { usePlatformIdentity } from "@/lib/platform";
import {
  deleteRegion,
  deleteSchool,
  fetchCountries,
  fetchPlatformSettings,
  fetchRegions,
  fetchSchools,
  saveCountry,
  saveRegion,
  updatePlatformSettings,
  updateSchool,
  type Country,
  type Region,
  type SchoolRow,
} from "@/lib/hierarchy";

export const Route = createFileRoute("/manage")({
  head: () => ({
    meta: [
      { title: "Platform Configuration — Super Admin" },
      {
        name: "description",
        content:
          "Super admin configuration: platform name, countries, regions and every registered school, including the names shown on their dashboards.",
      },
      { property: "og:title", content: "Platform Configuration — Super Admin" },
      {
        property: "og:description",
        content: "Edit the platform name, countries, regions and school display names.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ManagePage,
});

function ManagePage() {
  const { identity, ready } = usePlatformIdentity();
  const navigate = useNavigate();

  const [platformName, setPlatformName] = useState("");
  const [tagline, setTagline] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [newCountry, setNewCountry] = useState({ name: "", code: "" });
  const [newRegion, setNewRegion] = useState({ name: "", code: "", countryId: "" });

  useEffect(() => {
    if (ready && (!identity || identity.scope !== "platform")) navigate({ to: "/", replace: true });
  }, [ready, identity, navigate]);

  const load = useCallback(async () => {
    const [settings, cs, rs, ss] = await Promise.all([
      fetchPlatformSettings(),
      fetchCountries(),
      fetchRegions(),
      fetchSchools(),
    ]);
    if (settings) {
      setPlatformName(settings.platform_name);
      setTagline(settings.tagline ?? "");
      setAutoApprove(settings.auto_approve_registrations);
    }
    setCountries(cs);
    setRegions(rs);
    setSchools(ss);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready || !identity || identity.scope !== "platform") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading configuration…
      </div>
    );
  }

  async function run(action: () => Promise<unknown>, message: string) {
    try {
      await action();
      toast.success(message);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  async function savePlatform(event: FormEvent) {
    event.preventDefault();
    await run(
      () =>
        updatePlatformSettings({
          platform_name: platformName,
          tagline,
          auto_approve_registrations: autoApprove,
        }),
      "Platform settings saved",
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <ScopeHeader identity={identity} subtitle="Platform configuration" />

      <main className="mx-auto max-w-6xl space-y-8 px-5 py-10">
        <form onSubmit={savePlatform} className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Platform identity
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pname">Platform name (super admin dashboard title)</Label>
              <Input id="pname" value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tag">Tagline</Label>
              <Input id="tag" value={tagline} onChange={(e) => setTagline(e.target.value)} />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
            />
            Approve school registrations automatically
          </label>
          <Button type="submit" className="mt-4">
            Save
          </Button>
        </form>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Countries (national dashboard names)
          </h2>
          <div className="mt-4 space-y-3">
            {countries.map((c) => (
              <EditableRow
                key={c.id}
                name={c.name}
                code={c.code}
                active={c.active}
                onSave={(name, code, active) =>
                  run(() => saveCountry({ id: c.id, name, code, active }), "Country updated")
                }
              />
            ))}
          </div>
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => saveCountry(newCountry), "Country added").then(() =>
                setNewCountry({ name: "", code: "" }),
              );
            }}
          >
            <Input
              placeholder="Country name"
              value={newCountry.name}
              onChange={(e) => setNewCountry({ ...newCountry, name: e.target.value })}
              required
              className="max-w-xs"
            />
            <Input
              placeholder="Code"
              value={newCountry.code}
              onChange={(e) => setNewCountry({ ...newCountry, code: e.target.value })}
              required
              className="max-w-[120px]"
            />
            <Button type="submit" variant="outline">
              Add country
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Regions (regional dashboard names)
          </h2>
          <div className="mt-4 space-y-3">
            {regions.map((r) => (
              <EditableRow
                key={r.id}
                name={r.name}
                code={r.code}
                active={r.active}
                onSave={(name, code, active) =>
                  run(
                    () => saveRegion({ id: r.id, countryId: r.country_id, name, code, active }),
                    "Region updated",
                  )
                }
                onDelete={() => run(() => deleteRegion(r.id), "Region deleted")}
              />
            ))}
          </div>
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => saveRegion(newRegion), "Region added").then(() =>
                setNewRegion({ name: "", code: "", countryId: newRegion.countryId }),
              );
            }}
          >
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={newRegion.countryId}
              onChange={(e) => setNewRegion({ ...newRegion, countryId: e.target.value })}
              required
            >
              <option value="">Country…</option>
              {countries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Region name"
              value={newRegion.name}
              onChange={(e) => setNewRegion({ ...newRegion, name: e.target.value })}
              required
              className="max-w-xs"
            />
            <Input
              placeholder="Code"
              value={newRegion.code}
              onChange={(e) => setNewRegion({ ...newRegion, code: e.target.value })}
              required
              className="max-w-[120px]"
            />
            <Button type="submit" variant="outline">
              Add region
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
            Schools (school dashboard names)
          </h2>
          <div className="mt-4 space-y-3">
            {schools.map((s) => (
              <EditableRow
                key={s.id}
                name={s.name}
                code={s.code}
                active={s.active}
                onSave={(name, code, active) =>
                  run(
                    () => updateSchool(s.id, { name, code, active, status: active ? "active" : "suspended" }),
                    "School updated",
                  )
                }
                onDelete={() =>
                  window.confirm(`Delete ${s.name}? This removes the school permanently.`)
                    ? run(() => deleteSchool(s.id), "School deleted")
                    : Promise.resolve()
                }
              />
            ))}
            {schools.length === 0 && (
              <p className="text-sm text-muted-foreground">No schools registered yet.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function EditableRow({
  name,
  code,
  active,
  onSave,
  onDelete,
}: {
  name: string;
  code: string;
  active: boolean;
  onSave: (name: string, code: string, active: boolean) => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState({ name, code, active });
  useEffect(() => setDraft({ name, code, active }), [name, code, active]);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
      <Input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        className="max-w-xs"
      />
      <Input
        value={draft.code}
        onChange={(e) => setDraft({ ...draft, code: e.target.value })}
        className="max-w-[140px]"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
        />
        Active
      </label>
      <Button size="sm" onClick={() => void onSave(draft.name, draft.code, draft.active)}>
        Save
      </Button>
      {onDelete && (
        <Button size="sm" variant="outline" onClick={() => void onDelete()}>
          Delete
        </Button>
      )}
    </div>
  );
}
