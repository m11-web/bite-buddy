-- Spicy Bite v2 — RUN THIS WHOLE FILE in Supabase SQL Editor.
-- WARNING: This drops existing Spicy Bite tables and reseeds. If you have live
-- orders you want to keep, back them up first.
--
-- After running, sign up in /auth then run (replace with your uid from auth.users):
--   insert into public.user_roles (user_id, role) values ('<your-uid>','admin');

-- ============ RESET ============
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.branch_menu_items cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;
drop table if exists public.branches cascade;

-- ============ ENUMS ============
do $$ begin create type public.app_role as enum ('admin','manager','driver'); exception when duplicate_object then null; end $$;
do $$ begin create type public.order_status as enum ('pending','preparing','ready','out_for_delivery','delivered','cancelled'); exception when duplicate_object then null; end $$;

-- ============ BRANCHES ============
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area text not null,
  city text not null,
  address text not null,
  lat double precision, lng double precision, phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.branches to anon;
grant select, insert, update, delete on public.branches to authenticated;
grant all on public.branches to service_role;
alter table public.branches enable row level security;

-- ============ GLOBAL MENU ITEMS ============
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  size text,
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.menu_items to anon;
grant select, insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;

-- ============ PER-BRANCH AVAILABILITY ============
create table public.branch_menu_items (
  branch_id uuid not null references public.branches(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  available boolean not null default true,
  price_override numeric(10,2),
  primary key (branch_id, menu_item_id)
);
create index bmi_branch_idx on public.branch_menu_items(branch_id);
create index bmi_item_idx on public.branch_menu_items(menu_item_id);
grant select on public.branch_menu_items to anon;
grant select, insert, update, delete on public.branch_menu_items to authenticated;
grant all on public.branch_menu_items to service_role;
alter table public.branch_menu_items enable row level security;

-- ============ PROFILES / ROLES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text, phone text,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;


create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- ============ ORDERS ============
create table public.orders (
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
create index orders_branch_idx on public.orders(branch_id);
create index orders_driver_idx on public.orders(assigned_driver_id);
grant select, insert, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid references public.menu_items(id) on delete set null,
  name_snapshot text not null, size_snapshot text,
  price_snapshot numeric(10,2) not null,
  qty integer not null check (qty > 0)
);
create index order_items_order_idx on public.order_items(order_id);
grant select, insert on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;

-- ============ FUNCTIONS ============
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
grant execute on function public.has_role(uuid, public.app_role) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();


create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- place_order: uses branch_menu_items for availability + price override
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
  v_price numeric;
  v_name_s text;
  v_size_s text;
  v_mi_id uuid;
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
    v_mi_id := (v_item->>'menu_item_id')::uuid;

    select mi.name, mi.size, coalesce(bmi.price_override, mi.price)
      into v_name_s, v_size_s, v_price
      from public.branch_menu_items bmi
      join public.menu_items mi on mi.id = bmi.menu_item_id
      where bmi.branch_id = v_branch and bmi.menu_item_id = v_mi_id
        and bmi.available = true and mi.active = true;
    if not found then raise exception 'Item not available at this branch'; end if;

    insert into public.order_items (order_id, menu_item_id, name_snapshot, size_snapshot, price_snapshot, qty)
    values (v_order_id, v_mi_id, v_name_s, v_size_s, v_price, v_qty);

    v_subtotal := v_subtotal + (v_price * v_qty);
  end loop;

  update public.orders set subtotal = v_subtotal where id = v_order_id;
  return jsonb_build_object('order_id', v_order_id, 'order_code', v_code, 'subtotal', v_subtotal);
end; $$;
grant execute on function public.place_order(jsonb) to anon, authenticated;

create or replace function public.get_order_by_code(_code text)
returns setof public.orders language sql stable security definer set search_path = public as $$
  select * from public.orders where order_code = _code;
$$;
grant execute on function public.get_order_by_code(text) to anon, authenticated;

-- ============ POLICIES ============
-- branches
create policy "branches read all" on public.branches for select using (true);
create policy "branches admin write" on public.branches for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- menu_items
create policy "menu read all" on public.menu_items for select using (true);
create policy "menu admin write" on public.menu_items for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- branch_menu_items
create policy "bmi read all" on public.branch_menu_items for select using (true);
create policy "bmi admin write" on public.branch_menu_items for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "bmi manager write" on public.branch_menu_items for all
  using (public.has_role(auth.uid(),'manager')
    and branch_id = (select branch_id from public.profiles where id = auth.uid()))
  with check (public.has_role(auth.uid(),'manager')
    and branch_id = (select branch_id from public.profiles where id = auth.uid()));

-- profiles
create policy "profiles self read" on public.profiles for select
  using (auth.uid() = id or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager'));
create policy "profiles self update" on public.profiles for update
  using (auth.uid() = id or public.has_role(auth.uid(),'admin'))
  with check (auth.uid() = id or public.has_role(auth.uid(),'admin'));
create policy "profiles insert" on public.profiles for insert
  with check (auth.uid() = id or public.has_role(auth.uid(),'admin'));

-- user_roles
create policy "roles read own" on public.user_roles for select
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "roles admin write" on public.user_roles for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- orders
create policy "orders admin all" on public.orders for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "orders manager select" on public.orders for select
  using (public.has_role(auth.uid(),'manager')
    and branch_id = (select branch_id from public.profiles where id = auth.uid()));
create policy "orders manager update" on public.orders for update
  using (public.has_role(auth.uid(),'manager')
    and branch_id = (select branch_id from public.profiles where id = auth.uid()))
  with check (public.has_role(auth.uid(),'manager')
    and branch_id = (select branch_id from public.profiles where id = auth.uid()));
create policy "orders driver select" on public.orders for select
  using (public.has_role(auth.uid(),'driver') and assigned_driver_id = auth.uid());
create policy "orders driver update" on public.orders for update
  using (public.has_role(auth.uid(),'driver') and assigned_driver_id = auth.uid())
  with check (public.has_role(auth.uid(),'driver') and assigned_driver_id = auth.uid());
create policy "orders own read" on public.orders for select
  using (auth.uid() is not null and user_id = auth.uid());

-- order_items
create policy "order_items admin all" on public.order_items for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "order_items via order" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (
    public.has_role(auth.uid(),'admin')
    or (public.has_role(auth.uid(),'manager') and o.branch_id = (select branch_id from public.profiles where id = auth.uid()))
    or (public.has_role(auth.uid(),'driver') and o.assigned_driver_id = auth.uid())
    or (auth.uid() is not null and o.user_id = auth.uid())
  )));

