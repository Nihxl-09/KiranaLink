-- KiranaLink initial relational foundation.
-- Apply in a fresh Supabase project. Review policies before production launch.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'retailer', 'admin');
create type public.order_status as enum (
  'placed', 'accepted', 'packing', 'ready_for_pickup',
  'out_for_delivery', 'delivered', 'cancelled', 'rejected'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text unique,
  role public.app_role not null default 'customer',
  preferred_language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  name text not null,
  description text,
  phone text,
  address_line text,
  locality text,
  city text not null,
  state text not null,
  postal_code text,
  latitude double precision,
  longitude double precision,
  is_active boolean not null default false,
  opening_time time,
  closing_time time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_members (
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null check (member_role in ('owner','manager','staff')),
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category_id uuid references public.categories(id),
  brand text,
  unit_label text not null default 'piece',
  image_path text,
  barcode text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id),
  selling_price_paise integer not null check (selling_price_paise >= 0),
  available_quantity numeric(12,3) not null default 0 check (available_quantity >= 0),
  low_stock_threshold numeric(12,3) not null default 0 check (low_stock_threshold >= 0),
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (shop_id, product_id)
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  label text,
  recipient_name text not null,
  phone text not null,
  address_line text not null,
  locality text,
  city text not null,
  state text not null,
  postal_code text,
  latitude double precision,
  longitude double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid not null references public.shops(id),
  updated_at timestamptz not null default now(),
  unique (customer_id, shop_id)
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id),
  quantity numeric(12,3) not null check (quantity > 0),
  unique (cart_id, inventory_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity unique,
  customer_id uuid not null references public.profiles(id),
  shop_id uuid not null references public.shops(id),
  address_id uuid references public.addresses(id),
  status public.order_status not null default 'placed',
  fulfillment_type text not null check (fulfillment_type in ('pickup','delivery')),
  subtotal_paise integer not null check (subtotal_paise >= 0),
  delivery_fee_paise integer not null default 0 check (delivery_fee_paise >= 0),
  total_paise integer not null check (total_paise >= 0),
  payment_method text,
  payment_status text not null default 'pending',
  customer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  unit_label_snapshot text not null,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  quantity numeric(12,3) not null check (quantity > 0),
  line_total_paise integer not null check (line_total_paise >= 0)
);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  old_status public.order_status,
  new_status public.order_status not null,
  note text,
  created_at timestamptz not null default now()
);

create index shops_locality_idx on public.shops (city, locality) where is_active = true;
create index inventory_shop_idx on public.inventory (shop_id, is_available);
create index orders_customer_created_idx on public.orders (customer_id, created_at desc);
create index orders_shop_created_idx on public.orders (shop_id, created_at desc);
create index order_items_order_idx on public.order_items (order_id);

-- RLS is enabled now; policies are intentionally explicit and restrictive.
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.inventory enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

create policy "profiles_select_self" on public.profiles
for select to authenticated using (id = auth.uid());
create policy "profiles_update_self" on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "active_shops_public_read" on public.shops
for select to anon, authenticated using (is_active = true or owner_id = auth.uid());
create policy "shop_owner_insert" on public.shops
for insert to authenticated with check (owner_id = auth.uid());
create policy "shop_owner_update" on public.shops
for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "shop_members_read_self" on public.shop_members
for select to authenticated using (user_id = auth.uid());
create policy "categories_public_read" on public.categories
for select to anon, authenticated using (is_active = true);
create policy "products_public_read" on public.products
for select to anon, authenticated using (is_active = true);
create policy "available_inventory_public_read" on public.inventory
for select to anon, authenticated using (
  is_available = true and exists (
    select 1 from public.shops s where s.id = shop_id and s.is_active = true
  )
  or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
);
create policy "inventory_owner_insert" on public.inventory
for insert to authenticated with check (
  exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
);
create policy "inventory_owner_update" on public.inventory
for update to authenticated using (
  exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
) with check (
  exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
);

create policy "addresses_customer_all" on public.addresses
for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());

create policy "carts_customer_all" on public.carts
for all to authenticated using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "cart_items_customer_all" on public.cart_items
for all to authenticated using (
  exists (select 1 from public.carts c where c.id = cart_id and c.customer_id = auth.uid())
) with check (
  exists (select 1 from public.carts c where c.id = cart_id and c.customer_id = auth.uid())
);

create policy "orders_customer_or_shop_owner_read" on public.orders
for select to authenticated using (
  customer_id = auth.uid() or exists (
    select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid()
  )
);
create policy "orders_customer_insert" on public.orders
for insert to authenticated with check (customer_id = auth.uid());
create policy "orders_shop_owner_update" on public.orders
for update to authenticated using (
  exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
) with check (
  exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = auth.uid())
);
create policy "order_items_related_read" on public.order_items
for select to authenticated using (
  exists (
    select 1 from public.orders o where o.id = order_id
    and (o.customer_id = auth.uid() or exists (
      select 1 from public.shops s where s.id = o.shop_id and s.owner_id = auth.uid()
    ))
  )
);
create policy "order_status_related_read" on public.order_status_history
for select to authenticated using (
  exists (
    select 1 from public.orders o where o.id = order_id
    and (o.customer_id = auth.uid() or exists (
      select 1 from public.shops s where s.id = o.shop_id and s.owner_id = auth.uid()
    ))
  )
);

-- Important: checkout, stock reservation, role assignment, and status transitions
-- must be implemented as trusted server-side functions with authorization checks.
-- Do not allow clients to directly decrement inventory or self-assign admin roles.
