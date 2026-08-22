import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { signOutPlatform, type PlatformIdentity } from "@/lib/platform";

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
      ? "Super Admin"
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
