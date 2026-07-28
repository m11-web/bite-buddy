import { useSyncExternalStore } from "react";

export interface CartLine {
  menu_item_id: string;
  name: string;
  size: string | null;
  price: number;
  qty: number;
}

const KEY = "spicy_cart_v1";
const listeners = new Set<() => void>();

function read(): { branch_id: string | null; lines: CartLine[] } {
  if (typeof window === "undefined") return { branch_id: null, lines: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { branch_id: null, lines: [] };
    return JSON.parse(raw);
  } catch { return { branch_id: null, lines: [] }; }
}

function write(state: { branch_id: string | null; lines: CartLine[] }) {
  window.localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function addToCart(branchId: string, line: CartLine) {
  const s = read();
  if (s.branch_id && s.branch_id !== branchId) {
    if (!confirm("Your cart has items from another branch. Clear cart and switch?")) return false;
    s.lines = [];
  }
  s.branch_id = branchId;
  const existing = s.lines.find((l) => l.menu_item_id === line.menu_item_id);
  if (existing) existing.qty += line.qty;
  else s.lines.push(line);
  write(s);
  return true;
}

export function setQty(menu_item_id: string, qty: number) {
  const s = read();
  s.lines = s.lines.flatMap((l) => (l.menu_item_id === menu_item_id ? (qty <= 0 ? [] : [{ ...l, qty }]) : [l]));
  if (s.lines.length === 0) s.branch_id = null;
  write(s);
}

export function clearCart() { write({ branch_id: null, lines: [] }); }

export function useCart() {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => JSON.stringify(read()),
    () => JSON.stringify({ branch_id: null, lines: [] }),
  );
}

export function getCart() { return read(); }
export function cartSubtotal() { return read().lines.reduce((s, l) => s + l.price * l.qty, 0); }
