import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, ChefHat, Bike, PackageCheck, XCircle, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import type { Order, OrderStatus } from "@/types/db";

export const Route = createFileRoute("/order/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.code} — Spicy Bite` },
      { name: "description", content: "Track your Spicy Bite order in real time." },
      { property: "og:title", content: `Order ${params.code} — Spicy Bite` },
      { property: "og:description", content: "Track your Spicy Bite order in real time." },
    ],
  }),
  component: OrderPage,
});

const STATUS_META: Record<OrderStatus, { label: string; Icon: typeof Clock; color: string }> = {
  pending: { label: "Order received", Icon: Clock, color: "text-gold" },
  preparing: { label: "Preparing", Icon: ChefHat, color: "text-flame" },
  ready: { label: "Ready", Icon: PackageCheck, color: "text-gold" },
  out_for_delivery: { label: "Out for delivery", Icon: Bike, color: "text-primary" },
  delivered: { label: "Delivered", Icon: CheckCircle2, color: "text-green-400" },
  cancelled: { label: "Cancelled", Icon: XCircle, color: "text-destructive" },
};

interface Tracking {
  order: Order;
  driver: { full_name: string | null; phone: string | null } | null;
  location: { lat: number; lng: number; updated_at: string } | null;
}

function OrderPage() {
  const { code } = Route.useParams();
  const [t, setT] = useState<Tracking | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.rpc("get_tracking", { _code: code });
      if (cancelled) return;
      if (!data || !(data as Tracking).order) setNotFound(true);
      else setT(data as Tracking);
    };
    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [code]);

  if (notFound) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-md p-8 text-center">
          <h1 className="font-display text-3xl">Order not found</h1>
          <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Home</Link>
        </div>
      </div>
    );
  }

  const order = t?.order;
  const meta = order ? STATUS_META[order.status] : STATUS_META.pending;
  const Icon = meta.Icon;
  const trackingActive = order?.assigned_driver_id != null;
  const mapSrc = t?.location
    ? `https://maps.google.com/maps?q=${t.location.lat},${t.location.lng}&z=15&output=embed`
    : null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-lg border border-border/60 bg-card p-8 text-center">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Order code</div>
          <div className="mt-1 font-display text-4xl text-gold">{code}</div>
          {order && (
            <>
              <div className={`mt-6 flex flex-col items-center gap-2 ${meta.color}`}>
                <Icon className="h-14 w-14" />
                <div className="font-display text-2xl">{meta.label}</div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 text-left text-sm">
                <div><div className="text-xs text-muted-foreground">Customer</div>{order.customer_name}</div>
                <div><div className="text-xs text-muted-foreground">Phone</div>{order.customer_phone}</div>
                <div className="col-span-2"><div className="text-xs text-muted-foreground">Address</div>{order.address}</div>
                <div><div className="text-xs text-muted-foreground">Total</div><span className="font-display text-lg text-gold">Rs {Math.round(order.subtotal)}</span></div>
                <div><div className="text-xs text-muted-foreground">Placed</div>{new Date(order.created_at).toLocaleString()}</div>
              </div>
            </>
          )}
        </div>

        {/* Track My Order — unlocks when driver is assigned */}
        <div className={`mt-4 rounded-lg border p-5 ${trackingActive ? "border-primary/60 bg-primary/5" : "border-border/60 bg-card opacity-60"}`}>
          <div className="flex items-center gap-2">
            <MapPin className={`h-5 w-5 ${trackingActive ? "text-primary" : "text-muted-foreground"}`} />
            <div className="font-display text-xl">TRACK MY ORDER</div>
            {trackingActive && <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Active</span>}
          </div>
          {!trackingActive && (
            <p className="mt-2 text-sm text-muted-foreground">
              Live tracking will unlock once the branch assigns a driver to your order.
            </p>
          )}
          {trackingActive && (
            <div className="mt-3 space-y-3">
              <div className="rounded-md border border-border/60 bg-background/40 p-3 text-sm">
                <div className="text-xs text-muted-foreground">Your driver</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-medium">{t?.driver?.full_name || "Driver"}</span>
                  {t?.driver?.phone && (
                    <a href={`tel:${t.driver.phone}`} className="ml-auto inline-flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                      <Phone className="h-3 w-3" /> {t.driver.phone}
                    </a>
                  )}
                </div>
              </div>
              {mapSrc ? (
                <div className="overflow-hidden rounded-md border border-border/60">
                  <iframe
                    title="Driver live location"
                    src={mapSrc}
                    className="h-64 w-full"
                    loading="lazy"
                  />
                  <div className="px-3 py-1 text-[10px] text-muted-foreground">
                    Updated {t?.location ? new Date(t.location.updated_at).toLocaleTimeString() : "—"}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                  Waiting for driver to press <span className="text-primary">Start delivery</span>…
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link to="/menu" className="text-sm text-muted-foreground hover:text-primary">← Back to menu</Link>
        </div>
      </div>
    </div>
  );
}
