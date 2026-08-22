import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatformIdentity, setActiveSchoolId } from "@/lib/platform";
import { fetchCountries, fetchRegions, type Country, type Region } from "@/lib/hierarchy";
import { submitSchoolRegistration } from "@/lib/registration.functions";

export const Route = createFileRoute("/register-school")({
  head: () => ({
    meta: [
      { title: "Register your school — Join the national ecosystem" },
      {
        name: "description",
        content:
          "Register your school in a few fields and become its school administrator with full control of every module, user and configuration.",
      },
      { property: "og:title", content: "Register your school" },
      {
        property: "og:description",
        content: "Register a school and become its administrator automatically.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterSchoolPage,
});

function RegisterSchoolPage() {
  const { identity, ready } = usePlatformIdentity();
  const navigate = useNavigate();
  const [countries, setCountries] = useState<Country[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    schoolName: "",
    proposedCode: "",
    countryId: "",
    regionId: "",
    district: "",
    typeCode: "public",
    contactPhone: "",
  });
  const register = useServerFn(submitSchoolRegistration);

  useEffect(() => {
    void fetchCountries().then(setCountries);
  }, []);

  useEffect(() => {
    if (form.countryId) void fetchRegions(form.countryId).then(setRegions);
    else setRegions([]);
  }, [form.countryId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!identity) {
      toast.error("Sign in first, then register your school.");
      void navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    try {
      const result = await register({
        data: {
          schoolName: form.schoolName,
          proposedCode: form.proposedCode,
          countryId: form.countryId,
          regionId: form.regionId || null,
          district: form.district || null,
          typeCode: form.typeCode,
          levelCodes: [],
          contactPhone: form.contactPhone || null,
        },
      });
      if (result.status === "approved" && result.schoolId) {
        setActiveSchoolId(result.schoolId);
        toast.success("School registered. You are now its school administrator.");
        window.location.href = "/portal";
      } else {
        toast.success("Registration submitted for review.");
        void navigate({ to: "/" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register the school");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="hero-gradient px-5 py-10 text-primary-foreground">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="text-sm font-bold opacity-80">
            ← Back
          </Link>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Register your school</h1>
          <p className="mt-1 text-sm opacity-85">
            You become the school administrator with full control of the school, its modules, its
            users and its configuration.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        {ready && !identity && (
          <p className="mb-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            You need an account first.{" "}
            <Link to="/auth" className="font-bold text-primary">
              Sign in or create one
            </Link>
            , then come back here.
          </p>
        )}

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="schoolName">School name</Label>
              <Input
                id="schoolName"
                value={form.schoolName}
                onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proposedCode">School code</Label>
              <Input
                id="proposedCode"
                value={form.proposedCode}
                onChange={(e) => setForm({ ...form, proposedCode: e.target.value })}
                placeholder="e.g. GHS-001"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <select
                id="country"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.countryId}
                onChange={(e) => setForm({ ...form, countryId: e.target.value, regionId: "" })}
                required
              >
                <option value="">Select country…</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <select
                id="region"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.regionId}
                onChange={(e) => setForm({ ...form, regionId: e.target.value })}
              >
                <option value="">Not listed</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">District</Label>
              <Input
                id="district"
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Contact phone</Label>
              <Input
                id="phone"
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={busy || !identity}>
            {busy ? "Registering…" : "Register school"}
          </Button>
        </form>
      </main>
    </div>
  );
}