-- Realtime
alter publication supabase_realtime add table public.orders;

-- ============ SEED BRANCHES (2 per city) ============
insert into public.branches (id, name, area, city, address, lat, lng, phone) values
 ('11111111-1111-1111-1111-111111111111','Spicy Bite Cantt','Cantt','Multan','Cantt Bazaar, Multan',30.2020,71.4740,'0329-4949150'),
 ('11111111-1111-1111-1111-111111111112','Spicy Bite Mumtazabad','Mumtazabad','Multan','Mumtazabad Colony, Multan',30.1600,71.4600,'0329-4949150'),
 ('22222222-2222-2222-2222-222222222221','Spicy Bite Gulberg','Gulberg','Lahore','Gulberg III, Lahore',31.5204,74.3587,'0329-4949150'),
 ('22222222-2222-2222-2222-222222222222','Spicy Bite DHA','DHA','Lahore','DHA Phase 5, Lahore',31.4700,74.4100,'0329-4949150'),
 ('33333333-3333-3333-3333-333333333331','Spicy Bite F-8','F-8 Markaz','Islamabad','F-8 Markaz, Islamabad',33.7100,73.0400,'0329-4949150'),
 ('33333333-3333-3333-3333-333333333332','Spicy Bite Blue Area','Blue Area','Islamabad','Blue Area, Islamabad',33.7200,73.0700,'0329-4949150'),
 ('44444444-4444-4444-4444-444444444441','Spicy Bite Clifton','Clifton','Karachi','Clifton Block 2, Karachi',24.8138,67.0300,'0329-4949150'),
 ('44444444-4444-4444-4444-444444444442','Spicy Bite Gulshan','Gulshan-e-Iqbal','Karachi','Gulshan-e-Iqbal, Karachi',24.9200,67.0900,'0329-4949150');

