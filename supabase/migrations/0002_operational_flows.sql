-- Operational safeguards and RPCs for the customer and retailer apps.
-- Apply after 0001_initial_schema.sql in Supabase SQL Editor or with the CLI.

alter table public.shops
  add column if not exists pickup_enabled boolean not null default true,
  add column if not exists delivery_enabled boolean not null default false,
  add column if not exists delivery_fee_paise integer not null default 0
    check (delivery_fee_paise >= 0),
  add column if not exists minimum_order_paise integer not null default 0
    check (minimum_order_paise >= 0),
  add column if not exists support_phone text,
  add column if not exists upi_id text;

alter table public.products
  add column if not exists created_by uuid references public.profiles(id);

alter table public.orders
  add column if not exists payment_reference text,
  add column if not exists payment_verified_by uuid references public.profiles(id),
  add column if not exists payment_verified_at timestamptz,
  add column if not exists payment_review_note text,
  add column if not exists delivery_address_snapshot jsonb,
  add column if not exists upi_id_snapshot text;

alter table public.shops
  add constraint shops_upi_id_format_check
  check (upi_id is null or upi_id ~* '^[a-z0-9._-]{2,256}@[a-z0-9.-]{2,64}$');

alter table public.orders
  add constraint orders_payment_method_check
    check (payment_method is null or payment_method in ('cash', 'upi')),
  add constraint orders_payment_status_check
    check (payment_status in ('pending', 'submitted', 'paid', 'rejected', 'refunded'));

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  shop_id uuid references public.shops(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  subject text not null check (length(trim(subject)) between 3 and 120),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  message text not null check (length(trim(message)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  product_id uuid not null references public.products(id),
  changed_by uuid references public.profiles(id),
  quantity_delta numeric(12,3) not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_customer_idx
  on public.support_tickets (customer_id, updated_at desc);
create index if not exists support_tickets_shop_idx
  on public.support_tickets (shop_id, updated_at desc);
create index if not exists support_messages_ticket_idx
  on public.support_messages (ticket_id, created_at);
create index if not exists inventory_adjustments_shop_created_idx
  on public.inventory_adjustments (shop_id, created_at desc);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.inventory_adjustments enable row level security;

create or replace function public.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shops s
    where s.id = p_shop_id and s.owner_id = auth.uid()
  ) or exists (
    select 1
    from public.shop_members sm
    where sm.shop_id = p_shop_id and sm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_shop_member(uuid) from public;
grant execute on function public.is_shop_member(uuid) to anon;
grant execute on function public.is_shop_member(uuid) to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.phone), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

insert into public.profiles (id, full_name, phone)
select
  u.id,
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(u.phone), '')
from auth.users u
on conflict (id) do nothing;

create or replace function public.prevent_profile_role_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null then
    raise exception 'Profile role cannot be changed from the client';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on public.profiles;
create trigger profiles_role_guard
  before update on public.profiles
  for each row execute function public.prevent_profile_role_change();

create or replace function public.add_shop_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shop_members (shop_id, user_id, member_role)
  values (new.id, new.owner_id, 'owner')
  on conflict (shop_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists shops_add_owner_membership on public.shops;
create trigger shops_add_owner_membership
  after insert on public.shops
  for each row execute function public.add_shop_owner_membership();

insert into public.shop_members (shop_id, user_id, member_role)
select id, owner_id, 'owner' from public.shops
on conflict (shop_id, user_id) do nothing;

insert into public.categories (name, slug, sort_order)
values
  ('Fruits & vegetables', 'fruits-vegetables', 10),
  ('Dairy & bakery', 'dairy-bakery', 20),
  ('Rice & grains', 'rice-grains', 30),
  ('Daily essentials', 'daily-essentials', 40),
  ('Snacks & drinks', 'snacks-drinks', 50),
  ('Household care', 'household-care', 60)
on conflict (slug) do update
set name = excluded.name, sort_order = excluded.sort_order, is_active = true;

create or replace function public.validate_shop_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then
    if nullif(trim(new.phone), '') is null
      or nullif(trim(new.address_line), '') is null
      or nullif(trim(new.city), '') is null
      or nullif(trim(new.state), '') is null then
      raise exception 'Shop phone, street address, city, and state are required before publishing';
    end if;

    if not new.pickup_enabled and not new.delivery_enabled then
      raise exception 'Enable pickup or delivery before publishing';
    end if;

    if not exists (
      select 1
      from public.inventory i
      join public.products p on p.id = i.product_id
      where i.shop_id = new.id
        and i.is_available
        and i.available_quantity > 0
        and p.is_active
    ) then
      raise exception 'At least one active, in-stock product is required before publishing';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists shops_validate_activation on public.shops;
create trigger shops_validate_activation
  before insert or update of is_active on public.shops
  for each row execute function public.validate_shop_activation();

drop policy if exists active_shops_public_read on public.shops;
create policy active_shops_public_read on public.shops
for select to anon, authenticated
using (is_active = true or public.is_shop_member(id));

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
for select to anon, authenticated
using (is_active = true or created_by = auth.uid());

drop policy if exists available_inventory_public_read on public.inventory;
create policy available_inventory_public_read on public.inventory
for select to anon, authenticated
using (
  (
    is_available = true
    and available_quantity > 0
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.is_active = true
    )
  )
  or public.is_shop_member(shop_id)
);

drop policy if exists inventory_owner_insert on public.inventory;
create policy inventory_owner_insert on public.inventory
for insert to authenticated
with check (public.is_shop_member(shop_id));

drop policy if exists inventory_owner_update on public.inventory;
create policy inventory_owner_update on public.inventory
for update to authenticated
using (public.is_shop_member(shop_id))
with check (public.is_shop_member(shop_id));

drop policy if exists carts_customer_all on public.carts;
create policy carts_customer_read on public.carts
for select to authenticated using (customer_id = auth.uid());

drop policy if exists cart_items_customer_all on public.cart_items;
create policy cart_items_customer_read on public.cart_items
for select to authenticated
using (
  exists (
    select 1 from public.carts c
    where c.id = cart_id and c.customer_id = auth.uid()
  )
);

drop policy if exists orders_customer_insert on public.orders;
drop policy if exists orders_shop_owner_update on public.orders;
drop policy if exists orders_customer_or_shop_owner_read on public.orders;
create policy orders_customer_or_shop_owner_read on public.orders
for select to authenticated
using (customer_id = auth.uid() or public.is_shop_member(shop_id));

drop policy if exists order_items_related_read on public.order_items;
create policy order_items_related_read on public.order_items
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.customer_id = auth.uid() or public.is_shop_member(o.shop_id))
  )
);

