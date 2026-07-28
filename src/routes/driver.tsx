import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteHeader } from "@/components/site-header";
import type { Order } from "@/types/db";

export const Route = createFileRoute("/driver")({
  head: () => ({
    meta: [
      { title: "Driver — Spicy Bite" },
      { name: "description", content: "Delivery driver dashboard." },
      { property: "og:title", content: "Driver — Spicy Bite" },
      { property: "og:description", content: "Delivery driver dashboard." },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const router = useRouter();
  const { user, roles, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [loading, user, router]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("orders").select("*")
      .eq("assigned_driver_id", user.id)
      .in("status", ["ready", "out_for_delivery", "delivered"])
      .order("created_at", { ascending: false }).limit(50);
    setOrders((data ?? []) as Order[]);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel(`orders-driver-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `assigned_driver_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  if (loading) return <div className="min-h-screen"><SiteHeader /><div className="p-8 text-center">Loading…</div></div>;
  if (!user) return null;
  if (!roles.includes("driver") && !roles.includes("admin")) {
    return <div className="min-h-screen"><SiteHeader /><div className="p-8 text-center">Not authorized. <Link to="/" className="text-primary underline">Home</Link></div></div>;
  }

  const markOut = async (o: Order) => {
    const { error } = await supabase.from("orders").update({ status: "out_for_delivery" }).eq("id", o.id);
    if (error) toast.error(error.message);
  };
  const markDelivered = async (o: Order) => {
    const { error } = await supabase.from("orders").update({ status: "delivered" }).eq("id", o.id);
    if (error) toast.error(error.message);
    else toast.success("Marked delivered");
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="font-display text-4xl"><span className="text-primary">DRIVER</span> ROUTES</h1>
        <div className="mt-6 space-y-2">
          {orders.map((o) => (
            <div key={o.id} className="rounded-md border border-border/60 bg-card p-4">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg text-gold">{o.order_code}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{o.status}</span>
                <span className="ml-auto font-display text-lg">Rs {Math.round(o.subtotal)}</span>
              </div>
              <div className="mt-2 text-sm">{o.customer_name}</div>
              <a href={`tel:${o.customer_phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                <Phone className="h-3 w-3" /> {o.customer_phone}
              </a>
              <div className="mt-1 text-sm text-muted-foreground">{o.address}</div>
              <div className="mt-3 flex gap-2">
                {o.status === "ready" && (
                  <button onClick={() => markOut(o)} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    Pick up (Out for delivery)
                  </button>
                )}
                {o.status === "out_for_delivery" && (
                  <button onClick={() => markDelivered(o)} className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white">
                    <CheckCircle2 className="h-3 w-3" /> Mark delivered
                  </button>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && <div className="py-8 text-center text-muted-foreground">No deliveries assigned.</div>}
        </div>
      </div>
    </div>
  );
}
