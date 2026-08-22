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

export function OversightDashboard({ filter }: { filter: Filter }) {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [pending, setPending] = useState<RegistrationRow[]>([]);
  const [busy, setBusy] = useState(false);
  const review = useServerFn(reviewSchoolRegistration);

  const load = useCallback(async () => {
    const [rows, regs] = await Promise.all([fetchSchools(filter), fetchRegistrations("pending")]);
    setSchools(rows);
    setPending(regs);
  }, [filter.countryId, filter.regionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      await review({ data: { registrationId: id, decision, reason: null } });
      toast.success(decision === "approve" ? "School approved" : "Registration rejected");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not complete the review");
    } finally {
      setBusy(false);
    }
  }

  const active = schools.filter((s) => s.active).length;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Registered schools" value={schools.length} />
        <Stat label="Active" value={active} />
        <Stat label="Pending registrations" value={pending.length} />
      </div>

      {pending.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Registration requests
          </h2>
          <div className="mt-4 space-y-3">
            {pending.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="font-bold">{r.school_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.proposed_code} · {r.district ?? "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy} onClick={() => void decide(r.id, "approve")}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void decide(r.id, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
