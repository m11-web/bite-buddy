import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Trash2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCart, useCart, setQty, cartSubtotal, clearCart } from "@/lib/cart-store";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Cart — Spicy Bite" },
      { name: "description", content: "Review your order and check out." },
      { property: "og:title", content: "Your Cart — Spicy Bite" },
      { property: "og:description", content: "Review your order and check out." },
    ],
  }),
  component: CartPage,
});

const schema = z.object({
  customer_name: z.string().trim().min(2, "Enter your name").max(100),
  customer_phone: z.string().trim().min(7, "Enter a valid phone").max(20),
  address: z.string().trim().min(5, "Enter delivery address").max(300),
});

function CartPage() {
  const router = useRouter();
  useCart();
  const cart = getCart();
  const subtotal = cartSubtotal();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [placing, setPlacing] = useState(false);

  const placeOrder = async () => {
    const parsed = schema.safeParse({ customer_name: name, customer_phone: phone, address });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!cart.branch_id || cart.lines.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    setPlacing(true);
    const { data, error } = await supabase.rpc("place_order", {
      payload: {
        branch_id: cart.branch_id,
        customer_name: parsed.data.customer_name,
        customer_phone: parsed.data.customer_phone,
        address: parsed.data.address,
        items: cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, qty: l.qty })),
      },
    });
    setPlacing(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const code = (data as { order_code: string }).order_code;
    clearCart();
    toast.success(`Order placed! Code ${code}`);
    router.navigate({ to: "/order/$code", params: { code } });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-display text-5xl"><span className="text-primary">YOUR</span> CART</h1>

        {cart.lines.length === 0 ? (
          <div className="mt-10 rounded-lg border border-border/60 bg-card p-10 text-center">
            <p className="text-muted-foreground">Your cart is empty.</p>
            <Link to="/menu" className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Browse menu</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_360px]">
            <div className="space-y-2">
              {cart.lines.map((l) => (
                <div key={l.menu_item_id} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3">
                  <div className="flex-1">
                    <div className="font-medium">{l.name}</div>
                    {l.size && <div className="text-xs text-muted-foreground">{l.size}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(l.menu_item_id, l.qty - 1)} className="rounded bg-secondary p-1 hover:bg-secondary/70"><Minus className="h-3 w-3" /></button>
                    <span className="w-8 text-center text-sm">{l.qty}</span>
                    <button onClick={() => setQty(l.menu_item_id, l.qty + 1)} className="rounded bg-secondary p-1 hover:bg-secondary/70"><Plus className="h-3 w-3" /></button>
                  </div>
                  <div className="w-20 text-right font-display text-lg text-gold">{Math.round(l.price * l.qty)}</div>
                  <button onClick={() => setQty(l.menu_item_id, 0)} className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-5 h-fit">
              <h2 className="font-display text-2xl text-primary">Checkout</h2>
              <div className="mt-3 flex justify-between text-sm">
                <span>Subtotal</span><span className="font-display text-xl text-gold">Rs {Math.round(subtotal)}</span>
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground">Full name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" placeholder="Your name" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" placeholder="03XX-XXXXXXX" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Delivery address</label>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" placeholder="House, street, area" />
                </div>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing}
                className="mt-5 w-full rounded-md bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {placing ? "Placing…" : `Place order — Rs ${Math.round(subtotal)}`}
              </button>
              <p className="mt-2 text-center text-xs text-muted-foreground">Cash on delivery</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
