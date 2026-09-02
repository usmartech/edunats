import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { signOutPlatform, type PlatformIdentity } from "@/lib/platform";
import { NotificationCenter } from "@/components/NotificationCenter";
import { GlobalSearch } from "@/components/GlobalSearch";
import { logActivity } from "@/lib/activity";

/**
 * Every dashboard is titled by its own place in the hierarchy: the school
 * name, the region name, the country name, or the platform name.
 */
export function ScopeHeader({
  identity,
  subtitle,
  children,
}: {
  identity: PlatformIdentity;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();

  const badge =
    identity.scope === "platform"
      ? "System Admin"
      : identity.scope === "national"
        ? "National Admin"
        : identity.scope === "regional"
          ? "Regional Admin"
          : "School";

  return (
    <header className="hero-gradient px-5 py-8 text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/" className="text-sm font-bold opacity-80">
            {badge} workspace
          </Link>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{identity.scopeLabel}</h1>
          <p className="text-sm opacity-85">
            {identity.fullName ?? identity.email} · {subtitle ?? `${badge} oversight`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {identity.scope === "platform" && (
            <Link
              to="/manage"
              className="rounded-md border border-primary-foreground/30 px-3 py-2 text-sm font-bold"
            >
              Configuration
            </Link>
          )}
          {identity.activeSchoolId && (
            <Link
              to="/members"
              className="rounded-md border border-primary-foreground/30 px-3 py-2 text-sm font-bold"
            >
              Members
            </Link>
          )}
          {children}

          <Button
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => {
              void signOutPlatform().then(() => navigate({ to: "/", replace: true }));
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
