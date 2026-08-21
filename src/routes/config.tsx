import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { COLLECTIONS, db } from "@/lib/data/provider";
import {
  ensureSeeded,
  getSettings,
  listLevels,
  listSchoolTypes,
  listSchools,
  listSubjects,
  saveSettings,
  type EducationLevel,
  type School,
  type SchoolType,
  type Subject,
  type TenantSettings,
} from "@/lib/tenancy";
import { getModule } from "@/lib/modules";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Super Admin Configuration — Schools, Levels & Subjects" },
      {
        name: "description",
        content:
          "Configure unlimited schools, education levels, school types, subjects, positions, departments and grading — tenant by tenant.",
      },
      { property: "og:title", content: "Super Admin Configuration — Scholaris" },
      {
        property: "og:description",
        content: "Central control plane for schools, education levels, school types, subjects and per-tenant policy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConfigPage,
});

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SECTIONS = [
  { id: "schools", label: "🏫 Schools" },
  { id: "levels", label: "🎓 Education levels" },
  { id: "types", label: "🏷️ School types" },
  { id: "subjects", label: "📚 Subjects & courses" },
  { id: "policy", label: "⚙️ Tenant policy" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function ConfigPage() {
  const [section, setSection] = useState<SectionId>("schools");
  const [schools, setSchools] = useState<School[]>([]);
  const [levels, setLevels] = useState<EducationLevel[]>([]);
  const [types, setTypes] = useState<SchoolType[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [settings, setSettings] = useState<TenantSettings | null>(null);

  const load = useCallback(async (preferred?: string) => {
    await ensureSeeded();
    const [s, l, t] = await Promise.all([listSchools(), listLevels(), listSchoolTypes()]);
    setSchools(s);
    setLevels(l);
    setTypes(t);
    const active = s.find((x) => x.id === preferred) ?? s[0];
    if (active) {
      setSchoolId(active.id);
      setSubjects(await listSubjects(active.id));
      setSettings(await getSettings(active.id));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!schoolId) return;
    (async () => {
      setSubjects(await listSubjects(schoolId));
      setSettings(await getSettings(schoolId));
    })();
  }, [schoolId]);

  function friendlyError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/duplicate key|unique constraint/i.test(message)) {
      return "That code is already in use — pick a different one.";
    }
    if (/permission denied|row-level security|42501/i.test(message)) {
      return "Your account is not allowed to make this change.";
    }
    return message;
  }

  async function guard(label: string, run: () => Promise<void>) {
    try {
      await run();
    } catch (err) {
      toast.error(label, { description: friendlyError(err) });
    }
  }

  async function addSchool(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    await guard("Could not provision school", async () => {
      const created = await db.create<School>(COLLECTIONS.schools, {
        name: get("name"),
        code: get("code").toUpperCase(),
        country: get("country"),
        region: get("region"),
        timezone: get("timezone") || "UTC",
        currency: get("currency").toUpperCase() || "USD",
        locale: get("locale") || "en-US",
        typeCode: get("typeCode"),
        levelCodes: f.getAll("levelCodes").map(String),
        active: true,
      } as never);
      form.reset();
      await load(created.id);
      toast.success("School provisioned", { description: `${created.name} is ready to configure.` });
    });
  }

  async function addLevel(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    await guard("Could not add education level", async () => {
      await db.create<EducationLevel>(COLLECTIONS.levels, {
        code: String(f.get("code")).toLowerCase().trim(),
        name: String(f.get("name")).trim(),
        order: Number(f.get("order")) || levels.length + 1,
        active: true,
      } as never);
      form.reset();
      await load(schoolId);
      toast.success("Education level added");
    });
  }

  async function addType(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    await guard("Could not add school type", async () => {
      await db.create<SchoolType>(COLLECTIONS.schoolTypes, {
        code: String(f.get("code")).toLowerCase().trim(),
        name: String(f.get("name")).trim(),
        description: String(f.get("description") ?? ""),
        active: true,
      } as never);
      form.reset();
      await load(schoolId);
      toast.success("School type added");
    });
  }

  async function addSubject(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    await guard("Could not add subject", async () => {
      await db.create<Subject>(COLLECTIONS.subjects, {
        schoolId,
        levelCode: String(f.get("levelCode")),
        code: String(f.get("code")).toUpperCase().trim(),
        name: String(f.get("name")).trim(),
        credits: Number(f.get("credits")) || undefined,
        elective: f.get("elective") === "on",
        active: true,
      } as never);
      form.reset();
      setSubjects(await listSubjects(schoolId));
      toast.success("Subject added");
    });
  }

  async function savePolicy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    const f = new FormData(e.currentTarget);
    const split = (k: string) =>
      String(f.get(k) ?? "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    await guard("Could not save configuration", async () => {
      await saveSettings(settings.id, {
        positions: split("positions"),
        departments: split("departments"),
        scheduleTypes: split("scheduleTypes"),
        gradingSystem: String(f.get("gradingSystem")) as TenantSettings["gradingSystem"],
        academicYearStartMonth: Number(f.get("academicYearStartMonth")) || 9,
        weekStartsOn: String(f.get("weekStartsOn")) as TenantSettings["weekStartsOn"],
        features: Object.fromEntries(
          Object.keys(settings.features).map((key) => [key, f.get(`feature.${key}`) === "on"]),
        ),
      });
      setSettings(await getSettings(schoolId));
      toast.success("Configuration saved");
    });
  }

  const school = schools.find((s) => s.id === schoolId);

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">🛡️ Super Admin Configuration</h1>
            <p className="text-xs text-muted-foreground">Unlimited schools · levels · types · subjects · policy</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/staff">Staff operations</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Portal</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-center gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                section === s.id
                  ? "bg-primary text-primary-foreground shadow-card"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
          <select
            className={`${selectClass} ml-auto w-auto`}
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
        </div>

        <main className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
          {section === "schools" && (
            <section>
              <h2 className="text-lg font-bold">🏫 Provision a school</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Every record in the system is scoped to a school, so tenants scale without code changes.
              </p>
              <form onSubmit={addSchool} className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>School name</Label>
                  <Input name="name" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Short code</Label>
                  <Input name="code" required placeholder="ACCRA01" />
                </div>
                <div className="space-y-1.5">
                  <Label>School type</Label>
                  <select name="typeCode" className={selectClass} required>
                    {types.map((t) => (
                      <option key={t.code} value={t.code}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Input name="country" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Region / state</Label>
                  <Input name="region" />
                </div>
                <div className="space-y-1.5">
                  <Label>Timezone</Label>
                  <Input name="timezone" placeholder="Africa/Accra" />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency (ISO)</Label>
                  <Input name="currency" placeholder="GHS" />
                </div>
                <div className="space-y-1.5">
                  <Label>Locale</Label>
                  <Input name="locale" placeholder="en-GH" />
                </div>
                <div className="space-y-1.5">
                  <Label>Education levels offered</Label>
                  <select name="levelCodes" multiple className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm">
                    {levels.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <Button type="submit">Provision school</Button>
                </div>
              </form>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {schools.map((s) => (
                  <article key={s.id} className="rounded-xl border border-border p-4">
                    <p className="font-semibold">
                      {s.name} <span className="text-xs text-muted-foreground">({s.code})</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {types.find((t) => t.code === s.typeCode)?.name ?? s.typeCode} · {s.country}
                      {s.region ? `, ${s.region}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.currency} · {s.locale} · {s.timezone} · {s.levelCodes.length} levels
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {section === "levels" && (
            <section>
              <h2 className="text-lg font-bold">🎓 Education levels</h2>
              <form onSubmit={addLevel} className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input name="code" required placeholder="post-graduate" />
                </div>
                <div className="space-y-1.5">
                  <Label>Display name</Label>
                  <Input name="name" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Order</Label>
                  <Input name="order" type="number" min="1" />
                </div>
                <div className="sm:col-span-3">
                  <Button type="submit">Add level</Button>
                </div>
              </form>
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {levels.map((l) => (
                  <li key={l.id} className="rounded-lg border border-border p-3 text-sm">
                    <span className="font-semibold">{l.order}. {l.name}</span>{" "}
                    <span className="text-muted-foreground">({l.code})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {section === "types" && (
            <section>
              <h2 className="text-lg font-bold">🏷️ School types</h2>
              <form onSubmit={addType} className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input name="code" required placeholder="charter" />
                </div>
                <div className="space-y-1.5">
                  <Label>Display name</Label>
                  <Input name="name" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input name="description" />
                </div>
                <div className="sm:col-span-3">
                  <Button type="submit">Add type</Button>
                </div>
              </form>
              <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                {types.map((t) => (
                  <li key={t.id} className="rounded-lg border border-border p-3 text-sm">
                    <span className="font-semibold">{t.name}</span>
                    <p className="text-muted-foreground">{t.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {section === "subjects" && (
            <section>
              <h2 className="text-lg font-bold">📚 Subjects & courses — {school?.name}</h2>
              <form onSubmit={addSubject} className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Level</Label>
                  <select name="levelCode" className={selectClass} required>
                    {levels
                      .filter((l) => !school || school.levelCodes.includes(l.code))
                      .map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Code</Label>
                  <Input name="code" required placeholder="MTH" />
                </div>
                <div className="space-y-1.5">
                  <Label>Name</Label>
                  <Input name="name" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Credits</Label>
                  <Input name="credits" type="number" min="0" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="elective" className="size-4" /> Elective
                </label>
                <div className="sm:col-span-3">
                  <Button type="submit">Add subject</Button>
                </div>
              </form>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {subjects.map((s) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <span>
                      <span className="font-semibold">{s.code}</span> — {s.name}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {levels.find((l) => l.code === s.levelCode)?.name ?? s.levelCode}
                        {s.elective ? " · elective" : ""}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await db.remove(COLLECTIONS.subjects, s.id);
                        setSubjects(await listSubjects(schoolId));
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {section === "policy" && settings && (
            <section>
              <h2 className="text-lg font-bold">⚙️ Tenant policy — {school?.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Positions, departments, grading and feature flags are per school; nothing is hard-coded in the UI.
              </p>
              <form onSubmit={savePolicy} className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Positions (comma separated)</Label>
                  <Input name="positions" defaultValue={settings.positions.join(", ")} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Departments (comma separated)</Label>
                  <Input name="departments" defaultValue={settings.departments.join(", ")} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Schedule types (comma separated)</Label>
                  <Input name="scheduleTypes" defaultValue={settings.scheduleTypes.join(", ")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Grading system</Label>
                  <select name="gradingSystem" className={selectClass} defaultValue={settings.gradingSystem}>
                    <option value="letter">Letter grades</option>
                    <option value="percentage">Percentage</option>
                    <option value="gpa">GPA</option>
                    <option value="points">Points</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Academic year starts (month)</Label>
                  <Input
                    name="academicYearStartMonth"
                    type="number"
                    min="1"
                    max="12"
                    defaultValue={settings.academicYearStartMonth}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Week starts on</Label>
                  <select name="weekStartsOn" className={selectClass} defaultValue={settings.weekStartsOn}>
                    <option value="monday">Monday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
                <fieldset className="sm:col-span-2">
                  <legend className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Modules enabled for this school
                  </legend>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {Object.entries(settings.features).map(([key, on]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`feature.${key}`} defaultChecked={on} className="size-4" />
                        {getModule(key)?.name ?? key}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="sm:col-span-2">
                  <Button type="submit">Save configuration</Button>
                </div>
              </form>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
