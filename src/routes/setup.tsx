import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ROLES,
  createAccount,
  getRole,
  passwordScore,
  readUsers,
  type RoleId,
  type StoredUser,
} from "@/lib/access-control";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "System Setup — Create Super Admin & Admin Accounts" },
      {
        name: "description",
        content:
          "First-run setup for SchoolOS: create the Super Administrator account, then consolidated Admin (School Manager) accounts.",
      },
      { property: "og:title", content: "System Setup — SchoolOS" },
      {
        property: "og:description",
        content:
          "Create the Super Administrator and Admin accounts that unlock the unified SchoolOS portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SetupPage,
});

const SETUP_ROLES: RoleId[] = ["super-admin", "admin"];

function SetupPage() {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [tab, setTab] = useState<RoleId>("super-admin");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    setUsers(readUsers());
  }, []);

  const hasSuperAdmin = users.some((u) => u.role === "super-admin");
  const strength = useMemo(() => passwordScore(password), [password]);
  const role = getRole(tab);

  useEffect(() => {
    if (hasSuperAdmin) setTab("admin");
  }, [hasSuperAdmin]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const data = new FormData(e.currentTarget);
    const get = (k: string) => String(data.get(k) ?? "").trim();

    const pwd = get("password");
    const confirm = get("confirmPassword");
    const username = get("username");

    if (strength.score < 3) return setError("Password must be at least 8 characters with upper, lower and a number.");
    if (pwd !== confirm) return setError("Passwords do not match.");
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
      return setError("That username is already taken.");
    if (tab === "super-admin" && hasSuperAdmin)
      return setError("A Super Administrator account already exists.");

    const user = createAccount({
      role: tab,
      fullName: get("fullName"),
      email: get("email"),
      username,
      phone: get("phone"),
      ...(tab === "admin"
        ? { schoolName: get("schoolName"), schoolAddress: get("schoolAddress") }
        : {}),
    });

    setUsers(readUsers());
    setPassword("");
    e.currentTarget.reset();
    setSuccess(`${getRole(user.role).name} account “${user.username}” created with ${user.modules.length} modules.`);
  }

  return (
    <div className="hero-gradient flex min-h-screen items-center justify-center px-5 py-14">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-8 shadow-lift">
        <header className="text-center">
          <div className="text-3xl">🏫</div>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">System Setup</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create the accounts that unlock the unified portal. School Manager is consolidated into Admin.
          </p>
        </header>

        <div className="mt-6 rounded-lg bg-secondary/60 p-3 text-center text-xs font-semibold text-secondary-foreground">
          {hasSuperAdmin
            ? `Super Administrator configured · ${users.length} account${users.length === 1 ? "" : "s"} on this device`
            : "No Super Administrator yet — start here."}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          {SETUP_ROLES.map((id) => {
            const r = getRole(id);
            const disabled = id === "super-admin" && hasSuperAdmin;
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setTab(id);
                  setError(null);
                  setSuccess(null);
                }}
                className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  tab === id ? "bg-card text-foreground shadow-card" : "text-muted-foreground"
                }`}
              >
                {r.icon} {r.name}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" required autoComplete="name" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" required autoComplete="username" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${
                    strength.score >= 4 ? "bg-role-admin" : strength.score >= 3 ? "bg-accent" : "bg-destructive"
                  }`}
                  style={{ width: `${(strength.score / 4) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{strength.label} · min 8 chars, upper, lower, number</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" />
          </div>

          {tab === "admin" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="schoolName">School name</Label>
                <Input id="schoolName" name="schoolName" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="schoolAddress">School address</Label>
                <Input id="schoolAddress" name="schoolAddress" />
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border p-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {role.level} · {role.modules.length} modules
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {role.modules.slice(0, 8).map((m) => (
                <span key={m} className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium">
                  {m}
                </span>
              ))}
              {role.modules.length > 8 && (
                <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium">
                  +{role.modules.length - 8} more
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">{error}</p>
          )}
          {success && (
            <p className="rounded-md bg-secondary p-2.5 text-sm text-secondary-foreground">{success}</p>
          )}

          <Button type="submit" className="w-full">
            Create {role.name} account
          </Button>
        </form>

        {users.length > 0 && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Accounts on this device</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {users.map((u) => (
                <li key={u.id}>
                  {getRole(u.role).icon} {u.fullName} — <span className="font-medium">{getRole(u.role).name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link to="/" className="font-semibold text-primary hover:underline">
            ← Back to the portal
          </Link>{" "}
          · {ROLES.length} roles configured
        </p>
      </div>
    </div>
  );
}
