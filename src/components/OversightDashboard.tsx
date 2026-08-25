import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  fetchRegistrations,
  fetchSchools,
  type RegistrationRow,
  type SchoolRow,
} from "@/lib/hierarchy";
import { reviewSchoolRegistration } from "@/lib/registration.functions";

type Filter = { countryId?: string | null; regionId?: string | null };

const STATUSES = ["pending", "region_confirmed", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending Regional Review",
  region_confirmed: "Regional Confirmed (Awaiting National Approval)",
  approved: "Approved",
  rejected: "Rejected",
};

export function OversightDashboard({ filter }: { filter: Filter }) {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [requests, setRequests] = useState<RegistrationRow[]>([]);
  const [tab, setTab] = useState<Status>("pending");
  const [busy, setBusy] = useState(false);
  const review = useServerFn(reviewSchoolRegistration);

  const load = useCallback(async () => {
    const [rows, regs] = await Promise.all([
      fetchSchools(filter),
      fetchRegistrations(undefined, filter),
    ]);
    setSchools(rows);
    setRequests(regs);
  }, [filter.countryId, filter.regionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "confirm" | "approve" | "reject") {
    let reason: string | null = null;
    if (decision === "reject") {
      reason = window.prompt("Reason for rejecting this registration?") ?? null;
      if (reason === null) return;
    }
    setBusy(true);
    try {
      await review({ data: { registrationId: id, decision, reason } });
      toast.success(
        decision === "confirm"
          ? "Registration confirmed and forwarded to National Admin for final approval."
          : decision === "approve"
          ? "School registration approved and super admin account created!"
          : "Registration rejected",
      );
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the review");
    } finally {
      setBusy(false);
    }
  }

  const active = schools.filter((s) => s.active).length;
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s, requests.filter((r) => r.status === s).length]),
  ) as Record<Status, number>;
  const visible = requests.filter((r) => r.status === tab);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="grid gap-4 sm:grid-cols-5">
        <Stat label="Registered schools" value={schools.length} />
        <Stat label="Active" value={active} />
        <Stat label="Pending Regional" value={counts.pending} />
        <Stat label="Region Confirmed" value={counts.region_confirmed} />
        <Stat label="Rejected requests" value={counts.rejected} />
      </div>

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Registration requests
          </h2>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={tab === s ? "default" : "outline"}
                onClick={() => setTab(s)}
              >
                {STATUS_LABELS[s]} ({counts[s]})
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {visible.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-bold">{r.school_name}</p>
                <p className="text-sm text-muted-foreground">
                  {r.proposed_code} · {r.district ?? "—"} ·{" "}
                  Submitted: {new Date(r.created_at).toLocaleDateString()}
                </p>
                {r.confirmed_at && (
                  <p className="text-xs text-primary mt-0.5">
                    ✓ Confirmed by Regional Admin on {new Date(r.confirmed_at).toLocaleDateString()}
                  </p>
                )}
                {r.status === "rejected" && r.rejection_reason && (
                  <p className="mt-1 text-sm text-destructive">Reason: {r.rejection_reason}</p>
                )}
              </div>
              <div className="flex gap-2">
                {r.status === "pending" && (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => void decide(r.id, "confirm")}>
                      Confirm (Forward to National)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void decide(r.id, "reject")}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {r.status === "region_confirmed" && (
                  <>
                    <Button size="sm" disabled={busy} onClick={() => void decide(r.id, "approve")}>
                      Approve & Create School
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void decide(r.id, "reject")}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {(r.status === "approved" || r.status === "rejected") && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    {r.status}
                    {r.reviewed_at ? ` · ${new Date(r.reviewed_at).toLocaleDateString()}` : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No {STATUS_LABELS[tab].toLowerCase()} registration requests in your scope.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Schools in scope
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
              <h3 className="font-bold">{s.name}</h3>
              <p className="text-sm text-muted-foreground">
                {s.code} · {s.region ?? s.country}
              </p>
              <p className="mt-3 text-[11px] font-bold uppercase tracking-wider text-primary">
                {s.active ? s.status : "inactive"}
              </p>
            </div>
          ))}
          {schools.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No schools registered in this scope yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
    </div>
  );
}
