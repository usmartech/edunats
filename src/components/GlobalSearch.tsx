import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SEARCH_DOMAINS,
  searchSchool,
  searchSchools,
  type SearchCriteria,
  type SearchHit,
} from "@/lib/search";
import { formatDate } from "@/lib/utils";

/**
 * Port of the legacy advanced search panel (term + module + date range +
 * status). Two modes: inside a school it searches that school's records;
 * on an oversight dashboard it searches the school register within the
 * admin's scope.
 */
export function GlobalSearch({
  schoolId,
  oversight,
  scope,
}: {
  schoolId?: string | null;
  oversight?: boolean;
  scope?: { countryId?: string | null; regionId?: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [criteria, setCriteria] = useState<SearchCriteria>({});

  const set = (patch: Partial<SearchCriteria>) => setCriteria((c) => ({ ...c, ...patch }));

  async function run() {
    if (!criteria.term && !criteria.domain && !criteria.startDate && !criteria.endDate && !criteria.status) {
      setHits([]);
      return;
    }
    setBusy(true);
    try {
      const rows = oversight
        ? await searchSchools(criteria, scope)
        : await searchSchool(schoolId ?? null, criteria);
      setHits(rows);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
        onClick={() => setOpen((v) => !v)}
      >
        🔍 Search
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(34rem,92vw)] rounded-xl border border-border bg-card p-4 text-foreground shadow-lift">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Search term"
              value={criteria.term ?? ""}
              onChange={(e) => set({ term: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && void run()}
            />
            {oversight ? (
              <Input
                placeholder="Status (active, suspended…)"
                value={criteria.status ?? ""}
                onChange={(e) => set({ status: e.target.value })}
              />
            ) : (
              <select
                aria-label="Module"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={criteria.domain ?? ""}
                onChange={(e) => set({ domain: e.target.value as SearchCriteria["domain"] })}
              >
                <option value="">All modules</option>
                {SEARCH_DOMAINS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            )}
            <Input
              type="date"
              aria-label="From date"
              value={criteria.startDate ?? ""}
              onChange={(e) => set({ startDate: e.target.value })}
            />
            <Input
              type="date"
              aria-label="To date"
              value={criteria.endDate ?? ""}
              onChange={(e) => set({ endDate: e.target.value })}
            />
          </div>

          <div className="mt-3 flex gap-2">
            <Button onClick={() => void run()} disabled={busy}>
              {busy ? "Searching…" : "Search"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCriteria({});
                setHits(null);
              }}
            >
              Clear
            </Button>
          </div>

          {hits && (
            <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-border">
              {hits.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">No results found</p>
              ) : (
                hits.map((h, i) => (
                  <div key={`${h.type}-${i}`} className="border-b border-border p-3 last:border-0">
                    <p className="text-sm font-semibold">{h.title}</p>
                    <p className="text-sm text-muted-foreground">{h.description}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {h.type} · {formatDate(h.timestamp)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
