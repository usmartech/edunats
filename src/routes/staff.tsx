import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  createOffer,
  createReview,
  createSchedule,
  createStaff,
  listOffers,
  listReviews,
  listSchedules,
  listStaff,
  removeOffer,
  removeSchedule,
  removeStaff,
  staffMetrics,
  updateOffer,
  updateStaff,
  type OfferLetter,
  type PerformanceReview,
  type StaffMember,
  type StaffSchedule,
} from "@/lib/staff";
import {
  ensureSeeded,
  formatMoney,
  getSettings,
  listLevels,
  listSchools,
  listSubjects,
  readActiveSchoolId,
  writeActiveSchoolId,
  type EducationLevel,
  type School,
  type Subject,
  type TenantSettings,
} from "@/lib/tenancy";
import { setTenantContext } from "@/lib/data/tenant";

export const Route = createFileRoute("/staff")({
  head: () => ({
    meta: [
      { title: "Staff Operations — Onboarding, Reviews, Scheduling & Offers" },
      {
        name: "description",
        content:
          "Multi-school staff operations: onboarding, directory, performance reviews, scheduling, offer letters and workforce analytics.",
      },
      { property: "og:title", content: "Staff Operations — Scholaris" },
      {
        property: "og:description",
        content:
          "Run onboarding, performance, scheduling, offers and analytics for unlimited schools from one workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StaffPage,
});

const TABS = [
  { id: "onboarding", label: "🚀 Onboarding" },
  { id: "management", label: "👥 Directory" },
  { id: "performance", label: "📈 Performance" },
  { id: "scheduling", label: "📅 Scheduling" },
  { id: "offers", label: "📄 Offer Letters" },
  { id: "analytics", label: "📊 Analytics" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className={`text-2xl font-extrabold tracking-tight ${accent ?? ""}`}>{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function StaffPage() {
  const [tab, setTab] = useState<TabId>("onboarding");
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [levels, setLevels] = useState<EducationLevel[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [offers, setOffers] = useState<OfferLetter[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");

  useEffect(() => {
    (async () => {
      await ensureSeeded();
      const all = await listSchools();
      setSchools(all);
      const stored = readActiveSchoolId();
      const active = all.find((s) => s.id === stored) ?? all[0];
      if (active) setSchoolId(active.id);
      setLevels(await listLevels());
    })();
  }, []);

  const refresh = useCallback(async (id: string) => {
    const [s, r, sc, o, subs, cfg] = await Promise.all([
      listStaff(id),
      listReviews(id),
      listSchedules(id),
      listOffers(id),
      listSubjects(id),
      getSettings(id),
    ]);
    setStaff(s);
    setReviews(r);
    setSchedules(sc);
    setOffers(o);
    setSubjects(subs);
    setSettings(cfg);
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    writeActiveSchoolId(schoolId);
    setTenantContext({ schoolId });
    void refresh(schoolId);
  }, [schoolId, refresh]);

  const school = schools.find((s) => s.id === schoolId);
  const money = (n: number) => formatMoney(n, school?.currency ?? "USD", school?.locale ?? "en-US");
  const metrics = useMemo(() => staffMetrics(staff, reviews, schedules, offers), [staff, reviews, schedules, offers]);

  const visibleStaff = staff.filter(
    (s) =>
      (!deptFilter || s.department === deptFilter) &&
      (!search ||
        `${s.fullName} ${s.email} ${s.position}`.toLowerCase().includes(search.toLowerCase())),
  );

  const schoolLevels = levels.filter((l) => !school || school.levelCodes.includes(l.code));

  async function onOnboard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    await createStaff({
      schoolId,
      fullName: get("fullName"),
      email: get("email"),
      phone: get("phone"),
      position: get("position"),
      department: get("department"),
      levelCode: get("levelCode"),
      subjectCodes: f.getAll("subjectCodes").map(String),
      employmentType: get("employmentType") as StaffMember["employmentType"],
      startDate: get("startDate"),
      salary: Number(get("salary")) || 0,
      status: "active",
    });
    form.reset();
    await refresh(schoolId);
    toast.success("Staff added", { description: `${get("fullName")} joined ${school?.name ?? "the school"}.` });
  }

  async function onReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const staffId = String(f.get("staffId"));
    await createReview({
      schoolId,
      staffId,
      staffName: staff.find((s) => s.id === staffId)?.fullName ?? "Unknown",
      period: String(f.get("period")),
      rating: String(f.get("rating")),
      comments: String(f.get("comments") ?? ""),
      reviewer: "Current user",
    });
    form.reset();
    await refresh(schoolId);
    toast.success("Performance review submitted");
  }

  async function onSchedule(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const staffId = String(f.get("staffId"));
    await createSchedule({
      schoolId,
      staffId,
      staffName: staff.find((s) => s.id === staffId)?.fullName ?? "Unknown",
      date: String(f.get("date")),
      startTime: String(f.get("startTime")),
      endTime: String(f.get("endTime")),
      type: String(f.get("type")),
      subjectCode: String(f.get("subjectCode") ?? ""),
      status: "active",
    });
    form.reset();
    await refresh(schoolId);
    toast.success("Schedule created");
  }

  async function onOffer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    await createOffer({
      schoolId,
      candidateName: String(f.get("candidateName")),
      candidateEmail: String(f.get("candidateEmail")),
      position: String(f.get("position")),
      salary: Number(f.get("salary")) || 0,
      startDate: String(f.get("startDate")),
      status: String(f.get("status")) as OfferLetter["status"],
    });
    form.reset();
    await refresh(schoolId);
    toast.success("Offer letter created");
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">👥 Staff Operations</h1>
            <p className="text-xs text-muted-foreground">
              Onboarding · performance · scheduling · offers · analytics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className={`${selectClass} w-auto`}
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              aria-label="Active school"
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button asChild variant="outline" size="sm">
              <Link to="/config">Configuration</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Portal</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <nav className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          {tab === "onboarding" && (
            <section>
              <h2 className="text-lg font-bold">🚀 Staff Onboarding</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Positions, departments and levels come from this school's configuration.
              </p>
              <form onSubmit={onOnboard} className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <Input name="fullName" required />
                </Field>
                <Field label="Email">
                  <Input name="email" type="email" required />
                </Field>
                <Field label="Phone">
                  <Input name="phone" type="tel" required />
                </Field>
                <Field label="Position">
                  <select name="position" required className={selectClass}>
                    {(settings?.positions ?? []).map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Department">
                  <select name="department" required className={selectClass}>
                    {(settings?.departments ?? []).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Education level">
                  <select name="levelCode" className={selectClass}>
                    <option value="">Not level-specific</option>
                    {schoolLevels.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Employment type">
                  <select name="employmentType" className={selectClass}>
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                    <option value="volunteer">Volunteer</option>
                  </select>
                </Field>
                <Field label="Start date">
                  <Input name="startDate" type="date" required />
                </Field>
                <Field label={`Salary (${school?.currency ?? ""})`}>
                  <Input name="salary" type="number" min="0" step="0.01" required />
                </Field>
                <Field label="Subjects / courses taught">
                  <select name="subjectCodes" multiple className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm">
                    {subjects.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit">Add staff member</Button>
                </div>
              </form>
            </section>
          )}

          {tab === "management" && (
            <section>
              <h2 className="text-lg font-bold">👥 Staff Directory</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Total staff" value={String(metrics.total)} />
                <Stat label="Teachers" value={String(metrics.teachers)} accent="text-role-staff" />
                <Stat label="Admin & managers" value={String(metrics.admins)} accent="text-role-admin" />
                <Stat label="Monthly payroll" value={money(metrics.payroll)} accent="text-role-parent" />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Input
                  placeholder="Search name, email or position"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-xs"
                />
                <select className={`${selectClass} w-auto`} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                  <option value="">All departments</option>
                  {(settings?.departments ?? []).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 space-y-3">
                {visibleStaff.length === 0 && (
                  <p className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">No staff members yet.</p>
                )}
                {visibleStaff.map((s) => (
                  <article key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
                    <div>
                      <p className="font-semibold">
                        {s.fullName}{" "}
                        <span className="ml-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium uppercase">
                          {s.status}
                        </span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {s.position} · {s.department} · {s.employmentType}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.email} · {s.phone} · from {s.startDate} · {money(s.salary)}
                        {s.subjectCodes?.length ? ` · ${s.subjectCodes.join(", ")}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const next = window.prompt("Update salary", String(s.salary));
                          if (next === null) return;
                          await updateStaff(s.id, { salary: Number(next) || 0 });
                          await refresh(schoolId);
                          toast.success("Staff record updated");
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await updateStaff(s.id, { status: s.status === "active" ? "on-leave" : "active" });
                          await refresh(schoolId);
                        }}
                      >
                        {s.status === "active" ? "Set on leave" : "Reactivate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          if (!window.confirm(`Remove ${s.fullName}?`)) return;
                          await removeStaff(s.id);
                          await refresh(schoolId);
                          toast.success("Staff member removed");
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "performance" && (
            <section>
              <h2 className="text-lg font-bold">📈 Performance Management</h2>
              <form onSubmit={onReview} className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Staff member">
                  <select name="staffId" required className={selectClass}>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Review period">
                  <select name="period" required className={selectClass}>
                    <option>Term 1</option>
                    <option>Term 2</option>
                    <option>Term 3</option>
                    <option>Annual</option>
                  </select>
                </Field>
                <Field label="Rating">
                  <select name="rating" required className={selectClass}>
                    {(settings?.ratingScale ?? []).map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.value} — {r.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Comments">
                  <Textarea name="comments" rows={3} />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={staff.length === 0}>
                    Submit review
                  </Button>
                </div>
              </form>

              <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted-foreground">History</h3>
              <div className="mt-3 space-y-2">
                {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews recorded yet.</p>}
                {reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-semibold">
                      {r.staffName} · {r.period} · Rating {r.rating}
                    </p>
                    {r.comments && <p className="text-sm text-muted-foreground">{r.comments}</p>}
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()} · by {r.reviewer}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "scheduling" && (
            <section>
              <h2 className="text-lg font-bold">📅 Staff Scheduling</h2>
              <form onSubmit={onSchedule} className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Staff member">
                  <select name="staffId" required className={selectClass}>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Date">
                  <Input name="date" type="date" required />
                </Field>
                <Field label="Start time">
                  <Input name="startTime" type="time" required />
                </Field>
                <Field label="End time">
                  <Input name="endTime" type="time" required />
                </Field>
                <Field label="Type">
                  <select name="type" required className={selectClass}>
                    {(settings?.scheduleTypes ?? []).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Subject / course">
                  <select name="subjectCode" className={selectClass}>
                    <option value="">None</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={staff.length === 0}>
                    Create schedule
                  </Button>
                </div>
              </form>

              <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted-foreground">Current schedules</h3>
              <div className="mt-3 space-y-2">
                {schedules.length === 0 && <p className="text-sm text-muted-foreground">No schedules yet.</p>}
                {schedules.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {s.staffName} · {s.type}
                        {s.subjectCode ? ` · ${s.subjectCode}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.date} · {s.startTime}–{s.endTime}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await removeSchedule(s.id);
                        await refresh(schoolId);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "offers" && (
            <section>
              <h2 className="text-lg font-bold">📄 Offer Letters</h2>
              <form onSubmit={onOffer} className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Candidate name">
                  <Input name="candidateName" required />
                </Field>
                <Field label="Candidate email">
                  <Input name="candidateEmail" type="email" required />
                </Field>
                <Field label="Position">
                  <select name="position" required className={selectClass}>
                    {(settings?.positions ?? []).map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <Field label={`Salary (${school?.currency ?? ""})`}>
                  <Input name="salary" type="number" min="0" step="0.01" required />
                </Field>
                <Field label="Start date">
                  <Input name="startDate" type="date" required />
                </Field>
                <Field label="Status">
                  <select name="status" required className={selectClass}>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit">Create offer letter</Button>
                </div>
              </form>

              <div className="mt-8 space-y-2">
                {offers.length === 0 && <p className="text-sm text-muted-foreground">No offer letters yet.</p>}
                {offers.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-semibold">
                        {o.candidateName} · {o.position}{" "}
                        <span className="ml-1 rounded-md bg-muted px-2 py-0.5 text-[11px] uppercase">{o.status}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {o.candidateEmail} · {money(o.salary)} · starts {o.startDate}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await updateOffer(o.id, { status: "accepted" });
                          await refresh(schoolId);
                          toast.success("Offer accepted");
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await updateOffer(o.id, { status: "rejected" });
                          await refresh(schoolId);
                        }}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={async () => {
                          await removeOffer(o.id);
                          await refresh(schoolId);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === "analytics" && (
            <section>
              <h2 className="text-lg font-bold">📊 Workforce Analytics</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Stat label="Total staff" value={String(metrics.total)} />
                <Stat label="Teachers" value={String(metrics.teachers)} />
                <Stat label="Payroll" value={money(metrics.payroll)} />
                <Stat label="Average rating" value={metrics.avgRating.toFixed(1)} />
                <Stat label="Active schedules" value={String(metrics.schedules)} />
                <Stat label="Offers (accepted)" value={`${metrics.offers} (${metrics.accepted})`} />
              </div>

              <h3 className="mt-8 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Headcount by department
              </h3>
              <div className="mt-3 space-y-2">
                {Object.entries(metrics.byDepartment).length === 0 && (
                  <p className="text-sm text-muted-foreground">Add staff to see distribution.</p>
                )}
                {Object.entries(metrics.byDepartment).map(([dept, count]) => (
                  <div key={dept}>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{dept}</span>
                      <span>{count}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.round((count / Math.max(metrics.total, 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
