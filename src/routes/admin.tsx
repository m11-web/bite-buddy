import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Pencil, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { SiteHeader } from "@/components/site-header";
import { uploadImage } from "@/lib/cloudinary";
import type { Branch, MenuItem, Order, OrderStatus, Profile, AppRole, UserRole, BranchMenuItem } from "@/types/db";

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
type Tab = "branches" | "menu" | "availability" | "orders" | "users";

function AdminPage() {
  const router = useRouter();
  const { user, roles, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("branches");

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

  const tabs: Tab[] = ["branches","menu","availability","orders","users"];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="font-display text-4xl"><span className="text-primary">ADMIN</span> DASHBOARD</h1>
        <div className="mt-4 flex flex-wrap gap-2 border-b border-border">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium capitalize ${tab===t ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="mt-6">
          {tab === "branches" && <BranchesTab />}
          {tab === "menu" && <MenuTab />}
          {tab === "availability" && <AvailabilityTab />}
          {tab === "orders" && <OrdersTab />}
          {tab === "users" && <UsersTab />}
        </div>
      </div>
    </div>
  );
}

/* ============ BRANCHES ============ */
function BranchesTab() {
  const [rows, setRows] = useState<Branch[]>([]);
  const [form, setForm] = useState({ name: "", area: "", city: "", address: "", lat: "", lng: "", phone: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Branch>>({});

  const load = async () => {
    const { data } = await supabase.from("branches").select("*").order("city").order("area");
    setRows((data ?? []) as Branch[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name || !form.area || !form.city || !form.address) return toast.error("Name, area, city and address are required");
    const { data: newBranch, error } = await supabase.from("branches").insert({
      name: form.name, area: form.area, city: form.city, address: form.address,
      lat: form.lat ? Number(form.lat) : null, lng: form.lng ? Number(form.lng) : null,
      phone: form.phone || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    // Auto-enable all existing global menu items for the new branch
    const { data: items } = await supabase.from("menu_items").select("id");
    if (newBranch && items && items.length) {
      await supabase.from("branch_menu_items").insert(
        items.map((it: { id: string }) => ({ branch_id: newBranch.id, menu_item_id: it.id, available: true }))
      );
    }
    toast.success("Branch added");
    setForm({ name: "", area: "", city: "", address: "", lat: "", lng: "", phone: "" });
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

  const startEdit = (b: Branch) => { setEditing(b.id); setEdit(b); };
  const cancelEdit = () => { setEditing(null); setEdit({}); };
  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await supabase.from("branches").update({
      name: edit.name, area: edit.area, city: edit.city, address: edit.address,
      phone: edit.phone ?? null,
      lat: edit.lat != null && edit.lat !== ("" as unknown) ? Number(edit.lat) : null,
      lng: edit.lng != null && edit.lng !== ("" as unknown) ? Number(edit.lng) : null,
    }).eq("id", editing);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    cancelEdit();
    load();
  };

  return (
    <div>
      <div className="mb-6 rounded-lg border border-border/60 bg-card p-4">
        <h3 className="font-display text-xl text-gold">Add branch</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <input placeholder="Branch name (e.g. Spicy Bite Cantt)" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Area (e.g. Cantt)" value={form.area} onChange={(e) => setForm({...form, area: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="City (e.g. Multan)" value={form.city} onChange={(e) => setForm({...form, city: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Address" value={form.address} onChange={(e) => setForm({...form, address: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm md:col-span-2" />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Latitude" value={form.lat} onChange={(e) => setForm({...form, lat: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Longitude" value={form.lng} onChange={(e) => setForm({...form, lng: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
        </div>
        <button onClick={add} className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add branch</button>
        <p className="mt-2 text-xs text-muted-foreground">New branches automatically get all menu items enabled — toggle individually in the Availability tab.</p>
      </div>
      <div className="space-y-2">
        {rows.map((b) => (
          <div key={b.id} className="rounded-md border border-border/60 bg-card p-3">
            {editing === b.id ? (
              <div className="grid gap-2 md:grid-cols-3">
                <input value={edit.name ?? ""} onChange={(e) => setEdit({...edit, name: e.target.value})} placeholder="Name" className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <input value={edit.area ?? ""} onChange={(e) => setEdit({...edit, area: e.target.value})} placeholder="Area" className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <input value={edit.city ?? ""} onChange={(e) => setEdit({...edit, city: e.target.value})} placeholder="City" className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <input value={edit.address ?? ""} onChange={(e) => setEdit({...edit, address: e.target.value})} placeholder="Address" className="rounded-md border border-border bg-input px-2 py-1 text-sm md:col-span-2" />
                <input value={edit.phone ?? ""} onChange={(e) => setEdit({...edit, phone: e.target.value})} placeholder="Phone" className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <input value={edit.lat ?? ""} onChange={(e) => setEdit({...edit, lat: e.target.value as unknown as number})} placeholder="Lat" className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <input value={edit.lng ?? ""} onChange={(e) => setEdit({...edit, lng: e.target.value as unknown as number})} placeholder="Lng" className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <div className="flex gap-2 md:col-span-3">
                  <button onClick={saveEdit} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"><Check className="inline h-3 w-3" /> Save</button>
                  <button onClick={cancelEdit} className="rounded-md border border-border px-3 py-1 text-xs"><X className="inline h-3 w-3" /> Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="font-medium">{b.name} <span className="text-xs text-muted-foreground">• {b.area}, {b.city}</span></div>
                  <div className="text-xs text-muted-foreground">{b.address} {b.lat && b.lng ? `• ${b.lat}, ${b.lng}` : ""} {b.phone ? `• ${b.phone}` : ""}</div>
                </div>
                <button onClick={() => toggle(b)} className={`rounded-full px-3 py-1 text-xs ${b.active ? "bg-green-500/20 text-green-300" : "bg-muted text-muted-foreground"}`}>
                  {b.active ? "Active" : "Inactive"}
                </button>
                <button onClick={() => startEdit(b)} className="rounded-md p-2 hover:bg-secondary" title="Edit"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => del(b.id)} className="rounded-md p-2 text-destructive hover:bg-secondary" title="Delete"><Trash2 className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ GLOBAL MENU (with image upload) ============ */
function MenuTab() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [form, setForm] = useState({ category: "", name: "", size: "", price: "" });
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<MenuItem>>({});
  const editFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("menu_items").select("*").order("category").order("name");
    setItems((data ?? []) as MenuItem[]);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name || !form.category || !form.price) return toast.error("Category, name and price required");
    setUploading(true);
    let image_url: string | null = null;
    try {
      if (imgFile) image_url = await uploadImage(imgFile);
    } catch (e) {
      setUploading(false);
      return toast.error((e as Error).message);
    }
    // Insert item and enable on all branches
    const { data: newItem, error } = await supabase.from("menu_items").insert({
      category: form.category, name: form.name,
      size: form.size || null, price: Number(form.price), image_url,
    }).select("id").single();
    if (error) { setUploading(false); return toast.error(error.message); }
    const { data: branches } = await supabase.from("branches").select("id");
    if (newItem && branches && branches.length) {
      await supabase.from("branch_menu_items").insert(
        branches.map((b: { id: string }) => ({ branch_id: b.id, menu_item_id: newItem.id, available: true }))
      );
    }
    setUploading(false);
    toast.success("Item added and enabled on all branches");
    setForm({ category: "", name: "", size: "", price: "" });
    setImgFile(null);
    load();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this item globally?")) return;
    await supabase.from("menu_items").delete().eq("id", id);
    load();
  };

  const toggleActive = async (it: MenuItem) => {
    await supabase.from("menu_items").update({ active: !it.active }).eq("id", it.id);
    load();
  };

  const startEdit = (it: MenuItem) => { setEditing(it.id); setEdit(it); };
  const cancelEdit = () => { setEditing(null); setEdit({}); };

  const saveEdit = async () => {
    if (!editing) return;
    let image_url = edit.image_url ?? null;
    const file = editFileRef.current?.files?.[0];
    if (file) {
      try { image_url = await uploadImage(file); }
      catch (e) { return toast.error((e as Error).message); }
    }
    const { error } = await supabase.from("menu_items").update({
      category: edit.category, name: edit.name,
      size: edit.size || null,
      price: edit.price != null ? Number(edit.price) : 0,
      image_url,
    }).eq("id", editing);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    cancelEdit();
    load();
  };

  const filtered = items.filter((it) =>
    !filter || (it.name + " " + it.category).toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 rounded-lg border border-border/60 bg-card p-4">
        <h3 className="font-display text-xl text-gold">Add menu item</h3>
        <p className="mb-3 text-xs text-muted-foreground">Global item — added to every branch as available. Manage per-branch in the Availability tab.</p>
        <div className="grid gap-2 md:grid-cols-4">
          <input placeholder="Category" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Size (optional)" value={form.size} onChange={(e) => setForm({...form, size: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <input placeholder="Price" type="number" value={form.price} onChange={(e) => setForm({...form, price: e.target.value})} className="rounded-md border border-border bg-input px-3 py-2 text-sm" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-input px-3 py-2 text-xs">
            <Upload className="h-3 w-3" /> {imgFile ? imgFile.name : "Choose image"}
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => setImgFile(e.target.files?.[0] ?? null)} />
          </label>
          <button disabled={uploading} onClick={add} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {uploading ? <Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> : null}
            {uploading ? "Uploading…" : "Add item"}
          </button>
        </div>
      </div>

      <div className="mb-3">
        <input placeholder="Search items…" value={filter} onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border bg-input px-3 py-2 text-sm" />
      </div>

      <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
        {filtered.map((it) => (
          <div key={it.id} className="rounded-md border border-border/60 bg-card p-3">
            {editing === it.id ? (
              <div className="grid gap-2 md:grid-cols-5 items-center">
                <div className="h-16 w-16 overflow-hidden rounded bg-secondary/40">
                  {edit.image_url ? <img src={edit.image_url} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <input value={edit.category ?? ""} onChange={(e) => setEdit({...edit, category: e.target.value})} className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <input value={edit.name ?? ""} onChange={(e) => setEdit({...edit, name: e.target.value})} className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <input value={edit.size ?? ""} onChange={(e) => setEdit({...edit, size: e.target.value})} placeholder="Size" className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <input value={edit.price ?? ""} type="number" onChange={(e) => setEdit({...edit, price: Number(e.target.value)})} className="rounded-md border border-border bg-input px-2 py-1 text-sm" />
                <div className="md:col-span-5 flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-input px-3 py-1 text-xs">
                    <Upload className="h-3 w-3" /> Replace image
                    <input ref={editFileRef} type="file" accept="image/*" className="hidden" />
                  </label>
                  <button onClick={saveEdit} className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"><Check className="inline h-3 w-3" /> Save</button>
                  <button onClick={cancelEdit} className="rounded-md border border-border px-3 py-1 text-xs"><X className="inline h-3 w-3" /> Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded bg-secondary/40">
                  {it.image_url ? <img src={it.image_url} alt={it.name} className="h-full w-full object-cover" /> : null}
                </div>
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{it.category}</span>
                <div className="flex-1 text-sm">{it.name} {it.size && <span className="text-xs text-muted-foreground">({it.size})</span>}</div>
                <div className="font-display text-gold">{Math.round(it.price)}</div>
                <button onClick={() => toggleActive(it)} className={`rounded-full px-2 py-1 text-xs ${it.active ? "bg-green-500/20 text-green-300" : "bg-muted text-muted-foreground"}`}>
                  {it.active ? "Active" : "Hidden"}
                </button>
                <button onClick={() => startEdit(it)} className="rounded-md p-2 hover:bg-secondary"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => del(it.id)} className="rounded-md p-2 text-destructive hover:bg-secondary"><Trash2 className="h-3 w-3" /></button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ PER-BRANCH AVAILABILITY ============ */
function AvailabilityTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [bmi, setBmi] = useState<Map<string, BranchMenuItem>>(new Map());
  const [copyFrom, setCopyFrom] = useState("");

  useEffect(() => {
    supabase.from("branches").select("*").order("city").order("area").then(({ data }) => {
      const list = (data ?? []) as Branch[];
      setBranches(list);
      if (list[0]) setBranchId(list[0].id);
    });
    supabase.from("menu_items").select("*").order("category").order("name").then(({ data }) => {
      setItems((data ?? []) as MenuItem[]);
    });
  }, []);

  const loadBmi = async () => {
    if (!branchId) return;
    const { data } = await supabase.from("branch_menu_items").select("*").eq("branch_id", branchId);
    const map = new Map<string, BranchMenuItem>();
    for (const r of (data ?? []) as BranchMenuItem[]) map.set(r.menu_item_id, r);
    setBmi(map);
  };
  useEffect(() => { loadBmi(); }, [branchId]);

  const toggle = async (item_id: string) => {
    if (!branchId) return;
    const existing = bmi.get(item_id);
    if (existing) {
      await supabase.from("branch_menu_items")
        .update({ available: !existing.available })
        .eq("branch_id", branchId).eq("menu_item_id", item_id);
    } else {
      await supabase.from("branch_menu_items").insert({ branch_id: branchId, menu_item_id: item_id, available: true });
    }
    loadBmi();
  };

  const setPriceOverride = async (item_id: string, value: string) => {
    if (!branchId) return;
    const override = value === "" ? null : Number(value);
    const existing = bmi.get(item_id);
    if (existing) {
      await supabase.from("branch_menu_items")
        .update({ price_override: override })
        .eq("branch_id", branchId).eq("menu_item_id", item_id);
    } else {
      await supabase.from("branch_menu_items").insert({ branch_id: branchId, menu_item_id: item_id, available: true, price_override: override });
    }
    loadBmi();
  };

  const copyFromBranch = async () => {
    if (!copyFrom || !branchId || copyFrom === branchId) return toast.error("Pick a different source branch");
    if (!confirm("Copy availability & price overrides from source into this branch? This overwrites current settings.")) return;
    const { data: src } = await supabase.from("branch_menu_items").select("*").eq("branch_id", copyFrom);
    if (!src) return;
    // Wipe target, then re-insert
    await supabase.from("branch_menu_items").delete().eq("branch_id", branchId);
    if (src.length) {
      await supabase.from("branch_menu_items").insert(
        (src as BranchMenuItem[]).map((r) => ({
          branch_id: branchId, menu_item_id: r.menu_item_id,
          available: r.available, price_override: r.price_override,
        }))
      );
    }
    toast.success("Copied");
    loadBmi();
  };

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-4">
        <div>
          <label className="text-xs text-muted-foreground">Branch</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-1 block rounded-md border border-border bg-input px-3 py-2 text-sm">
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.area}, {b.city}</option>)}
          </select>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Copy availability from</label>
            <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="mt-1 block rounded-md border border-border bg-input px-3 py-2 text-sm">
              <option value="">— pick source —</option>
              {branches.filter((b) => b.id !== branchId).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <button onClick={copyFromBranch} className="rounded-md bg-secondary px-3 py-2 text-sm hover:bg-secondary/70">Copy →</button>
        </div>
      </div>

      <div className="space-y-6 max-h-[70vh] overflow-auto pr-1">
        {grouped.map(([cat, list]) => (
          <div key={cat}>
            <div className="mb-2 font-display text-lg text-primary">{cat}</div>
            <div className="space-y-1">
              {list.map((it) => {
                const row = bmi.get(it.id);
                const available = row?.available ?? false;
                return (
                  <div key={it.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-card p-2">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-secondary/40">
                      {it.image_url ? <img src={it.image_url} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="flex-1 text-sm">{it.name} {it.size && <span className="text-xs text-muted-foreground">({it.size})</span>}</div>
                    <span className="text-xs text-muted-foreground">Base Rs {Math.round(it.price)}</span>
                    <input
                      type="number"
                      placeholder="override"
                      defaultValue={row?.price_override ?? ""}
                      onBlur={(e) => setPriceOverride(it.id, e.target.value)}
                      className="w-24 rounded-md border border-border bg-input px-2 py-1 text-xs"
                    />
                    <button onClick={() => toggle(it.id)}
                      className={`rounded-full px-3 py-1 text-xs ${available ? "bg-green-500/20 text-green-300" : "bg-muted text-muted-foreground"}`}>
                      {available ? "Available" : "Off"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ ORDERS ============ */
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

/* ============ USERS ============ */
function UsersTab() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filter, setFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "customer" | AppRole>("all");

  const load = async () => {
    const [{ data: p }, { data: r }, { data: b }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("branches").select("*").order("city").order("area"),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setRoles((r ?? []) as UserRole[]);
    setBranches((b ?? []) as Branch[]);
  };
  useEffect(() => { load(); }, []);

  const rolesFor = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);

  const toggleRole = async (uid: string, role: AppRole, has: boolean) => {
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
      if (error) return toast.error(error.message);
      toast.success(`Removed ${role}`);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error) return toast.error(error.message);
      toast.success(`Assigned as ${role}`);
    }
    load();
  };

  const setBranch = async (uid: string, branch_id: string) => {
    const { error } = await supabase.from("profiles").update({ branch_id: branch_id || null }).eq("id", uid);
    if (error) return toast.error(error.message);
    toast.success("Branch updated");
    load();
  };

  const list = profiles.filter((p) => {
    const has = rolesFor(p.id);
    if (roleFilter === "customer" && has.length > 0) return false;
    if (roleFilter !== "all" && roleFilter !== "customer" && !has.includes(roleFilter)) return false;
    if (!filter) return true;
    const hay = `${p.email ?? ""} ${p.full_name ?? ""} ${p.phone ?? ""}`.toLowerCase();
    return hay.includes(filter.toLowerCase());
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card p-3">
        <input
          placeholder="Search by email, name or phone…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border bg-input px-3 py-2 text-sm"
        />
        <div className="ml-auto flex flex-wrap gap-1">
          {(["all", "customer", "admin", "manager", "driver"] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`rounded-full px-3 py-1 text-xs capitalize ${roleFilter === r ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="w-full text-xs text-muted-foreground">
          {profiles.length} total users • showing {list.length}. Everyone starts as a customer — click a role button below to promote.
        </div>
      </div>

      <div className="space-y-2 max-h-[70vh] overflow-auto pr-1">
        {list.map((p) => {
          const has = rolesFor(p.id);
          const isCustomer = has.length === 0;
          const needsBranch = has.includes("manager") || has.includes("driver");
          return (
            <div key={p.id} className="rounded-md border border-border/60 bg-card p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.email || "(no email)"}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.full_name || "no name"}{p.phone ? ` • ${p.phone}` : ""}
                  </div>
                </div>
                {isCustomer && (
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">customer</span>
                )}
                {(["admin","manager","driver"] as AppRole[]).map((r) => (
                  <button key={r} onClick={() => toggleRole(p.id, r, has.includes(r))}
                    className={`rounded-full px-3 py-1 text-xs capitalize ${has.includes(r) ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:bg-secondary"}`}>
                    {r}
                  </button>
                ))}
                <select value={p.branch_id ?? ""} onChange={(e) => setBranch(p.id, e.target.value)}
                  className={`rounded-md border px-2 py-1 text-xs ${needsBranch && !p.branch_id ? "border-primary bg-primary/10" : "border-border bg-input"}`}
                  title={needsBranch ? "Assign a branch" : "Optional"}>
                  <option value="">— no branch —</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.area}, {b.city}</option>)}
                </select>
              </div>
            </div>
          );
        })}
        {list.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">No users match.</div>}
      </div>
    </div>
  );
}

