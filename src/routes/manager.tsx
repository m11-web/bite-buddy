import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteHeader } from "@/components/site-header";
import type { Order, OrderStatus, Profile } from "@/types/db";

export const Route = createFileRoute("/manager")({
  head: () => ({
    meta: [
      { title: "Manager — Spicy Bite" },
      { name: "description", content: "Branch manager dashboard." },
      { property: "og:title", content: "Manager — Spicy Bite" },
      { property: "og:description", content: "Branch manager dashboard." },
    ],
  }),
  component: ManagerPage,
});

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing", preparing: "ready", ready: "out_for_delivery",
};

function ManagerPage() {
  const router = useRouter();
  const { user, roles, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [drivers, setDrivers] = useState<Profile[]>([]);

  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setProfile(prof as Profile | null);
      if (prof?.branch_id) {
        const { data: driverProfiles } = await supabase.from("profiles").select("*").eq("branch_id", prof.branch_id);
        // Filter to only drivers
        const { data: driverRoles } = await supabase.from("user_roles").select("user_id").eq("role", "driver");
        const driverIds = new Set((driverRoles ?? []).map((r) => r.user_id));
        setDrivers(((driverProfiles ?? []) as Profile[]).filter((p) => driverIds.has(p.id)));
      }
    })();
  }, [user]);

  const load = async () => {
    if (!profile?.branch_id) return;
    const { data } = await supabase.from("orders").select("*")
      .eq("branch_id", profile.branch_id)
      .order("created_at", { ascending: false }).limit(100);
    setOrders((data ?? []) as Order[]);
  };

  useEffect(() => {
    if (!profile?.branch_id) return;
    load();
    const ch = supabase.channel(`orders-manager-${profile.branch_id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `branch_id=eq.${profile.branch_id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.branch_id]);

  if (loading) return <div className="min-h-screen"><SiteHeader /><div className="p-8 text-center">Loading…</div></div>;
  if (!user) return null;
  if (!roles.includes("manager") && !roles.includes("admin")) {
    return <div className="min-h-screen"><SiteHeader /><div className="p-8 text-center">Not authorized. <Link to="/" className="text-primary underline">Home</Link></div></div>;
  }
  if (!profile?.branch_id) {
    return <div className="min-h-screen"><SiteHeader /><div className="p-8 text-center">No branch assigned. Ask admin to assign your branch.</div></div>;
  }

  const advance = async (o: Order) => {
    const next = NEXT[o.status];
    if (!next) return;
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", o.id);
    if (error) toast.error(error.message);
  };

  const assignDriver = async (o: Order, driver_id: string) => {
    const { error } = await supabase.from("orders").update({ assigned_driver_id: driver_id || null }).eq("id", o.id);
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="font-display text-4xl"><span className="text-primary">MANAGER</span> DASHBOARD</h1>
        <div className="space-y-2 mt-6">
          {orders.map((o) => (
            <div key={o.id} className="rounded-md border border-border/60 bg-card p-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-display text-lg text-gold">{o.order_code}</span>
                <span className="text-sm">{o.customer_name} • {o.customer_phone}</span>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{o.status}</span>
                <span className="ml-auto font-display text-lg">Rs {Math.round(o.subtotal)}</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{o.address}</div>
              <div className="mt-2 flex flex-wrap gap-2 items-center">
                {NEXT[o.status] && (
                  <button onClick={() => advance(o)} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    → {NEXT[o.status]}
                  </button>
                )}
                <select value={o.assigned_driver_id ?? ""} onChange={(e) => assignDriver(o, e.target.value)} className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                  <option value="">— assign driver —</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name || d.id.slice(0,8)}</option>)}
                </select>
              </div>
            </div>
          ))}
          {orders.length === 0 && <div className="py-8 text-center text-muted-foreground">No orders yet.</div>}
        </div>
      </div>
    </div>
  );
}