drop policy if exists order_status_related_read on public.order_status_history;
create policy order_status_related_read on public.order_status_history
for select to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.customer_id = auth.uid() or public.is_shop_member(o.shop_id))
  )
);

drop policy if exists support_tickets_read on public.support_tickets;
create policy support_tickets_read on public.support_tickets
for select to authenticated
using (
  customer_id = auth.uid()
  or (shop_id is not null and public.is_shop_member(shop_id))
);

create policy inventory_adjustments_shop_read on public.inventory_adjustments
for select to authenticated
using (public.is_shop_member(shop_id));

create policy support_messages_read on public.support_messages
for select to authenticated
using (
  exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id
      and (
        t.customer_id = auth.uid()
        or (t.shop_id is not null and public.is_shop_member(t.shop_id))
      )
  )
);

create or replace function public.audit_inventory_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta numeric(12,3);
  v_reason text;
begin
  if tg_op = 'INSERT' then
    v_delta := new.available_quantity;
    v_reason := 'initial_stock';
  else
    v_delta := new.available_quantity - old.available_quantity;
    v_reason := coalesce(
      nullif(current_setting('kiranalink.stock_change_reason', true), ''),
      'manual_update'
    );
  end if;

  if v_delta <> 0 then
    insert into public.inventory_adjustments (
      shop_id, inventory_id, product_id, changed_by, quantity_delta, reason
    )
    values (new.shop_id, new.id, new.product_id, auth.uid(), v_delta, v_reason);
  end if;
  return new;
end;
$$;

