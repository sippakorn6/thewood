-- =========================================
-- THE WOOD - PRODUCTION SQL (RUN ALL)
-- =========================================

-- 1) menu_items
create table if not exists public.menu_items (
  id bigserial primary key,
  name_th text not null,
  category text not null default 'อาหาร',
  price_thb bigint not null default 0,
  stock bigint not null default 0,
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 2) orders
create table if not exists public.orders (
  id bigserial primary key,
  session_id text not null,
  table_no text not null,
  status text not null default 'NEW',
  items jsonb not null default '[]'::jsonb,
  total_thb bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3) served_history
create table if not exists public.served_history (
  id bigserial primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  served_at timestamptz not null default now()
);

-- 4) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

-- 5) RLS
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.served_history enable row level security;

-- menu_items policies
drop policy if exists "menu_items_select_all" on public.menu_items;
create policy "menu_items_select_all"
on public.menu_items
for select
to public
using (true);

drop policy if exists "menu_items_insert_auth" on public.menu_items;
create policy "menu_items_insert_auth"
on public.menu_items
for insert
to authenticated
with check (true);

drop policy if exists "menu_items_update_auth" on public.menu_items;
create policy "menu_items_update_auth"
on public.menu_items
for update
to authenticated
using (true)
with check (true);

-- orders policies
drop policy if exists "orders_select_all" on public.orders;
create policy "orders_select_all"
on public.orders
for select
to public
using (true);

drop policy if exists "orders_insert_all" on public.orders;
create policy "orders_insert_all"
on public.orders
for insert
to public
with check (true);

drop policy if exists "orders_update_auth" on public.orders;
create policy "orders_update_auth"
on public.orders
for update
to authenticated
using (true)
with check (true);

-- served_history policies
drop policy if exists "served_history_select_auth" on public.served_history;
create policy "served_history_select_auth"
on public.served_history
for select
to authenticated
using (true);

drop policy if exists "served_history_insert_auth" on public.served_history;
create policy "served_history_insert_auth"
on public.served_history
for insert
to authenticated
with check (true);

-- 6) RPC atomic place order
create or replace function public.place_order_atomic(
  p_session_id text,
  p_table_no text,
  p_items jsonb,
  p_total_thb bigint
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_item jsonb;
  v_menu_id bigint;
  v_qty bigint;
  v_current_stock bigint;
begin
  insert into public.orders (session_id, table_no, status, items, total_thb)
  values (p_session_id, p_table_no, 'NEW', p_items, p_total_thb)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_menu_id := (v_item->>'menu_id')::bigint;
    v_qty := greatest((v_item->>'qty')::bigint, 0);

    select stock into v_current_stock
    from public.menu_items
    where id = v_menu_id
    for update;

    if v_current_stock is null then
      raise exception 'Menu item not found: %', v_menu_id;
    end if;

    if v_current_stock < v_qty then
      raise exception 'Not enough stock for menu_id=% (stock=% qty=%)', v_menu_id, v_current_stock, v_qty;
    end if;

    update public.menu_items
    set stock = stock - v_qty
    where id = v_menu_id;
  end loop;

  return v_order_id;
end;
$$;


-- Grant RPC execute to client roles
grant execute on function public.place_order_atomic(text,text,jsonb,bigint) to anon, authenticated;


-- indexes for faster history/status queries
create index if not exists idx_orders_status_created_at on public.orders (status, created_at desc);
create index if not exists idx_orders_session_created_at on public.orders (session_id, created_at desc);
