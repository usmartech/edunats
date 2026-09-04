import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatformIdentity } from "@/lib/platform";
import {
  fetchCountries,
  fetchRegions,
  fetchGeoUnits,
  type Country,
  type Region,
  type GeoUnit,
} from "@/lib/hierarchy";
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
  const [mmdas, setMmdas] = useState<GeoUnit[]>([]);
  const [subMetros, setSubMetros] = useState<GeoUnit[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    schoolName: "",
    proposedCode: "",
    countryId: "",
    regionId: "",
    mmdaId: "",
    subMetroId: "",
    localityName: "",
    district: "",
    postalAddress: "",
    nearestLandmark: "",
    areaCommunity: "",
    gpsLat: "",
    gpsLng: "",
    digitalAddress: "",
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

  // MMDAs of the selected region (GSS 2021 PHC administrative geography).
  useEffect(() => {
    if (form.regionId) void fetchGeoUnits("MMDA", { regionId: form.regionId }).then(setMmdas);
    else setMmdas([]);
  }, [form.regionId]);

  // Sub-metros only exist under some metropolitan assemblies.
  useEffect(() => {
    if (form.mmdaId) void fetchGeoUnits("SUBMETRO", { parentId: form.mmdaId }).then(setSubMetros);
    else setSubMetros([]);
  }, [form.mmdaId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!identity) {
      toast.error("Sign in first, then register your school.");
      void navigate({ to: "/auth" });
      return;
    }
    setBusy(true);
    try {
      const selectedMmda = mmdas.find((m) => m.id === form.mmdaId);
      await register({
        data: {
          schoolName: form.schoolName,
          proposedCode: form.proposedCode,
          countryId: form.countryId,
          regionId: form.regionId || null,
          mmdaId: form.mmdaId || null,
          subMetroId: form.subMetroId || null,
          localityId: null,
          localityName: form.localityName || null,
          district: form.district || selectedMmda?.name || null,
          postalAddress: form.postalAddress,
          nearestLandmark: form.nearestLandmark,
          areaCommunity: form.areaCommunity || null,
          gpsLat: form.gpsLat ? Number(form.gpsLat) : null,
          gpsLng: form.gpsLng ? Number(form.gpsLng) : null,
          digitalAddress: form.digitalAddress || null,
          typeCode: form.typeCode,
          levelCodes: [],
          contactPhone: form.contactPhone || null,
        },
      });
      toast.success(
        "School registration submitted. It has been sent to your regional administrator for review & confirmation.",
      );
      void navigate({ to: "/" });
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
            Submit your school registration. It will automatically be sent as a registration request to your regional administrator for review and confirmation, followed by national administrator final approval before full operational module access is granted.
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
                onChange={(e) =>
                  setForm({ ...form, regionId: e.target.value, mmdaId: "", subMetroId: "" })
                }
                required
              >
                <option value="">Select region…</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mmda">District assembly (MMDA)</Label>
              <select
                id="mmda"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.mmdaId}
                onChange={(e) => setForm({ ...form, mmdaId: e.target.value, subMetroId: "" })}
                disabled={mmdas.length === 0}
                required
              >
                <option value="">
                  {form.regionId ? "Select assembly…" : "Choose a region first"}
                </option>
                {mmdas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit_type})
                  </option>
                ))}
              </select>
            </div>
            {subMetros.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="submetro">Sub-metropolitan district</Label>
                <select
                  id="submetro"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.subMetroId}
                  onChange={(e) => setForm({ ...form, subMetroId: e.target.value })}
                >
                  <option value="">Not applicable</option>
                  {subMetros.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="locality">Locality / town</Label>
              <Input
                id="locality"
                value={form.localityName}
                onChange={(e) => setForm({ ...form, localityName: e.target.value })}
                placeholder="e.g. Adenta Housing Down"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalAddress">Postal address *</Label>
              <Input
                id="postalAddress"
                value={form.postalAddress}
                onChange={(e) => setForm({ ...form, postalAddress: e.target.value })}
                placeholder="e.g. P.O. Box AD 145, Adenta"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landmark">Nearest landmark *</Label>
              <Input
                id="landmark"
                value={form.nearestLandmark}
                onChange={(e) => setForm({ ...form, nearestLandmark: e.target.value })}
                placeholder="e.g. Opposite Adenta Police Station"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area">Area / suburb / community</Label>
              <Input
                id="area"
                value={form.areaCommunity}
                onChange={(e) => setForm({ ...form, areaCommunity: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="digital">Digital address (GhanaPostGPS)</Label>
              <Input
                id="digital"
                value={form.digitalAddress}
                onChange={(e) => setForm({ ...form, digitalAddress: e.target.value })}
                placeholder="e.g. GA-183-4290"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lat">GPS latitude</Label>
              <Input
                id="lat"
                inputMode="decimal"
                value={form.gpsLat}
                onChange={(e) => setForm({ ...form, gpsLat: e.target.value })}
                placeholder="5.6037"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lng">GPS longitude</Label>
              <Input
                id="lng"
                inputMode="decimal"
                value={form.gpsLng}
                onChange={(e) => setForm({ ...form, gpsLng: e.target.value })}
                placeholder="-0.1870"
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
