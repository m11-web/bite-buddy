export type AppRole = "admin" | "manager" | "driver";
export type OrderStatus =
  | "pending" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

export interface Branch {
  id: string; name: string; area: string; city: string; address: string;
  lat: number | null; lng: number | null; phone: string | null;
  active: boolean; created_at: string;
}
export interface MenuItem {
  id: string; category: string; name: string;
  size: string | null; price: number; image_url: string | null;
  active: boolean; created_at: string;
}
export interface BranchMenuItem {
  branch_id: string; menu_item_id: string;
  available: boolean; price_override: number | null;
}
export interface Profile {
  id: string; full_name: string | null; phone: string | null;
  branch_id: string | null; created_at: string;
}
export interface UserRole { id: string; user_id: string; role: AppRole }
export interface Order {
  id: string; order_code: string; branch_id: string;
  customer_name: string; customer_phone: string; address: string;
  subtotal: number; status: OrderStatus;
  assigned_driver_id: string | null; user_id: string | null;
  created_at: string; updated_at: string;
}
export interface OrderItem {
  id: string; order_id: string; menu_item_id: string;
  name_snapshot: string; size_snapshot: string | null;
  price_snapshot: number; qty: number;
}
