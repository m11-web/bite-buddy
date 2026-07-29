import { Link, useRouter } from "@tanstack/react-router";
import { ShoppingCart, MapPin, LogOut, User } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCart, useCart } from "@/lib/cart-store";
import { getSelectedBranchId } from "@/lib/branch-store";
import type { Branch } from "@/types/db";

export function SiteHeader() {
  const router = useRouter();
  useCart();
  const cart = getCart();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const id = getSelectedBranchId();
      if (!id) { setBranch(null); return; }
      const { data } = await supabase.from("branches").select("*").eq("id", id).maybeSingle();
      setBranch(data as Branch | null);
    };
    load();
    const onChange = () => load();
    window.addEventListener("branch-changed", onChange);
    return () => window.removeEventListener("branch-changed", onChange);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setUserEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const itemCount = cart.lines.reduce((s, l) => s + l.qty, 0);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-display text-3xl text-primary">SPICY</span>
          <span className="font-display text-3xl text-gold">BITE</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/" className="text-sm hover:text-primary">Home</Link>
          <Link to="/menu" className="text-sm hover:text-primary">Menu</Link>
        </nav>
        <div className="flex items-center gap-3">
          {branch && (
            <button
              onClick={() => router.navigate({ to: "/" })}
              className="hidden items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground sm:flex"
            >
              <MapPin className="h-3 w-3" /> {branch.name}
            </button>
          )}
          <Link to="/cart" className="relative rounded-md p-2 hover:bg-secondary">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Link>
          {userEmail ? (
            <div className="flex items-center gap-1">
              <Link to="/admin" className="rounded-md p-2 hover:bg-secondary" title={userEmail}>
                <User className="h-5 w-5" />
              </Link>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.navigate({ to: "/" }); }}
                className="rounded-md p-2 hover:bg-secondary"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <Link to="/auth" className="rounded-md bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              Sign Up
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
