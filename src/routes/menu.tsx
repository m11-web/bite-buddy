import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Flame } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getSelectedBranchId } from "@/lib/branch-store";
import { addToCart } from "@/lib/cart-store";
import { SiteHeader } from "@/components/site-header";
import type { Branch, MenuItem } from "@/types/db";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Spicy Bite" },
      { name: "description", content: "Full menu — pizzas, burgers, wings, wraps, pasta and more from your Spicy Bite branch." },
      { property: "og:title", content: "Menu — Spicy Bite" },
      { property: "og:description", content: "Order pizzas, burgers, wings and more." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = getSelectedBranchId();
    setBranchId(id);
    if (!id) { setLoading(false); return; }
    (async () => {
      const [{ data: b }, { data: m }] = await Promise.all([
        supabase.from("branches").select("*").eq("id", id).maybeSingle(),
        supabase.from("menu_items").select("*").eq("branch_id", id).eq("active", true).order("category").order("name"),
      ]);
      setBranch(b as Branch | null);
      setItems((m ?? []) as MenuItem[]);
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of items) {
      if (!map.has(it.category)) map.set(it.category, []);
      map.get(it.category)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  if (!branchId) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-lg p-8 text-center">
          <h1 className="font-display text-3xl">Pick a branch first</h1>
          <p className="mt-2 text-sm text-muted-foreground">We need to know which branch to serve you from.</p>
          <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Choose location</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display text-5xl md:text-6xl"><span className="text-primary">MENU</span></h1>
            {branch && <p className="text-sm text-muted-foreground">Serving from <span className="text-gold font-medium">{branch.name}</span> • {branch.city}</p>}
          </div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary">Change branch →</Link>
        </div>

        {loading ? (
          <div className="py-20 text-center text-muted-foreground">Loading menu…</div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No items yet for this branch. Ask admin to add items in /admin.
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(([cat, list]) => (
              <section key={cat}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-md bg-primary px-3 py-1 font-display text-xl text-primary-foreground">
                    <Flame className="mr-1 inline h-4 w-4" />{cat}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((it) => (
                    <div key={it.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-4 hover:border-primary/60 transition-colors">
                      <div>
                        <h3 className="font-semibold">{it.name}</h3>
                        {it.size && <p className="text-xs text-muted-foreground">{it.size}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="rounded-md bg-gold/15 px-2 py-1 font-display text-lg text-gold">
                          {Math.round(it.price)}
                        </span>
                        <button
                          onClick={() => {
                            const ok = addToCart(branchId, {
                              menu_item_id: it.id, name: it.name, size: it.size,
                              price: Number(it.price), qty: 1,
                            });
                            if (ok) toast.success(`Added ${it.name}`);
                          }}
                          className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
