import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ROLES, readUsers, type RoleId } from "@/lib/access-control";
import { signIn, useSession } from "@/lib/session";
import { accessibleModules } from "@/lib/modules";
import { ensureSeeded, listSchools, type School } from "@/lib/tenancy";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scholaris — Unified School Management Portal" },
      {
        name: "description",
        content:
          "Scholaris is the single sign-in entry point for schools: one portal for Super Admin, Admin, Staff, Student and Parent, with modules unlocked by access level.",
      },
      { property: "og:title", content: "Scholaris — Unified School Management Portal" },
      {
        property: "og:description",
        content:
          "One secure entry point for every school role. Sign in and your workspace shows only the modules your access level permits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: "🔐",
    title: "One secure entry point",
    text: "A single sign-in for every school, every role — no separate systems to remember.",
  },
  {
    icon: "🎚️",
    title: "Access-level driven",
    text: "Four access levels — Basic, Standard, Admin, Super Admin — decide what each user can open.",
  },
  {
    icon: "🏫",
    title: "Unlimited schools",
    text: "Multi-tenant by design: education levels, school types and subjects are configurable per school.",
  },
  {
    icon: "🧩",
    title: "Modular by design",
    text: "Modules plug into one registry; the portal, navigation and permissions update automatically.",
  },
  {
    icon: "🌍",
    title: "Built to scale",
    text: "Storage-agnostic data layer with tenant isolation, ready for national and international rollout.",
  },
  {
    icon: "📜",
    title: "Auditable",
    text: "Every account creation and access decision is recorded for compliance review.",
  },
];

const STEPS = [
  { n: "01", title: "Sign in", text: "Authenticate once at the main portal with your school credentials." },
  { n: "02", title: "Your workspace loads", text: "Role and access level resolve the exact modules you may open." },
  { n: "03", title: "Work in your school portal", text: "Modules open inside your school's portal — never on this landing page." },
];

const ROLE_SUMMARY = ROLES.map((r) => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  level: r.level,
  tagline: r.tagline,
  accent: r.accent,
}));

function Landing() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<RoleId>("staff");
  const [identifier, setIdentifier] = useState("");
  const [setupComplete, setSetupComplete] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const { session, ready } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    setSetupComplete(readUsers().some((user) => user.role === "super-admin"));
    void (async () => {
      await ensureSeeded();
      const rows = (await listSchools()).filter((sc) => sc.active);
      setSchools(rows);
      setSchoolId((prev) => prev || rows[0]?.id || "");
    })();
  }, []);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    const school = schools.find((sc) => sc.id === schoolId);
    signIn({ identifier, role, schoolId: school?.id, schoolName: school?.name });
    navigate({ to: "/portal" });
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a href="#top" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="text-xl">🏫</span> Scholaris
          </a>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#platform" className="transition-colors hover:text-foreground">Platform</a>
            <a href="#roles" className="transition-colors hover:text-foreground">Access levels</a>
            <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
            {setupComplete ? (
              <Button variant="ghost" size="sm" disabled>
                Setup complete
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/setup">Setup</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/national">National</Link>
            </Button>
          </nav>
          {ready && session ? (
            <Button size="sm" asChild>
              <Link to="/portal">Go to portal</Link>
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/auth">Cloud sign-in</Link>
              </Button>
              <Button size="sm" onClick={() => setOpen(true)}>Sign in</Button>
            </div>
          )}
        </div>
      </header>

      <main id="top">
        <section className="hero-gradient px-5 py-20 text-primary-foreground">
          <div className="mx-auto max-w-3xl text-center">
            <span className="rounded-full border border-primary-foreground/25 px-4 py-1.5 text-xs font-bold uppercase tracking-widest">
              NATIONAL EDUCATION DIGITAL ECOSYSTEM
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              One sign-in for your entire school
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base opacity-85">
              Scholaris authenticates you once, then opens the school portal with exactly the
              modules your role and access level permit — nothing more, nothing less.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button variant="secondary" size="lg" onClick={() => setOpen(true)}>
                Sign in to your portal
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                asChild
              >
                <a href="#platform">Learn more</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">Why schools run on Scholaris</h2>
            <p className="mt-2 text-muted-foreground">
              Centralised, reusable and configurable — from a single school to a national network.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-card">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="roles" className="bg-secondary/50 px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-extrabold tracking-tight">Five roles, four access levels</h2>
              <p className="mt-2 text-muted-foreground">
                Roles describe who you are. Access levels decide what opens after you sign in.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {ROLE_SUMMARY.map((r) => (
                <article
                  key={r.id}
                  className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-card"
                >
                  <span className={`absolute inset-x-0 top-0 h-1 ${r.accent}`} />
                  <div className="text-3xl">{r.icon}</div>
                  <h3 className="mt-4 text-lg font-bold">{r.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.tagline}</p>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-primary">
                    {r.level}
                  </p>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-muted-foreground">
              Modules are never listed here. They live inside each school portal and appear only
              after authentication, filtered by access level.
            </p>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold tracking-tight">How it works</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <article key={s.n} className="rounded-xl border border-border bg-card p-6 shadow-card">
                <span className="text-sm font-extrabold text-accent">{s.n}</span>
                <h3 className="mt-2 font-bold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-surface-deep px-5 py-12 text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-extrabold">🏫 Scholaris</h3>
            <p className="mt-1 text-sm opacity-70">Comprehensive educational management platform.</p>
          </div>
          <div className="text-sm opacity-70">
            <p>📧 eduquizlms@gmail.com</p>
            <p>📞 +233 50 596 5310</p>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl border-t border-primary-foreground/15 pt-6 text-xs opacity-60">
          © 2026 Scholaris. All rights reserved.
        </p>
      </footer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign in to Scholaris</DialogTitle>
            <DialogDescription>
              Your workspace loads with the modules your access level permits.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="username">Username or email</Label>
              <Input
                id="username"
                required
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="school">School</Label>
              <select
                id="school"
                required
                value={schoolId}
                onChange={(e) => setSchoolId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {schools.length === 0 && <option value="">No school provisioned yet</option>}
                {schools.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name} — {sc.country}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Each school runs independently inside the national ecosystem. Super Admins can
                switch schools after sign-in.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role">Sign in as</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as RoleId)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.level}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Registered accounts keep their stored role. This grants{" "}
                {accessibleModules(role).length} modules.
              </p>
            </div>
            <Button type="submit" className="w-full">Login</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
