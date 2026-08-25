import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithEmail } from "@/lib/platform";
import { bootstrapPlatform, getBootstrapState } from "@/lib/registration.functions";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "First-time setup — Create the Super Admin" },
      {
        name: "description",
        content:
          "One-time platform setup: name the platform, create the country and the super administrator account that governs the entire system.",
      },
      { property: "og:title", content: "First-time setup — Create the Super Admin" },
      {
        property: "og:description",
        content: "Name the platform and create the super administrator account. Runs once.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    platformName: "EduNat",
    tagline: "National education digital ecosystem",
    countryName: "Ghana",
    countryCode: "GH",
    fullName: "",
    email: "",
    password: "",
  });
  const state = useServerFn(getBootstrapState);
  const bootstrap = useServerFn(bootstrapPlatform);

  useEffect(() => {
    void state()
      .then((r) => setDone(r.bootstrapped))
      .finally(() => setChecking(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await bootstrap({ data: form });
      await signInWithEmail({ email: form.email, password: form.password });
      toast.success("Platform ready. Welcome, Super Admin.");
      window.location.href = "/platform";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Checking platform status…
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-extrabold">Setup already completed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This platform has a super administrator. National administrators are created from the
            super admin dashboard; schools register themselves.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild>
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/register-school">Register a school</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="hero-gradient px-5 py-10 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-sm font-bold opacity-80"
            type="button"
          >
            ← Back
          </button>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">First-time setup</h1>
          <p className="mt-1 text-sm opacity-85">
            Runs once. It creates the platform identity, the first country and the super
            administrator — the only account that can edit or delete anything in the system.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <form onSubmit={onSubmit} className="space-y-6 rounded-xl border border-border bg-card p-6">
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Platform
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platformName">Platform name</Label>
                <Input
                  id="platformName"
                  value={form.platformName}
                  onChange={(e) => setForm({ ...form, platformName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="countryName">Country</Label>
                <Input
                  id="countryName"
                  value={form.countryName}
                  onChange={(e) => setForm({ ...form, countryName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="countryCode">Country code</Label>
                <Input
                  id="countryCode"
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                  placeholder="GH"
                  maxLength={3}
                  required
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Super administrator
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  minLength={8}
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              National administrators are created afterwards from the super admin dashboard. School
              administrators are created automatically when a school registers.
            </p>
          </section>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Setting up…" : "Complete setup"}
          </Button>
        </form>
      </main>
    </div>
  );
}