-- ============ SEED GLOBAL MENU ============
insert into public.menu_items (category, name, size, price) values
 ('Fries','Fries','Half',158),('Fries','Fries','Full',259),
 ('Fries','Masala Fries','Half',199),('Fries','Masala Fries','Full',349),
 ('Fries','Loaded Fries','Half',379),('Fries','Loaded Fries','Full',649),
 ('Fries','Pizza Fries','Half',399),('Fries','Pizza Fries','Full',649),
 ('Burger','Petty Burger',null,239),('Burger','Zinger Burger',null,259),
 ('Burger','Special Zinger',null,319),('Burger','Mighty Zinger',null,449),
 ('Burger','Double Decker',null,449),('Burger','Grill Burger',null,349),
 ('Shawarma','Chicken Shawarma',null,179),('Shawarma','Cheese Shawarma',null,219),
 ('Shawarma','Zinger Shawarma',null,279),
 ('Paratha Roll','Tikka Paratha',null,219),('Paratha Roll','Cheese Paratha',null,259),
 ('Paratha Roll','Zinger Paratha',null,279),('Paratha Roll','Turkish Paratha',null,349),
 ('Wrap','Spicy Bite Special Wrap',null,379),('Wrap','Cheese Wrap',null,449),
 ('Wrap','Behari Spin Roll',null,449),
 ('Wings','Crispy Wings','6 Pcs',379),('Wings','Crispy Wings','12 Pcs',679),
 ('Wings','Grill Wings','6 Pcs',379),('Wings','Grill Wings','12 Pcs',679),
 ('Wings','Crispy Thigh Nuggets','6 Pcs',449),
 ('Wings','Hot Shot','10 Pcs',299),('Wings','Hot Shot','20 Pcs',579),
 ('Regular Pizza','Fajita Pizza','Small',350),('Regular Pizza','Fajita Pizza','Medium',750),('Regular Pizza','Fajita Pizza','Large',1050),
 ('Regular Pizza','Tikka Pizza','Small',350),('Regular Pizza','Tikka Pizza','Medium',750),('Regular Pizza','Tikka Pizza','Large',1050),
 ('Regular Pizza','Bonfire Pizza','Small',350),('Regular Pizza','Bonfire Pizza','Medium',750),('Regular Pizza','Bonfire Pizza','Large',1050),
 ('Special Pizza','Spicy Bite Special Pizza','Small',400),('Special Pizza','Spicy Bite Special Pizza','Medium',850),('Special Pizza','Spicy Bite Special Pizza','Large',1150),
 ('Special Pizza','Malai Botti Pizza','Medium',1150),('Special Pizza','Malai Botti Pizza','Large',1150),
 ('Special Pizza','Crown Crust Pizza','Medium',850),('Special Pizza','Crown Crust Pizza','Large',1150),
 ('Sandwich','Special Sandwich','Small',450),('Sandwich','Special Sandwich','Medium',799),
 ('Pasta','Flaming Pasta','Half',360),('Pasta','Flaming Pasta','Full',550),
 ('Pasta','Crunchy Pasta','Half',400),('Pasta','Crunchy Pasta','Full',600),
 ('Pasta','Special Pasta','Half',430),('Pasta','Special Pasta','Full',650);

-- Make every menu item available at every branch by default
insert into public.branch_menu_items (branch_id, menu_item_id, available)
select b.id, m.id, true from public.branches b cross join public.menu_items m;
-- Spicy Bite v3 — Live driver tracking. Run this in Supabase SQL Editor.
-- Safe on existing data; only adds a table, policies, and RPC.

create table if not exists public.driver_locations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.driver_locations to authenticated;
grant all on public.driver_locations to service_role;
alter table public.driver_locations enable row level security;

drop policy if exists "dl driver upsert" on public.driver_locations;
create policy "dl driver upsert" on public.driver_locations for all
  using (public.has_role(auth.uid(),'driver') and driver_id = auth.uid())
  with check (public.has_role(auth.uid(),'driver') and driver_id = auth.uid());

drop policy if exists "dl admin all" on public.driver_locations;
create policy "dl admin all" on public.driver_locations for all
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

drop policy if exists "dl manager read" on public.driver_locations;
create policy "dl manager read" on public.driver_locations for select
  using (public.has_role(auth.uid(),'manager') and exists (
    select 1 from public.orders o join public.profiles p on p.id = auth.uid()
    where o.id = order_id and o.branch_id = p.branch_id));

drop policy if exists "dl customer own" on public.driver_locations;
create policy "dl customer own" on public.driver_locations for select
  using (auth.uid() is not null and exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- Tracking RPC — returns order + driver contact + latest location by order code.
create or replace function public.get_tracking(_code text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'order', to_jsonb(o.*),
    'driver', case when o.assigned_driver_id is null then null else
      jsonb_build_object('full_name', dp.full_name, 'phone', dp.phone)
    end,
    'location', case when dl.order_id is null then null else
      jsonb_build_object('lat', dl.lat, 'lng', dl.lng, 'updated_at', dl.updated_at)
    end
  )
  from public.orders o
  left join public.profiles dp on dp.id = o.assigned_driver_id
  left join public.driver_locations dl on dl.order_id = o.id
  where o.order_code = _code;
$$;
grant execute on function public.get_tracking(text) to anon, authenticated;