drop trigger if exists inventory_adjustment_audit on public.inventory;
create trigger inventory_adjustment_audit
  after insert or update of available_quantity on public.inventory
  for each row execute function public.audit_inventory_adjustment();

create or replace function public.save_inventory_item(
  p_shop_id uuid,
  p_product_id uuid,
  p_name text,
  p_description text,
  p_category_id uuid,
  p_unit_label text,
  p_selling_price_paise integer,
  p_quantity numeric,
  p_low_stock_threshold numeric default 0,
  p_is_available boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid := p_product_id;
  v_inventory_id uuid;
begin
  if auth.uid() is null or not public.is_shop_member(p_shop_id) then
    raise exception 'Shop access denied';
  end if;
  if p_selling_price_paise is null or p_quantity is null or p_low_stock_threshold is null
    or p_is_available is null or p_selling_price_paise < 0 or p_quantity < 0
    or p_low_stock_threshold < 0 then
    raise exception 'Price and stock values cannot be negative';
  end if;
  if p_unit_label is null or length(trim(p_unit_label)) not between 1 and 32 then
    raise exception 'Enter a valid product unit';
  end if;

  if v_product_id is null then
    if length(trim(coalesce(p_name, ''))) not between 1 and 120 then
      raise exception 'Enter a product name';
    end if;
    insert into public.products (
      name, description, category_id, unit_label, created_by
    )
    values (
      trim(p_name), nullif(trim(p_description), ''), p_category_id,
      trim(p_unit_label), auth.uid()
    )
    returning id into v_product_id;
  else
    if not exists (
      select 1 from public.products p
      where p.id = v_product_id and p.is_active
    ) then
      raise exception 'Product not found';
    end if;
    if p_name is not null then
      update public.products
      set name = trim(p_name),
          description = nullif(trim(p_description), ''),
          category_id = p_category_id,
          unit_label = trim(p_unit_label)
      where id = v_product_id and created_by = auth.uid();
      if not found then raise exception 'Only the product creator can change its catalogue details'; end if;
    end if;
  end if;

  insert into public.inventory (
    shop_id, product_id, selling_price_paise, available_quantity,
    low_stock_threshold, is_available, updated_at
  )
  values (
    p_shop_id, v_product_id, p_selling_price_paise, p_quantity,
    p_low_stock_threshold, p_is_available, now()
  )
  on conflict (shop_id, product_id) do update
  set selling_price_paise = excluded.selling_price_paise,
      available_quantity = excluded.available_quantity,
      low_stock_threshold = excluded.low_stock_threshold,
      is_available = excluded.is_available,
      updated_at = now()
  returning id into v_inventory_id;

  return v_inventory_id;
end;
$$;

create or replace function public.add_to_cart(
  p_shop_id uuid,
  p_inventory_id uuid,
  p_quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_cart_id uuid;
  v_available numeric(12,3);
  v_existing numeric(12,3);
  v_shop_id uuid;
  v_item_id uuid;
begin
  if v_customer_id is null then raise exception 'Sign in is required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  select c.id into v_cart_id
  from public.carts c
  where c.customer_id = v_customer_id and c.shop_id = p_shop_id
  for update;

  if v_cart_id is null then
    insert into public.carts (customer_id, shop_id)
    values (v_customer_id, p_shop_id)
    on conflict (customer_id, shop_id) do update set updated_at = now()
    returning id into v_cart_id;
  end if;

  select i.shop_id, i.available_quantity
  into v_shop_id, v_available
  from public.inventory i
  join public.shops s on s.id = i.shop_id
  where i.id = p_inventory_id and i.is_available and s.is_active
  for update of i;

  if not found or v_shop_id <> p_shop_id then
    raise exception 'This item is not available from the selected shop';
  end if;

  select ci.id, ci.quantity into v_item_id, v_existing
  from public.cart_items ci
  where ci.cart_id = v_cart_id and ci.inventory_id = p_inventory_id
  for update;

  if coalesce(v_existing, 0) + p_quantity > v_available then
    raise exception 'Requested quantity exceeds available stock';
  end if;

  if v_item_id is null then
    insert into public.cart_items (cart_id, inventory_id, quantity)
    values (v_cart_id, p_inventory_id, p_quantity)
    returning id into v_item_id;
  else
    update public.cart_items
    set quantity = v_existing + p_quantity
    where id = v_item_id;
  end if;

  update public.carts set updated_at = now() where id = v_cart_id;
  return v_item_id;
end;
$$;

create or replace function public.set_cart_item_quantity(
  p_cart_item_id uuid,
  p_quantity numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_available numeric(12,3);
begin
  if v_customer_id is null then raise exception 'Sign in is required'; end if;
  if p_quantity is null or p_quantity < 0 then raise exception 'Quantity cannot be negative'; end if;

  if p_quantity = 0 then
    delete from public.cart_items ci
    using public.carts c
    where ci.id = p_cart_item_id and ci.cart_id = c.id
      and c.customer_id = v_customer_id;
    if not found then raise exception 'Cart item not found'; end if;
    return;
  end if;

  select i.available_quantity into v_available
  from public.cart_items ci
  join public.carts c on c.id = ci.cart_id
  join public.inventory i on i.id = ci.inventory_id
  where ci.id = p_cart_item_id and c.customer_id = v_customer_id and i.is_available
  for update of i;

  if not found then raise exception 'Cart item is no longer available'; end if;
  if p_quantity > v_available then raise exception 'Requested quantity exceeds available stock'; end if;

  update public.cart_items ci set quantity = p_quantity
  from public.carts c
  where ci.id = p_cart_item_id and ci.cart_id = c.id
    and c.customer_id = v_customer_id;
end;
$$;

create or replace function public.checkout_cart(
  p_cart_id uuid,
  p_fulfillment_type text,
  p_address_id uuid default null,
  p_payment_method text default 'cash',
  p_customer_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_cart public.carts%rowtype;
  v_shop public.shops%rowtype;
  v_address public.addresses%rowtype;
  v_item record;
  v_order_id uuid;
  v_subtotal integer := 0;
  v_line_total integer;
  v_delivery_fee integer := 0;
  v_item_count integer;
begin
  if v_customer_id is null then raise exception 'Sign in is required'; end if;
  if p_fulfillment_type is null or p_fulfillment_type not in ('pickup', 'delivery') then
    raise exception 'Choose pickup or delivery';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'upi') then
    raise exception 'Choose cash or UPI';
  end if;

  select * into v_cart from public.carts
  where id = p_cart_id and customer_id = v_customer_id
  for update;
  if not found then raise exception 'Cart not found'; end if;

  select * into v_shop from public.shops
  where id = v_cart.shop_id and is_active;
  if not found then raise exception 'Shop is not accepting orders'; end if;
  if p_payment_method = 'upi' and nullif(trim(v_shop.upi_id), '') is null then
    raise exception 'This shop has not configured UPI payments';
  end if;
  if p_fulfillment_type = 'pickup' and not v_shop.pickup_enabled then
    raise exception 'Pickup is not available from this shop';
  end if;
  if p_fulfillment_type = 'delivery' and not v_shop.delivery_enabled then
    raise exception 'Delivery is not available from this shop';
  end if;

  if p_fulfillment_type = 'delivery' then
    select * into v_address from public.addresses
    where id = p_address_id and customer_id = v_customer_id;
    if not found then raise exception 'Choose a saved delivery address'; end if;
    v_delivery_fee := v_shop.delivery_fee_paise;
  end if;

  perform 1
  from public.cart_items ci
  join public.inventory i on i.id = ci.inventory_id
  where ci.cart_id = v_cart.id
  order by i.id
  for update of i;

  select count(*) into v_item_count
  from public.cart_items ci where ci.cart_id = v_cart.id;
  if v_item_count = 0 then raise exception 'Your cart is empty'; end if;

  for v_item in
    select ci.inventory_id, ci.quantity, i.selling_price_paise,
      i.available_quantity, i.is_available, p.name, p.unit_label,
      p.id as product_id
    from public.cart_items ci
    join public.inventory i on i.id = ci.inventory_id
    join public.products p on p.id = i.product_id
    where ci.cart_id = v_cart.id
    order by i.id
  loop
    if not v_item.is_available or v_item.available_quantity < v_item.quantity then
      raise exception 'Stock changed for %; update your cart and try again', v_item.name;
    end if;
    v_line_total := round(v_item.selling_price_paise * v_item.quantity)::integer;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  if v_subtotal < v_shop.minimum_order_paise then
    raise exception 'Order does not meet the shop minimum';
  end if;

  insert into public.orders (
    customer_id, shop_id, address_id, delivery_address_snapshot,
    fulfillment_type, subtotal_paise, delivery_fee_paise, total_paise,
    payment_method, payment_status, customer_note, upi_id_snapshot
  )
  values (
    v_customer_id, v_shop.id, p_address_id,
    case when p_fulfillment_type = 'delivery' then
      jsonb_build_object(
        'recipient_name', v_address.recipient_name,
        'phone', v_address.phone,
        'address_line', v_address.address_line,
        'locality', v_address.locality,
        'city', v_address.city,
        'state', v_address.state,
        'postal_code', v_address.postal_code
      )
    else null end,
    p_fulfillment_type, v_subtotal, v_delivery_fee,
    v_subtotal + v_delivery_fee, p_payment_method, 'pending',
    nullif(trim(p_customer_note), ''), v_shop.upi_id
  )
  returning id into v_order_id;

  for v_item in
    select ci.inventory_id, ci.quantity, i.selling_price_paise,
      p.name, p.unit_label, p.id as product_id
    from public.cart_items ci
    join public.inventory i on i.id = ci.inventory_id
    join public.products p on p.id = i.product_id
    where ci.cart_id = v_cart.id
    order by i.id
  loop
    v_line_total := round(v_item.selling_price_paise * v_item.quantity)::integer;
    insert into public.order_items (
      order_id, product_id, product_name_snapshot, unit_label_snapshot,
      unit_price_paise, quantity, line_total_paise
    )
    values (
      v_order_id, v_item.product_id, v_item.name, v_item.unit_label,
      v_item.selling_price_paise, v_item.quantity, v_line_total
    );

    perform set_config('kiranalink.stock_change_reason', 'order_reservation', true);
    update public.inventory
    set available_quantity = available_quantity - v_item.quantity,
        updated_at = now()
    where id = v_item.inventory_id;
  end loop;

  insert into public.order_status_history (order_id, changed_by, new_status, note)
  values (v_order_id, v_customer_id, 'placed', 'Order placed');
  delete from public.cart_items where cart_id = v_cart.id;
  update public.carts set updated_at = now() where id = v_cart.id;
  return v_order_id;
end;
$$;

create or replace function public.change_order_status(
  p_order_id uuid,
  p_new_status public.order_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_is_customer boolean;
  v_allowed boolean := false;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_note is not null and length(trim(p_note)) > 500 then
    raise exception 'Order status note is too long';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  v_is_customer := v_order.customer_id = auth.uid();

  if v_is_customer then
    v_allowed := p_new_status = 'cancelled'
      and v_order.status = 'placed'
      and v_order.payment_status = 'pending';
  elsif public.is_shop_member(v_order.shop_id) then
    v_allowed := case v_order.status
      when 'placed' then p_new_status in ('accepted', 'rejected', 'cancelled')
      when 'accepted' then p_new_status in ('packing', 'cancelled')
      when 'packing' then
        p_new_status = 'cancelled'
        or (
          v_order.fulfillment_type = 'pickup'
          and p_new_status = 'ready_for_pickup'
        )
        or (
          v_order.fulfillment_type = 'delivery'
          and p_new_status = 'out_for_delivery'
        )
      when 'ready_for_pickup' then p_new_status in ('delivered', 'cancelled')
      when 'out_for_delivery' then p_new_status in ('delivered', 'cancelled')
      else false
    end;
  end if;

  if not v_allowed then raise exception 'This order status transition is not allowed'; end if;
  if p_new_status in ('cancelled', 'rejected')
    and v_order.payment_status in ('submitted', 'paid') then
    raise exception 'Resolve the submitted payment or refund before cancelling this order';
  end if;

  update public.orders
  set status = p_new_status, updated_at = now()
  where id = p_order_id;

  if p_new_status in ('cancelled', 'rejected') then
    perform set_config('kiranalink.stock_change_reason', 'order_restored', true);
    update public.inventory i
    set available_quantity = i.available_quantity + oi.quantity,
        updated_at = now()
    from public.order_items oi
    where oi.order_id = p_order_id
      and i.shop_id = v_order.shop_id and i.product_id = oi.product_id;
  end if;

  insert into public.order_status_history (
    order_id, changed_by, old_status, new_status, note
  )
  values (p_order_id, auth.uid(), v_order.status, p_new_status, nullif(trim(p_note), ''));
end;
$$;

create or replace function public.submit_upi_payment(
  p_order_id uuid,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_reference is null or length(trim(p_reference)) not between 4 and 80 then
    raise exception 'Enter a valid UPI transaction reference';
  end if;
  update public.orders
  set payment_reference = trim(p_reference),
      payment_status = 'submitted',
      updated_at = now()
  where id = p_order_id
    and customer_id = auth.uid()
    and payment_method = 'upi'
    and payment_status in ('pending', 'rejected')
    and status in ('accepted', 'packing', 'ready_for_pickup', 'out_for_delivery', 'delivered')
    and status not in ('cancelled', 'rejected');
  if not found then raise exception 'This order cannot accept a UPI reference'; end if;
end;
$$;

create or replace function public.verify_upi_payment(
  p_order_id uuid,
  p_approved boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_approved is null then raise exception 'Choose whether to approve or reject the payment'; end if;
  if p_note is not null and length(trim(p_note)) > 500 then
    raise exception 'Payment review note is too long';
  end if;
  update public.orders o
  set payment_status = case when p_approved then 'paid' else 'rejected' end,
      payment_verified_by = auth.uid(),
      payment_verified_at = now(),
      payment_review_note = nullif(trim(p_note), ''),
      updated_at = now()
  where o.id = p_order_id
    and o.payment_method = 'upi'
    and o.payment_status = 'submitted'
    and public.is_shop_member(o.shop_id);
  if not found then raise exception 'Payment is not awaiting verification'; end if;
end;
$$;

create or replace function public.mark_cash_paid(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  update public.orders o
  set payment_status = 'paid',
      payment_verified_by = auth.uid(),
      payment_verified_at = now(),
      updated_at = now()
  where o.id = p_order_id
    and o.payment_method = 'cash'
    and o.payment_status = 'pending'
    and o.status not in ('cancelled', 'rejected')
    and public.is_shop_member(o.shop_id);
  if not found then raise exception 'Cash payment cannot be recorded for this order'; end if;
end;
$$;

create or replace function public.get_retailer_summary(
  p_shop_id uuid,
  p_from date default current_date,
  p_to date default current_date
)
returns table (
  order_count bigint,
  gross_sales_paise bigint,
  pending_orders bigint,
  low_stock_items bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_shop_member(p_shop_id) then
    raise exception 'Shop access denied';
  end if;
  if p_from > p_to or p_to - p_from > 366 then
    raise exception 'Choose a report period of 366 days or less';
  end if;

  return query
  select
    count(o.id),
    coalesce(sum(o.total_paise) filter (where o.status not in ('cancelled', 'rejected')), 0),
    count(o.id) filter (where o.status in ('placed', 'accepted', 'packing')),
    (select count(*) from public.inventory i
     where i.shop_id = p_shop_id and i.is_available
       and i.available_quantity <= i.low_stock_threshold)
  from public.orders o
  where o.shop_id = p_shop_id
    and o.created_at >= p_from::timestamptz
    and o.created_at < (p_to + 1)::timestamptz;
end;
$$;

create or replace function public.create_support_ticket(
  p_subject text,
  p_message text,
  p_order_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_id uuid;
  v_shop_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if length(trim(p_subject)) not between 3 and 120
    or length(trim(p_message)) not between 1 and 4000 then
    raise exception 'Enter a subject and message';
  end if;

  if p_order_id is not null then
    select shop_id into v_shop_id from public.orders
    where id = p_order_id and customer_id = auth.uid();
    if not found then raise exception 'Order not found'; end if;
  end if;

  insert into public.support_tickets (customer_id, shop_id, order_id, subject)
  values (auth.uid(), v_shop_id, p_order_id, trim(p_subject))
  returning id into v_ticket_id;

  insert into public.support_messages (ticket_id, sender_id, message)
  values (v_ticket_id, auth.uid(), trim(p_message));
  return v_ticket_id;
end;
$$;

create or replace function public.reply_to_support_ticket(
  p_ticket_id uuid,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if length(trim(p_message)) not between 1 and 4000 then
    raise exception 'Message cannot be empty';
  end if;

  select * into v_ticket from public.support_tickets
  where id = p_ticket_id for update;
  if not found then raise exception 'Support ticket not found'; end if;
  if v_ticket.customer_id <> auth.uid()
    and (v_ticket.shop_id is null or not public.is_shop_member(v_ticket.shop_id)) then
    raise exception 'Support ticket access denied';
  end if;
  if v_ticket.status = 'resolved' then raise exception 'This ticket is resolved'; end if;

  insert into public.support_messages (ticket_id, sender_id, message)
  values (p_ticket_id, auth.uid(), trim(p_message));
  update public.support_tickets set updated_at = now() where id = p_ticket_id;
end;
$$;

create or replace function public.set_support_ticket_status(
  p_ticket_id uuid,
  p_resolved boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets%rowtype;
begin
  if auth.uid() is null or p_resolved is null then
    raise exception 'Sign in and choose a ticket status';
  end if;
  select * into v_ticket from public.support_tickets
  where id = p_ticket_id for update;
  if not found then raise exception 'Support ticket not found'; end if;
  if v_ticket.shop_id is null or not public.is_shop_member(v_ticket.shop_id) then
    raise exception 'Only the assigned shop can resolve this ticket';
  end if;
  update public.support_tickets
  set status = case when p_resolved then 'resolved' else 'open' end,
      updated_at = now()
  where id = p_ticket_id;
end;
$$;

grant select on public.support_tickets, public.support_messages, public.inventory_adjustments to authenticated;
revoke insert, update, delete on public.support_tickets, public.support_messages from authenticated;

revoke all on function public.save_inventory_item(
  uuid, uuid, text, text, uuid, text, integer, numeric, numeric, boolean
) from public;
revoke all on function public.add_to_cart(uuid, uuid, numeric) from public;
revoke all on function public.set_cart_item_quantity(uuid, numeric) from public;
revoke all on function public.checkout_cart(uuid, text, uuid, text, text) from public;
revoke all on function public.change_order_status(uuid, public.order_status, text) from public;
revoke all on function public.submit_upi_payment(uuid, text) from public;
revoke all on function public.verify_upi_payment(uuid, boolean, text) from public;
revoke all on function public.mark_cash_paid(uuid) from public;
revoke all on function public.get_retailer_summary(uuid, date, date) from public;
revoke all on function public.create_support_ticket(text, text, uuid) from public;
revoke all on function public.reply_to_support_ticket(uuid, text) from public;
revoke all on function public.set_support_ticket_status(uuid, boolean) from public;

grant execute on function public.add_to_cart(uuid, uuid, numeric) to authenticated;
grant execute on function public.save_inventory_item(
  uuid, uuid, text, text, uuid, text, integer, numeric, numeric, boolean
) to authenticated;
grant execute on function public.set_cart_item_quantity(uuid, numeric) to authenticated;
grant execute on function public.checkout_cart(uuid, text, uuid, text, text) to authenticated;
grant execute on function public.change_order_status(uuid, public.order_status, text) to authenticated;
grant execute on function public.submit_upi_payment(uuid, text) to authenticated;
grant execute on function public.verify_upi_payment(uuid, boolean, text) to authenticated;
grant execute on function public.mark_cash_paid(uuid) to authenticated;
grant execute on function public.get_retailer_summary(uuid, date, date) to authenticated;
grant execute on function public.create_support_ticket(text, text, uuid) to authenticated;
grant execute on function public.reply_to_support_ticket(uuid, text) to authenticated;
grant execute on function public.set_support_ticket_status(uuid, boolean) to authenticated;
