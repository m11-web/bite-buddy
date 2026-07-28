import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Flame, MapPin, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSelectedBranchId, setSelectedBranchId, haversineKm } from "@/lib/branch-store";
import { SiteHeader } from "@/components/site-header";
import type { Branch } from "@/types/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spicy Bite — Bite That Hits Different" },
      { name: "description", content: "Find your nearest Spicy Bite branch and order pizza, burgers, wings and more, hot and fast." },
      { property: "og:title", content: "Spicy Bite — Bite That Hits Different" },
      { property: "og:description", content: "Fast food that hits different. Order from your nearest branch." },
    ],
  }),
  component: Home,
});

function Home() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("branches").select("*").eq("active", true).order("city").order("area").then(({ data }) => {
      setBranches((data ?? []) as Branch[]);
    });
    if (!getSelectedBranchId()) setShowPicker(true);
  }, []);

  const byCity = useMemo(() => {
    const map = new Map<string, Branch[]>();
    for (const b of branches) {
      if (!map.has(b.city)) map.set(b.city, []);
      map.get(b.city)!.push(b);
    }
    return Array.from(map.entries());
  }, [branches]);

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported. Pick a branch instead.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const withCoords = branches.filter((b) => b.lat != null && b.lng != null);
        if (withCoords.length === 0) { setDetecting(false); toast.error("No branches available"); return; }
        const nearest = withCoords
          .map((b) => ({ b, d: haversineKm({ lat: pos.coords.latitude, lng: pos.coords.longitude }, { lat: b.lat!, lng: b.lng! }) }))
          .sort((a, z) => a.d - z.d)[0];
        setSelectedBranchId(nearest.b.id);
        toast.success(`Nearest: ${nearest.b.name} (${nearest.d.toFixed(1)} km)`);
        setDetecting(false);
        router.navigate({ to: "/menu" });
      },
      () => {
        setDetecting(false);
        toast.error("Location denied. Please pick a branch.");
      },
      { timeout: 8000 }
    );
  };

  const pickBranch = (b: Branch) => {
    setSelectedBranchId(b.id);
    toast.success(`${b.name} selected`);
    router.navigate({ to: "/menu" });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-background via-background to-secondary" />
        <div className="absolute inset-0 -z-10 opacity-30" style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, var(--flame) 0%, transparent 40%), radial-gradient(circle at 80% 70%, var(--primary) 0%, transparent 45%)",
        }} />
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              <Flame className="h-3 w-3" /> Hot & Fresh
            </div>
            <h1 className="mt-4 font-display text-6xl leading-none md:text-8xl">
              <span className="text-foreground">SPICY </span>
              <span className="text-primary">BITE</span>
            </h1>
            <p className="mt-3 font-display text-2xl text-gold md:text-3xl">Bite That <span className="text-primary">Hits Different</span></p>
            <p className="mt-6 max-w-xl text-muted-foreground">
              Fresh, loaded, and delivered fast. Detect your location or pick your exact branch.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={detectLocation}
                disabled={detecting}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 disabled:opacity-60"
              >
                {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                {detecting ? "Detecting..." : "Detect my location"}
              </button>
              <button
                onClick={() => setShowPicker(true)}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary px-5 py-3 text-sm font-semibold hover:bg-secondary/80"
              >
                Choose branch
              </button>
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-5 py-3 text-sm font-semibold text-gold hover:bg-gold/20"
              >
                Browse menu
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-y border-border/60 bg-secondary/30">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
          {[
            { t: "Hot & Delicious", d: "Fresh from the flame" },
            { t: "Fresh Ingredients", d: "Every single bite" },
            { t: "Cheesy & Loaded", d: "Piled high" },
            { t: "Fast Delivery", d: "To your door" },
          ].map((f) => (
            <div key={f.t} className="rounded-lg border border-border/60 bg-card p-4 text-center">
              <Flame className="mx-auto h-6 w-6 text-flame" />
              <h3 className="mt-2 font-display text-lg text-gold">{f.t}</h3>
              <p className="text-xs text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Branch picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="font-display text-2xl">Choose your branch</h2>
            </div>
            <button
              onClick={() => { setShowPicker(false); detectLocation(); }}
              disabled={detecting}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Auto-detect nearest
            </button>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />OR PICK MANUALLY<div className="h-px flex-1 bg-border" />
            </div>
            <div className="max-h-[50vh] overflow-auto space-y-2">
              {byCity.map(([city, list]) => {
                const open = expandedCity === city;
                return (
                  <div key={city} className="rounded-md border border-border/60">
                    <button
                      onClick={() => setExpandedCity(open ? null : city)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-secondary/50"
                    >
                      <span className="font-display text-lg text-gold">{city}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        {list.length} branch{list.length > 1 ? "es" : ""}
                        <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-border/60 p-2 space-y-1">
                        {list.map((b) => (
                          <button
                            key={b.id}
                            onClick={() => { setShowPicker(false); pickBranch(b); }}
                            className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-primary/10"
                          >
                            <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                            <div className="flex-1">
                              <div className="text-sm font-medium">{b.area}</div>
                              <div className="text-xs text-muted-foreground">{b.address}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {byCity.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">No branches yet.</div>
              )}
            </div>
            <button onClick={() => setShowPicker(false)} className="mt-4 w-full rounded-md border border-border py-2 text-xs text-muted-foreground hover:bg-secondary">
              Close
            </button>
          </div>
        </div>
      )}

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © Spicy Bite. Bite That Hits Different.
      </footer>
    </div>
  );
}
