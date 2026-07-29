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
