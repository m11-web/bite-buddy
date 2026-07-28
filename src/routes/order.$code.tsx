import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Clock, ChefHat, Bike, PackageCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import type { Order, OrderStatus } from "@/types/db";

export const Route = createFileRoute("/order/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Order ${params.code} — Spicy Bite` },
      { name: "description", content: "Track your Spicy Bite order status." },
      { property: "og:title", content: `Order ${params.code} — Spicy Bite` },
      { property: "og:description", content: "Track your Spicy Bite order status." },
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

function OrderPage() {
  const { code } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.rpc("get_order_by_code", { _code: code });
      const row = Array.isArray(data) ? (data[0] as Order | undefined) : (data as Order | undefined);
      if (!row) setNotFound(true);
      else setOrder(row);
    };
    load();
    const ch = supabase
      .channel(`order-${code}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `order_code=eq.${code}` }, (payload) => {
        setOrder(payload.new as Order);
      })
      .subscribe();
    const interval = setInterval(load, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
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

  const meta = order ? STATUS_META[order.status] : STATUS_META.pending;
  const Icon = meta.Icon;

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
        <div className="mt-4 text-center">
          <Link to="/menu" className="text-sm text-muted-foreground hover:text-primary">← Back to menu</Link>
        </div>
      </div>
    </div>
  );
}
