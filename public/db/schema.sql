-- Spicy Bite — paste this whole file into Supabase SQL Editor and RUN.
-- After running, sign up in /auth then run:
--   insert into public.user_roles (user_id, role) values ('<your-uid-from-auth.users>','admin');

-- Enums
do $$ begin create type public.app_role as enum ('admin','manager','driver'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('pending','preparing','ready','out_for_delivery','delivered','cancelled'); exception when duplicate_object then null; end $$;

-- Tables
create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null, city text not null, address text not null,
  lat double precision, lng double precision, phone text,
  active boolean not null default true, created_at timestamptz not null default now()
);
grant select on public.branches to anon;
grant select, insert, update, delete on public.branches to authenticated;
grant all on public.branches to service_role;
alter table public.branches enable row level security;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  category text not null, name text not null, size text,
  price numeric(10,2) not null check (price >= 0),
  image_url text, active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists menu_items_branch_idx on public.menu_items(branch_id);
grant select on public.menu_items to anon;
grant select, insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, phone text,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  branch_id uuid not null references public.branches(id),
  customer_name text not null, customer_phone text not null, address text not null,
  subtotal numeric(10,2) not null,
  status public.order_status not null default 'pending',
  assigned_driver_id uuid references auth.users(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_branch_idx on public.orders(branch_id);
create index if not exists orders_driver_idx on public.orders(assigned_driver_id);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name_snapshot text not null, size_snapshot text,
  price_snapshot numeric(10,2) not null,
  qty integer not null check (qty > 0)
);
create index if not exists order_items_order_idx on public.order_items(order_id);
grant select, insert on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;

-- has_role
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;

-- Auto-create profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- place_order RPC (server-side price validation, works for anon & auth)
create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_branch uuid := (payload->>'branch_id')::uuid;
  v_name text := payload->>'customer_name';
  v_phone text := payload->>'customer_phone';
  v_addr text := payload->>'address';
  v_items jsonb := payload->'items';
  v_order_id uuid;
  v_code text;
  v_subtotal numeric := 0;
  v_item jsonb;
  v_menu record;
  v_qty int;
begin
  if v_branch is null or coalesce(v_name,'')='' or coalesce(v_phone,'')='' or coalesce(v_addr,'')='' then
    raise exception 'Missing required fields';
  end if;
  if v_items is null or jsonb_array_length(v_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  v_code := 'SB-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.orders (order_code, branch_id, customer_name, customer_phone, address, subtotal, user_id)
  values (v_code, v_branch, v_name, v_phone, v_addr, 0, auth.uid())
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_qty := coalesce((v_item->>'qty')::int, 1);
    select id, name, size, price into v_menu
      from public.menu_items
      where id = (v_item->>'menu_item_id')::uuid and active = true and branch_id = v_branch;
    if not found then raise exception 'Invalid menu item'; end if;

    insert into public.order_items (order_id, menu_item_id, name_snapshot, size_snapshot, price_snapshot, qty)
    values (v_order_id, v_menu.id, v_menu.name, v_menu.size, v_menu.price, v_qty);

    v_subtotal := v_subtotal + (v_menu.price * v_qty);
  end loop;

  update public.orders set subtotal = v_subtotal where id = v_order_id;
  return jsonb_build_object('order_id', v_order_id, 'order_code', v_code, 'subtotal', v_subtotal);
end; $$;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- Guest order lookup
create or replace function public.get_order_by_code(_code text)
returns setof public.orders language sql stable security definer set search_path = public as $$
  select * from public.orders where order_code = _code;
$$;
grant execute on function public.get_order_by_code(text) to anon, authenticated;

-- Policies: branches
drop policy if exists "branches read all" on public.branches;
create policy "branches read all" on public.branches for select using (true);
drop policy if exists "branches admin write" on public.branches;
create policy "branches admin write" on public.branches for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- menu_items
drop policy if exists "menu read all" on public.menu_items;
create policy "menu read all" on public.menu_items for select using (true);
drop policy if exists "menu admin write" on public.menu_items;
create policy "menu admin write" on public.menu_items for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- profiles
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select
  using (auth.uid() = id or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager'));
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update
  using (auth.uid() = id or public.has_role(auth.uid(),'admin'))
  with check (auth.uid() = id or public.has_role(auth.uid(),'admin'));
drop policy if exists "profiles insert" on public.profiles;
create policy "profiles insert" on public.profiles for insert
  with check (auth.uid() = id or public.has_role(auth.uid(),'admin'));

-- user_roles
drop policy if exists "roles read own" on public.user_roles;
create policy "roles read own" on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
drop policy if exists "roles admin write" on public.user_roles;
create policy "roles admin write" on public.user_roles for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- orders
drop policy if exists "orders admin all" on public.orders;
create policy "orders admin all" on public.orders for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
drop policy if exists "orders manager select" on public.orders;
create policy "orders manager select" on public.orders for select
  using (public.has_role(auth.uid(),'manager')
    and branch_id = (select branch_id from public.profiles where id = auth.uid()));
drop policy if exists "orders manager update" on public.orders;
create policy "orders manager update" on public.orders for update
  using (public.has_role(auth.uid(),'manager')
    and branch_id = (select branch_id from public.profiles where id = auth.uid()))
  with check (public.has_role(auth.uid(),'manager')
    and branch_id = (select branch_id from public.profiles where id = auth.uid()));
drop policy if exists "orders driver select" on public.orders;
create policy "orders driver select" on public.orders for select
  using (public.has_role(auth.uid(),'driver') and assigned_driver_id = auth.uid());
drop policy if exists "orders driver update" on public.orders;
create policy "orders driver update" on public.orders for update
  using (public.has_role(auth.uid(),'driver') and assigned_driver_id = auth.uid())
  with check (public.has_role(auth.uid(),'driver') and assigned_driver_id = auth.uid());
drop policy if exists "orders own read" on public.orders;
create policy "orders own read" on public.orders for select
  using (auth.uid() is not null and user_id = auth.uid());

-- order_items
drop policy if exists "order_items admin all" on public.order_items;
create policy "order_items admin all" on public.order_items for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
drop policy if exists "order_items via order" on public.order_items;
create policy "order_items via order" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (
    public.has_role(auth.uid(),'admin')
    or (public.has_role(auth.uid(),'manager') and o.branch_id = (select branch_id from public.profiles where id = auth.uid()))
    or (public.has_role(auth.uid(),'driver') and o.assigned_driver_id = auth.uid())
    or (auth.uid() is not null and o.user_id = auth.uid())
  )));

