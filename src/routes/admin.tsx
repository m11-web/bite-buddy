import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteHeader } from "@/components/site-header";
import type { Branch, MenuItem, Order, OrderStatus, Profile, AppRole, UserRole } from "@/types/db";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Spicy Bite" },
      { name: "description", content: "Admin dashboard for Spicy Bite." },
      { property: "og:title", content: "Admin — Spicy Bite" },
      { property: "og:description", content: "Admin dashboard for Spicy Bite." },
    ],
  }),
  component: AdminPage,
});

const STATUSES: OrderStatus[] = ["pending","preparing","ready","out_for_delivery","delivered","cancelled"];

function AdminPage() {
  const router = useRouter();
  const { user, roles, loading } = useAuth();
  const [tab, setTab] = useState<"branches" | "menu" | "orders" | "users">("branches");

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [loading, user, router]);

  if (loading) return <div className="min-h-screen"><SiteHeader /><div className="p-8 text-center">Loading…</div></div>;
  if (!user) return null;
  if (!roles.includes("admin")) {
    return (
      <div className="min-h-screen"><SiteHeader />
        <div className="mx-auto max-w-lg p-8 text-center">
          <h1 className="font-display text-3xl">Not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">You don't have the admin role.</p>
          <Link to="/" className="mt-4 inline-block text-primary underline">Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="font-display text-4xl"><span className="text-primary">ADMIN</span> DASHBOARD</h1>
        <div className="mt-4 flex flex-wrap gap-2 border-b border-border">
          {(["branches","menu","orders","users"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium ${tab===t ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "branches" && <BranchesTab />}
          {tab === "menu" && <MenuTab />}
          {tab === "orders" && <OrdersTab />}
          {tab === "users" && <UsersTab />}
        </div>
      </div>
    </div>
  );
}

function BranchesTab() {
  const [rows, setRows] = useState<Branch[]>([]);
  const [form, setForm] = useState({ name: "", city: "", address: "", lat: "", lng: "", phone: "" });

  const load = async () => {
    const { data } = await supabase.from("branches").select("*").order("created_at");
    setRows((data ?? []) as Branch[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name || !form.city || !form.address) return toast.error("Name, city, address required");
    const { error } = await supabase.from("branches").insert({
      name: form.name, city: form.city, address: form.address,
      lat: form.lat ? Number(form.lat) : null, lng: form.lng ? Number(form.lng) : null,
      phone: form.phone || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Branch added");
    setForm({ name: "", city: "", address: "", lat: "", lng: "", phone: "" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this branch?")) return;
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const toggle = async (b: Branch) => {
    await supabase.from("branches").update({ active: !b.active }).eq("id", b.id);
    load();
  };

  return (
    <div>
      <div className="mb-6 rounded-lg border border-border/60 bg-card p-4">
        <h3 className="font-display text-xl text-gold">Add branch</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="City" value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Latitude" value={form.lat} onChange={(e) => setForm({...form, lat: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Longitude" value={form.lng} onChange={(e) => setForm({...form, lng: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
        </div>
        <button onClick={add} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add branch</button>
      </div>
      <div className="space-y-2">
        {rows.map((b) => (
          <div key={b.id} className="flex items-center gap-4 rounded-md border border-border/60 bg-card p-3">
            <div className="flex-1">
              <div className="font-medium">{b.name} <span className="text-xs text-muted-foreground">• {b.city}</span></div>
              <div className="text-xs text-muted-foreground">{b.address} {b.lat && b.lng ? `• ${b.lat}, ${b.lng}` : ""}</div>
            </div>
            <button onClick={() => toggle(b)} className={`rounded-full px-3 py-1 text-xs ${b.active ? "bg-green-500/20 text-green-300" : "bg-muted text-muted-foreground"}`}>
              {b.active ? "Active" : "Inactive"}
            </button>
            <button onClick={() => del(b.id)} className="text-xs text-destructive hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [form, setForm] = useState({ category: "", name: "", size: "", price: "" });

  useEffect(() => {
    supabase.from("branches").select("*").order("created_at").then(({ data }) => {
      const list = (data ?? []) as Branch[];
      setBranches(list);
      if (list[0]) setBranchId(list[0].id);
    });
  }, []);

  const load = async () => {
    if (!branchId) return;
    const { data } = await supabase.from("menu_items").select("*").eq("branch_id", branchId).order("category");
    setItems((data ?? []) as MenuItem[]);
  };
  useEffect(() => { load(); }, [branchId]);

  const add = async () => {
    if (!branchId || !form.name || !form.category || !form.price) return toast.error("Fill all fields");
    const { error } = await supabase.from("menu_items").insert({
      branch_id: branchId, category: form.category, name: form.name,
      size: form.size || null, price: Number(form.price),
    });
    if (error) return toast.error(error.message);
    setForm({ category: "", name: "", size: "", price: "" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete item?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <div className="mb-4">
        <label className="text-xs text-muted-foreground">Branch</label>
        <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-1 block rounded-md border border-border bg-input px-3 py-2 text-sm">
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div className="mb-4 rounded-lg border border-border/60 bg-card p-4">
        <h3 className="font-display text-xl text-gold">Add item</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input placeholder="Category" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Size (optional)" value={form.size} onChange={(e) => setForm({...form, size: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
        </div>
        <button onClick={add} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add item</button>
      </div>
      <div className="space-y-1 max-h-[60vh] overflow-auto">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-md border border-border/60 bg-card p-2">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{it.category}</span>
            <div className="flex-1 text-sm">{it.name} {it.size && <span className="text-xs text-muted-foreground">({it.size})</span>}</div>
            <div className="font-display text-gold">{Math.round(it.price)}</div>
            <button onClick={() => del(it.id)} className="text-xs text-destructive hover:underline">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filter, setFilter] = useState<{ branch: string; status: string }>({ branch: "", status: "" });

  const load = async () => {
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter.branch) q = q.eq("branch_id", filter.branch);
    if (filter.status) q = q.eq("status", filter.status as OrderStatus);
    const { data } = await q;
    setOrders((data ?? []) as Order[]);
  };

  useEffect(() => {
    supabase.from("branches").select("*").then(({ data }) => setBranches((data ?? []) as Branch[]));
    load();
    const ch = supabase.channel("orders-admin").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  useEffect(() => { load(); }, [filter.branch, filter.status]);

  const setStatus = async (id: string, status: OrderStatus) => {
    await supabase.from("orders").update({ status }).eq("id", id);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select value={filter.branch} onChange={(e) => setFilter({...filter, branch: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm">
          <option value="">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter({...filter, status: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {orders.map((o) => (
          <div key={o.id} className="rounded-md border border-border/60 bg-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-lg text-gold">{o.order_code}</span>
              <span className="text-sm">{o.customer_name} • {o.customer_phone}</span>
              <span className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</span>
              <span className="ml-auto font-display text-lg text-primary">Rs {Math.round(o.subtotal)}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{o.address}</div>
            <div className="mt-2">
              <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as OrderStatus)} className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No orders.</div>}
      </div>
    </div>
  );
}

function UsersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  const load = async () => {
    const [{ data: p }, { data: r }, { data: b }] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("user_roles").select("*"),
      supabase.from("branches").select("*"),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setRoles((r ?? []) as UserRole[]);
    setBranches((b ?? []) as Branch[]);
  };
  useEffect(() => { load(); }, []);

  const rolesFor = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);

  const toggleRole = async (uid: string, role: AppRole, has: boolean) => {
    if (has) await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
    else await supabase.from("user_roles").insert({ user_id: uid, role });
    load();
  };

  const setBranch = async (uid: string, branch_id: string) => {
    await supabase.from("profiles").update({ branch_id: branch_id || null }).eq("id", uid);
    load();
  };

  return (
    <div className="space-y-2">
      {profiles.map((p) => {
        const has = rolesFor(p.id);
        return (
          <div key={p.id} className="rounded-md border border-border/60 bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1">
                <div className="font-medium">{p.full_name || "(no name)"}</div>
                <div className="text-xs text-muted-foreground">{p.id}</div>
              </div>
              {(["admin","manager","driver"] as AppRole[]).map((r) => (
                <button key={r} onClick={() => toggleRole(p.id, r, has.includes(r))}
                  className={`rounded-full px-2 py-1 text-xs ${has.includes(r) ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                  {r}
                </button>
              ))}
              <select value={p.branch_id ?? ""} onChange={(e) => setBranch(p.id, e.target.value)} className="rounded-md border border-border bg-input px-2 py-1 text-xs">
                <option value="">— no branch —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}
