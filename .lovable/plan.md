
# Spicy Bite — Full Build Plan

Using **your** Supabase project (external / BYO), not Lovable Cloud.
- URL: `https://fsoebdouekqodneqlcsb.supabase.co`
- Anon key: the JWT you pasted (publishable, safe in frontend)
- You'll run the SQL migration file yourself in the Supabase SQL editor.

## What gets wired up

1. `.env` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. `src/integrations/supabase/client.ts` — browser Supabase client (persists session in localStorage).
3. `src/integrations/supabase/types.ts` — hand-written DB types matching the SQL.
4. A single SQL file at `supabase/migrations/0001_spicy_bite.sql` for you to paste-run.

No server functions / no service-role usage — everything goes through the anon client + RLS. This fits an external/unmanaged Supabase project.

## Routes

Public:
- `/` — hero, geolocation prompt, city fallback dropdown → sets branch.
- `/menu` — items for selected branch, add to cart.
- `/cart` — line items + checkout form (Name, Phone, Address) → creates order, returns `order_code`.
- `/order/$code` — order confirmation + live status (Realtime).
- `/auth` — email/password login + signup (staff only; customers order as guests).

Role-gated (client-side check via `has_role`):
- `/admin` — branches CRUD, menu CRUD, all orders, assign roles + branches to users.
- `/manager` — orders for the manager's branch; buttons: Preparing → Ready → Out for delivery; assign driver.
- `/driver` — assigned deliveries; Mark Delivered.

Each gated route uses `beforeLoad` calling `supabase.auth.getUser()` + `has_role` RPC; unauthorized users redirect to `/auth`.

## Database schema (in the SQL file)

Tables (all `public`, RLS on, GRANTS included):
- `branches` — id, name, city, address, lat, lng, phone, active. Public SELECT (anon). Admin write.
- `menu_items` — id, branch_id (FK), category, name, size (nullable: Small/Medium/Large/Half/Full/10pc/20pc/null), price (numeric), image_url, active. Public SELECT. Admin write.
- `profiles` — id (= auth.users.id), full_name, phone, branch_id (for manager/driver). Self read/update; admin read all.
- `app_role` enum: `admin | manager | driver`.
- `user_roles` — user_id, role, unique(user_id, role). Read via `has_role`; admin write.
- `orders` — id, order_code (short random, unique), branch_id, customer_name, customer_phone, address, subtotal, status enum (`pending|preparing|ready|out_for_delivery|delivered|cancelled`), assigned_driver_id (nullable), user_id (nullable — guests allowed), created_at, updated_at.
- `order_items` — order_id, menu_item_id, name_snapshot, size_snapshot, price_snapshot, qty.

Functions:
- `has_role(_user_id uuid, _role app_role) returns boolean` — SECURITY DEFINER, avoids RLS recursion.
- `generate_order_code()` — trigger to fill `order_code` (e.g. `SB-4F7K2A`).
- `handle_new_user()` — trigger on `auth.users` insert to create a `profiles` row.

RLS highlights:
- `orders` INSERT: anon + authenticated allowed (guest checkout).
- `orders` SELECT/UPDATE: admin (all), manager (own branch), driver (assigned orders), + the guest-lookup path uses a public RPC `get_order_by_code(code text)` (SECURITY DEFINER) so guests can view their order without exposing the whole table.
- `order_items`: same policies scoped via join on `orders`.
- `menu_items`, `branches`: public SELECT to anon; admin-only write.

Seed data (in the same SQL):
- **4 branches**: Multan, Lahore, Islamabad, Karachi (approx city-center lat/lng; you can edit later from `/admin`).
- **Full menu from your uploaded image**, applied to every seeded branch:
  - **Fries**: Fries 158/259, Masala Fries 199/349, Loaded Fries 379/649, Pizza Fries 399/649
  - **Burgers**: Petty 239, Zinger 259, Special Zinger 319, Mighty Zinger 449, Double Decker 449, Grill Burger 349
  - **Shawarma**: Chicken 179, Cheese 219, Zinger 279
  - **Paratha Roll**: Tikka 219, Cheese 259, Zinger 279, Turkish 349
  - **Wraps**: Spicy Bite Special 379, Cheese 449, Behari Spin 449
  - **Wings**: Crispy 379/679, Grill 379/679, Crispy Thigh Nuggets 449, Hot Shot 10pc 299 / 20pc 579
  - **Regular Pizza (Fajita, Tikka, Bonfire)**: S 350 / M 750 / L 1050
  - **Special Pizza**: Spicy Bite Special S 400 / M 850 / L 1150; Malai Botti M/L 1150; Crown Crust M 850 / L 1150
  - **Sandwich**: Special Sandwich Small 450 / Medium 799
  - **Pasta**: Flaming 360/550, Crunchy 400/600, Special 430/650

## Geolocation flow

- On `/` first visit: show modal with "Detect my location" and "Choose city".
- If granted → Haversine vs `branches.lat/lng` → nearest active branch → localStorage `spicy_branch_id`.
- If denied/failed → city dropdown from distinct `branches.city` values.
- Header shows current branch with a "Change" button.

## Cart & checkout

- Cart in localStorage, keyed by branch. Switching branch prompts to clear.
- Zod-validated form (name 2–100, phone regex, address 5–300).
- Submit: single insert `orders` + bulk insert `order_items` (transactional via RPC `place_order(payload jsonb)` so anon can't spoof price — server recalculates from `menu_items`).
- Redirect to `/order/$code`; page subscribes to Realtime on that order row.

## Dashboards

- Admin `/admin`:
  - Branches tab (create/edit/delete, set lat/lng, active toggle)
  - Menu tab (per branch; add/edit/delete items with size + price)
  - Orders tab (filter by branch/status/date)
  - Users tab (list `profiles` + roles; assign `admin/manager/driver`; set `branch_id`)
- Manager `/manager`: today's orders for their branch; status buttons; driver assignment (drivers where `branch_id` matches).
- Driver `/driver`: list of orders where `assigned_driver_id = auth.uid()` and status in `ready/out_for_delivery`; call/map buttons; "Mark Delivered".

Realtime: subscribe to `orders` filtered by branch / driver id, plus the customer's own order page.

## Design (matching your uploaded menu poster)

- Dark near-black background, red primary, gold/orange accents, off-white text.
- Semantic tokens in `src/styles.css` — no hardcoded colors in components.
- Typography via `<link>` in `__root.tsx`: **Bebas Neue** for headings (matches poster), **Inter** for body.
- Fire/flame accent motifs on hero and section headers.
- Menu grid: category headers with red banner + gold price chips (like the poster).

## SEO

Distinct `head()` per route: title, description, og:title, og:description, twitter card. Home `/` overrides the placeholder.

## What you'll do after I build

1. Open Supabase SQL editor for your project.
2. Paste `supabase/migrations/0001_spicy_bite.sql` and run it.
3. Sign up once in `/auth`, then in Supabase SQL run:
   `insert into user_roles (user_id, role) values ('<your-uid>', 'admin');`
   Now `/admin` opens for you.
4. Adjust branches / menu / users from `/admin`.

## Not in scope (say the word to add)

- Online payments (Stripe/JazzCash) — currently cash on delivery.
- SMS/WhatsApp notifications to customer on status change.
- Real driver map tracking.
