import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  usePlatformIdentity,
  landingRoute,
} from "@/lib/platform";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — National Education Digital Ecosystem" },
      {
        name: "description",
        content:
          "Secure single sign-in to the national education ecosystem. Your school, role and permitted modules are resolved automatically after authentication.",
      },
      { property: "og:title", content: "Sign in — National Education Digital Ecosystem" },
      {
        property: "og:description",
        content: "One national identity; each school operates independently inside it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const { identity, ready } = usePlatformIdentity();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && identity) void navigate({ to: landingRoute(identity) });
  }, [ready, identity, navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await signUpWithEmail({ email, password, fullName });
        if (error) throw new Error(error.message);
        toast.success("Account created. Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await signInWithEmail({ email, password });
        if (error) throw new Error(error.message);
        // the identity effect routes to the right layer once roles resolve
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      toast.error("Enter your email first, then tap “Forgot password”.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await requestPasswordReset(email.trim());
      if (error) throw new Error(error.message);
      toast.success("Password reset link sent. Check your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send reset link");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) throw new Error(String(result.error));
      if (result.redirected) return;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-12 font-sans">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-7 shadow-card">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {mode === "signin" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          One national identity. Your school, role and modules load automatically.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          {mode === "signin" && (
            <button
              type="button"
              onClick={onForgotPassword}
              disabled={busy}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </button>
          )}
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
          Continue with Google
        </Button>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button
            type="button"
            className="font-semibold text-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Create an account" : "I already have an account"}
          </button>
          <Link to="/" className="text-muted-foreground hover:text-foreground">
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