-- Realtime
alter publication supabase_realtime add table public.orders;

-- Seed branches
insert into public.branches (id, name, city, address, lat, lng, phone) values
  ('11111111-1111-1111-1111-111111111111','Multan Branch','Multan','Cantt, Multan',30.1798,71.4924,'0329-4949150'),
  ('22222222-2222-2222-2222-222222222222','Lahore Branch','Lahore','Gulberg, Lahore',31.5204,74.3587,'0329-4949150'),
  ('33333333-3333-3333-3333-333333333333','Islamabad Branch','Islamabad','F-8 Markaz, Islamabad',33.6844,73.0479,'0329-4949150'),
  ('44444444-4444-4444-4444-444444444444','Karachi Branch','Karachi','Clifton, Karachi',24.8138,67.0300,'0329-4949150')
on conflict (id) do nothing;

-- Seed menu for every branch
do $$
declare b record;
begin
  for b in select id from public.branches loop
    insert into public.menu_items (branch_id, category, name, size, price) values
      (b.id,'Fries','Fries','Half',158),(b.id,'Fries','Fries','Full',259),
      (b.id,'Fries','Masala Fries','Half',199),(b.id,'Fries','Masala Fries','Full',349),
      (b.id,'Fries','Loaded Fries','Half',379),(b.id,'Fries','Loaded Fries','Full',649),
      (b.id,'Fries','Pizza Fries','Half',399),(b.id,'Fries','Pizza Fries','Full',649),
      (b.id,'Burger','Petty Burger',null,239),(b.id,'Burger','Zinger Burger',null,259),
      (b.id,'Burger','Special Zinger',null,319),(b.id,'Burger','Mighty Zinger',null,449),
      (b.id,'Burger','Double Decker',null,449),(b.id,'Burger','Grill Burger',null,349),
      (b.id,'Shawarma','Chicken Shawarma',null,179),(b.id,'Shawarma','Cheese Shawarma',null,219),
      (b.id,'Shawarma','Zinger Shawarma',null,279),
      (b.id,'Paratha Roll','Tikka Paratha',null,219),(b.id,'Paratha Roll','Cheese Paratha',null,259),
      (b.id,'Paratha Roll','Zinger Paratha',null,279),(b.id,'Paratha Roll','Turkish Paratha',null,349),
      (b.id,'Wrap','Spicy Bite Special Wrap',null,379),(b.id,'Wrap','Cheese Wrap',null,449),
      (b.id,'Wrap','Behari Spin Roll',null,449),
      (b.id,'Wings','Crispy Wings','6 Pcs',379),(b.id,'Wings','Crispy Wings','12 Pcs',679),
      (b.id,'Wings','Grill Wings','6 Pcs',379),(b.id,'Wings','Grill Wings','12 Pcs',679),
      (b.id,'Wings','Crispy Thigh Nuggets','6 Pcs',449),
      (b.id,'Wings','Hot Shot','10 Pcs',299),(b.id,'Wings','Hot Shot','20 Pcs',579),
      (b.id,'Regular Pizza','Fajita Pizza','Small',350),(b.id,'Regular Pizza','Fajita Pizza','Medium',750),(b.id,'Regular Pizza','Fajita Pizza','Large',1050),
      (b.id,'Regular Pizza','Tikka Pizza','Small',350),(b.id,'Regular Pizza','Tikka Pizza','Medium',750),(b.id,'Regular Pizza','Tikka Pizza','Large',1050),
      (b.id,'Regular Pizza','Bonfire Pizza','Small',350),(b.id,'Regular Pizza','Bonfire Pizza','Medium',750),(b.id,'Regular Pizza','Bonfire Pizza','Large',1050),
      (b.id,'Special Pizza','Spicy Bite Special Pizza','Small',400),(b.id,'Special Pizza','Spicy Bite Special Pizza','Medium',850),(b.id,'Special Pizza','Spicy Bite Special Pizza','Large',1150),
      (b.id,'Special Pizza','Malai Botti Pizza','Medium',1150),(b.id,'Special Pizza','Malai Botti Pizza','Large',1150),
      (b.id,'Special Pizza','Crown Crust Pizza','Medium',850),(b.id,'Special Pizza','Crown Crust Pizza','Large',1150),
      (b.id,'Sandwich','Special Sandwich','Small',450),(b.id,'Sandwich','Special Sandwich','Medium',799),
      (b.id,'Pasta','Flaming Pasta','Half',360),(b.id,'Pasta','Flaming Pasta','Full',550),
      (b.id,'Pasta','Crunchy Pasta','Half',400),(b.id,'Pasta','Crunchy Pasta','Full',600),
      (b.id,'Pasta','Special Pasta','Half',430),(b.id,'Pasta','Special Pasta','Full',650)
    on conflict do nothing;
  end loop;
end $$;
