import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchNationalOverview,
  usePlatformIdentity,
  type NationalRow,
} from "@/lib/platform";

export const Route = createFileRoute("/national")({
  head: () => ({
    meta: [
      { title: "National Oversight — Every School at a Glance" },
      {
        name: "description",
        content:
          "Ministry-level oversight across the whole ecosystem: school registry, coverage by region and level, configuration status, staffing and activity rollups.",
      },
      { property: "og:title", content: "National Oversight — Every School at a Glance" },
      {
        property: "og:description",
        content:
          "Centralised oversight of independently operating schools: registry, coverage, configuration and activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NationalPage,
});

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NationalPage() {
  const { identity, ready, switchSchool } = usePlatformIdentity();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const overview = useQuery({
    queryKey: ["national-overview", identity?.userId],
    queryFn: fetchNationalOverview,
    enabled: Boolean(identity?.platformWide),
  });

  const rows: NationalRow[] = overview.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.schoolName, r.schoolCode, r.region ?? "", r.country, r.typeCode]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const regions = new Set(rows.map((r) => r.region ?? "Unassigned"));
    const levels = new Set(rows.flatMap((r) => r.levelCodes));
    return {
      schools: rows.length,
      active: rows.filter((r) => r.active).length,
      configured: rows.filter((r) => r.configured).length,
      regions: regions.size,
      levels: levels.size,
      staff: rows.reduce((sum, r) => sum + r.staffCount, 0),
      records: rows.reduce((sum, r) => sum + r.recordCount, 0),
    };
  }, [rows]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading national dashboard…
      </div>
    );
  }

  if (!identity) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="text-xl font-bold">Sign in required</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          National oversight is restricted to platform-level accounts.
        </p>
        <Button onClick={() => void navigate({ to: "/auth" })}>Sign in</Button>
      </div>
    );
  }

  if (!identity.platformWide) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="text-xl font-bold">Not available for your role</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          You are attached to {identity.schoolIds.length || "no"} school
          {identity.schoolIds.length === 1 ? "" : "s"}. Nation-wide oversight is limited to super
          admins and national officers.
        </p>
        <Button variant="outline" onClick={() => void navigate({ to: "/portal" })}>
          Go to my portal
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">🇬 National Oversight</h1>
            <p className="text-xs text-muted-foreground">
              Every school operates independently — this is the centralised view across all of them.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/config">Configuration</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/portal">Portal</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8">
        {overview.isError && (
          <p className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
            Could not load the national rollup: {(overview.error as Error).message}
          </p>
        )}

        <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Schools" value={String(stats.schools)} hint={`${stats.active} active`} />
          <Metric
            label="Configured"
            value={`${stats.configured}/${stats.schools || 0}`}
            hint="Have their own policy set"
          />
          <Metric label="Regions" value={String(stats.regions)} />
          <Metric label="Levels covered" value={String(stats.levels)} />
          <Metric label="Staff records" value={String(stats.staff)} />
          <Metric label="Total records" value={String(stats.records)} />
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">School registry</h2>
            <Input
              className="w-full sm:w-72"
              placeholder="Search name, code, region, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search schools"
            />
          </div>

          {overview.isLoading ? (
            <p className="mt-6 text-sm text-muted-foreground">Loading schools…</p>
          ) : filtered.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No schools yet. Provision the first one from{" "}
              <Link to="/config" className="font-semibold underline underline-offset-4">
                Configuration
              </Link>
              .
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">School</th>
                    <th className="py-2 pr-3">Region</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Levels</th>
                    <th className="py-2 pr-3">Staff</th>
                    <th className="py-2 pr-3">Records</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.schoolId} className="border-b border-border/60">
                      <td className="py-2.5 pr-3">
                        <span className="font-semibold">{row.schoolName}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{row.schoolCode}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {row.region ?? "—"}
                        <span className="block text-xs">{row.country}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{row.typeCode}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {row.levelCodes.length ? row.levelCodes.join(", ") : "—"}
                      </td>
                      <td className="py-2.5 pr-3">{row.staffCount}</td>
                      <td className="py-2.5 pr-3">{row.recordCount}</td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={
                            row.active
                              ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                          }
                        >
                          {row.active ? "Operating" : "Suspended"}
                        </span>
                        {!row.configured && (
                          <span className="ml-2 text-xs text-muted-foreground">unconfigured</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await switchSchool(row.schoolId);
                            await navigate({ to: "/portal" });
                          }}
                        >
                          Enter school
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
