import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ScopeHeader } from "@/components/ScopeHeader";
import { OversightDashboard } from "@/components/OversightDashboard";
import { usePlatformIdentity } from "@/lib/platform";

export const Route = createFileRoute("/regional")({
  head: () => ({
    meta: [
      { title: "Regional Dashboard — School Oversight" },
      {
        name: "description",
        content:
          "Regional oversight of every registered school in the region, including registration requests awaiting review.",
      },
      { property: "og:title", content: "Regional Dashboard — School Oversight" },
      {
        property: "og:description",
        content: "Every school in your region in one oversight dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RegionalPage,
});

function RegionalPage() {
  const { identity, ready } = usePlatformIdentity();
  const navigate = useNavigate();

  useEffect(() => {
    if (ready && (!identity || identity.scope !== "regional")) navigate({ to: "/", replace: true });
  }, [ready, identity, navigate]);

  if (!ready || !identity || identity.scope !== "regional") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading regional oversight…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <ScopeHeader identity={identity} subtitle="All registered schools in this region" />
      <OversightDashboard filter={{ regionId: identity.regionId }} />
    </div>
  );
}
