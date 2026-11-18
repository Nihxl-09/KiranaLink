-- Merchant subscriptions, sponsored placement and product pool ordering.
-- Apply after 0004_push_notifications.sql.

create table if not exists public.merchant_plan_catalog (
  plan_key text primary key check (plan_key in ('trial', 'basic', 'advanced')),
  display_name text not null,
  monthly_price_paise integer not null check (monthly_price_paise >= 0),
  trial_months integer not null default 0 check (trial_months >= 0),
  feature_summary text not null,
  razorpay_plan_id text unique
);

insert into public.merchant_plan_catalog (
  plan_key, display_name, monthly_price_paise, trial_months, feature_summary
)
values
  ('trial', '3-month trial', 0, 3, 'Core shop tools at no charge for three months after first publication.'),
  ('basic', 'Basic', 29900, 0, 'One shop, catalogue, orders and standard reports.'),
  ('advanced', 'Advanced', 59900, 0, 'Basic features plus advanced reporting, staff access and priority placement.')
on conflict (plan_key) do update
set display_name = excluded.display_name,
    monthly_price_paise = excluded.monthly_price_paise,
    trial_months = excluded.trial_months,
    feature_summary = excluded.feature_summary;

create table if not exists public.merchant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references public.profiles(id) on delete cascade,
  plan_key text not null references public.merchant_plan_catalog(plan_key),
  status text not null check (status in (
    'trialing', 'pending', 'active', 'past_due', 'paused', 'cancelled', 'expired'
  )),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancel_requested_at timestamptz,
  razorpay_subscription_id text unique,
  checkout_url text,
  checkout_lock_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchant_subscriptions_status_idx
  on public.merchant_subscriptions (status, trial_ends_at);

create table if not exists public.shop_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  advertiser_id uuid not null references public.profiles(id),
  target_type text not null check (target_type in ('store', 'product')),
  product_id uuid references public.products(id),
  duration_days integer not null check (duration_days between 7 and 365),
  amount_paise integer not null check (amount_paise >= 59900),
  status text not null default 'pending_payment'
    check (status in ('pending_payment', 'active', 'expired', 'cancelled')),
  razorpay_payment_link_id text unique,
  payment_url text,
  payment_link_expires_at timestamptz,
  payment_link_lock_until timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shop_ad_campaign_product_target_check
    check ((target_type = 'store' and product_id is null) or
           (target_type = 'product' and product_id is not null))
);

create index if not exists shop_ad_campaigns_live_idx
  on public.shop_ad_campaigns (status, starts_at, ends_at);
create index if not exists shop_ad_campaigns_shop_idx
  on public.shop_ad_campaigns (shop_id, created_at desc);

create table if not exists public.product_pools (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id),
  created_by uuid not null references public.profiles(id),
  product_name_snapshot text not null,
  unit_label_snapshot text not null,
  regular_unit_price_paise integer not null check (regular_unit_price_paise > 0),
  pool_unit_price_paise integer not null check (pool_unit_price_paise > 0),
  target_quantity numeric(12,3) not null check (target_quantity >= 2),
  joined_quantity numeric(12,3) not null default 0 check (joined_quantity >= 0),
  ends_at timestamptz not null,
  status text not null default 'open'
    check (status in ('open', 'fulfilled', 'expired', 'cancelled')),
  created_at timestamptz not null default now(),
  check (pool_unit_price_paise < regular_unit_price_paise)
);

create index if not exists product_pools_open_idx
  on public.product_pools (status, ends_at);
create index if not exists product_pools_shop_idx
  on public.product_pools (shop_id, created_at desc);

create table if not exists public.pool_contributions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.product_pools(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  quantity numeric(12,3) not null check (quantity > 0),
  fulfillment_type text not null check (fulfillment_type in ('pickup', 'delivery')),
  address_id uuid references public.addresses(id),
  payment_method text not null check (payment_method in ('cash', 'upi')),
  status text not null default 'joined'
    check (status in ('joined', 'withdrawn', 'ordered')),
  order_id uuid references public.orders(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, customer_id),
  check ((fulfillment_type = 'delivery' and address_id is not null) or
         (fulfillment_type = 'pickup' and address_id is null))
);

create index if not exists pool_contributions_customer_idx
  on public.pool_contributions (customer_id, created_at desc);
create index if not exists pool_contributions_pool_idx
  on public.pool_contributions (pool_id, status);

create table if not exists public.razorpay_webhook_events (
  event_id text primary key,
  event_type text not null,
  processing_at timestamptz,
  processed_at timestamptz,
  attempts integer not null default 1,
  last_error text,
  received_at timestamptz not null default now()
);

alter table public.merchant_plan_catalog enable row level security;
alter table public.merchant_subscriptions enable row level security;
alter table public.shop_ad_campaigns enable row level security;
alter table public.product_pools enable row level security;
alter table public.pool_contributions enable row level security;
alter table public.razorpay_webhook_events enable row level security;

revoke all on public.merchant_plan_catalog, public.merchant_subscriptions,
  public.shop_ad_campaigns, public.product_pools, public.pool_contributions,
  public.razorpay_webhook_events from anon, authenticated;
grant select on public.merchant_plan_catalog, public.merchant_subscriptions,
  public.shop_ad_campaigns, public.product_pools, public.pool_contributions to authenticated;
grant select on public.shop_ad_campaigns, public.product_pools to anon;

create policy merchant_plan_catalog_read on public.merchant_plan_catalog
for select to anon, authenticated using (true);

drop policy if exists shop_members_read_shop_owner on public.shop_members;
create policy shop_members_read_shop_owner on public.shop_members
for select to authenticated using (
  exists (
    select 1 from public.shops s
    where s.id = shop_id and s.owner_id = auth.uid()
  )
);

drop policy if exists profiles_select_shop_members on public.profiles;
create policy profiles_select_shop_members on public.profiles
for select to authenticated using (
  exists (
    select 1
    from public.shop_members member
    join public.shops s on s.id = member.shop_id
    where member.user_id = id and s.owner_id = auth.uid()
  )
);

create or replace function public.shop_subscription_access(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shops s
    join public.merchant_subscriptions ms on ms.merchant_id = s.owner_id
    where s.id = p_shop_id
      and (
        ms.status = 'active'
        or (ms.status = 'trialing' and ms.trial_ends_at > now())
      )
  );
$$;

revoke all on function public.shop_subscription_access(uuid) from public;
grant execute on function public.shop_subscription_access(uuid) to anon, authenticated;

create or replace function public.get_priority_shop_ids()
returns table (shop_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.shops s
  join public.merchant_subscriptions ms on ms.merchant_id = s.owner_id
  where s.is_active
    and public.shop_subscription_access(s.id)
    and (
      ms.plan_key = 'advanced'
      or (ms.status = 'trialing' and ms.trial_ends_at > now())
    );
$$;

revoke all on function public.get_priority_shop_ids() from public;
grant execute on function public.get_priority_shop_ids() to anon, authenticated;

drop policy if exists active_shops_public_read on public.shops;
create policy active_shops_public_read on public.shops
for select to anon, authenticated
using ((is_active and public.shop_subscription_access(id)) or public.is_shop_member(id));

drop policy if exists available_inventory_public_read on public.inventory;
create policy available_inventory_public_read on public.inventory
for select to anon, authenticated
using (
  (
    is_available
    and available_quantity > 0
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.is_active and public.shop_subscription_access(s.id)
    )
  )
  or public.is_shop_member(shop_id)
);

drop policy if exists merchant_subscriptions_read_self on public.merchant_subscriptions;
create policy merchant_subscriptions_read_self on public.merchant_subscriptions
for select to authenticated using (merchant_id = auth.uid());

drop policy if exists shop_ad_campaigns_public_live on public.shop_ad_campaigns;
create policy shop_ad_campaigns_public_live on public.shop_ad_campaigns
for select to anon, authenticated using (
  status = 'active'
  and starts_at <= now()
  and ends_at > now()
  and exists (
    select 1 from public.shops s
    where s.id = shop_id and s.is_active and public.shop_subscription_access(s.id)
  )
);
drop policy if exists shop_ad_campaigns_shop_member_read on public.shop_ad_campaigns;
create policy shop_ad_campaigns_shop_member_read on public.shop_ad_campaigns
for select to authenticated using (public.is_shop_member(shop_id));

create or replace function public.is_product_pool_participant(p_pool_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.pool_contributions pc
    where pc.pool_id = p_pool_id and pc.customer_id = auth.uid()
  );
$$;

revoke all on function public.is_product_pool_participant(uuid) from public;
grant execute on function public.is_product_pool_participant(uuid) to authenticated;

drop policy if exists product_pools_open_read on public.product_pools;
create policy product_pools_open_read on public.product_pools
for select to authenticated using (
  (
    status = 'open'
    and ends_at > now()
    and exists (
      select 1 from public.shops s
      where s.id = shop_id and s.is_active and public.shop_subscription_access(s.id)
    )
  )
  or public.is_shop_member(shop_id)
  or public.is_product_pool_participant(id)
);

drop policy if exists pool_contributions_related_read on public.pool_contributions;
create policy pool_contributions_related_read on public.pool_contributions
for select to authenticated using (
  customer_id = auth.uid()
  or exists (
    select 1 from public.product_pools pp
    where pp.id = pool_id and public.is_shop_member(pp.shop_id)
  )
);

create or replace function public.start_merchant_trial_on_publication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    insert into public.merchant_subscriptions (
      merchant_id, plan_key, status, trial_started_at, trial_ends_at
    )
    values (
      new.owner_id, 'trial', 'trialing', now(), now() + interval '3 months'
    )
    on conflict (merchant_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists shops_start_merchant_trial on public.shops;
create trigger shops_start_merchant_trial
  after insert or update of is_active on public.shops
  for each row execute function public.start_merchant_trial_on_publication();

insert into public.merchant_subscriptions (
  merchant_id, plan_key, status, trial_started_at, trial_ends_at
)
select distinct s.owner_id, 'trial', 'trialing', now(), now() + interval '3 months'
from public.shops s
where s.is_active
on conflict (merchant_id) do nothing;

create or replace function public.enforce_shop_subscription_for_orders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.shop_subscription_access(new.shop_id) then
    raise exception 'This shop subscription is not active';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_require_shop_subscription on public.orders;
create trigger orders_require_shop_subscription
  before insert on public.orders
  for each row execute function public.enforce_shop_subscription_for_orders();

create or replace function public.add_shop_member_by_email(
  p_shop_id uuid,
  p_email text,
  p_member_role text default 'staff'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_owner_id uuid;
  v_member_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select s.owner_id into v_owner_id
  from public.shops s
  where s.id = p_shop_id;
  if not found or v_owner_id <> auth.uid() then raise exception 'Shop owner access required'; end if;
  if p_member_role not in ('manager', 'staff') then
    raise exception 'Choose manager or staff access';
  end if;
  if p_email is null or length(trim(p_email)) > 254
    or trim(p_email) !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9-]+(\.[A-Z0-9-]+)+$' then
    raise exception 'Enter a valid account email';
  end if;
  if not exists (
    select 1 from public.merchant_subscriptions ms
    where ms.merchant_id = v_owner_id
      and (
        (ms.status = 'active' and ms.plan_key = 'advanced')
        or (ms.status = 'trialing' and ms.trial_ends_at > now())
      )
  ) then
    raise exception 'Staff access is included with Advanced and the active trial';
  end if;

  select u.id into v_member_id
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
    and u.deleted_at is null;
  if not found then
    raise exception 'This email does not have a KiranaLink account yet';
  end if;
  if v_member_id = v_owner_id then raise exception 'The shop owner is already a member'; end if;

  insert into public.shop_members (shop_id, user_id, member_role)
  values (p_shop_id, v_member_id, p_member_role)
  on conflict (shop_id, user_id) do update set member_role = excluded.member_role;
  return v_member_id;
end;
$$;

revoke all on function public.add_shop_member_by_email(uuid, text, text) from public;
grant execute on function public.add_shop_member_by_email(uuid, text, text) to authenticated;

create or replace function public.remove_shop_member(
  p_shop_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if not exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.owner_id = auth.uid()
  ) then
    raise exception 'Shop owner access required';
  end if;
  delete from public.shop_members
  where shop_id = p_shop_id
    and user_id = p_user_id
    and member_role in ('manager', 'staff');
  if not found then raise exception 'Team member not found'; end if;
end;
$$;

revoke all on function public.remove_shop_member(uuid, uuid) from public;
grant execute on function public.remove_shop_member(uuid, uuid) to authenticated;

create or replace function public.create_shop_ad_campaign(
  p_shop_id uuid,
  p_target_type text,
  p_product_id uuid,
  p_duration_days integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_campaign_id uuid;
  v_amount integer;
begin
  if auth.uid() is null or not public.is_shop_member(p_shop_id) then
    raise exception 'Shop access denied';
  end if;
  if p_duration_days is null or p_duration_days not between 7 and 365 then
    raise exception 'Choose an advertising duration from 7 to 365 days';
  end if;
  if p_target_type is null or p_target_type not in ('store', 'product')
    or (p_target_type = 'store' and p_product_id is not null)
    or (p_target_type = 'product' and p_product_id is null) then
    raise exception 'Choose a store or product advertisement';
  end if;
  if not exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.is_active and public.shop_subscription_access(s.id)
  ) then
    raise exception 'Publish your shop and start an active trial or subscription before advertising';
  end if;

  if p_target_type = 'product' then
    select p.* into v_product
    from public.products p
    join public.inventory i on i.product_id = p.id
    where p.id = p_product_id
      and p.is_active
      and i.shop_id = p_shop_id
      and i.is_available
      and i.available_quantity > 0;
    if not found then raise exception 'Choose an available product from your shop'; end if;
  end if;

  v_amount := ceil(59900::numeric * p_duration_days / 7)::integer;
  insert into public.shop_ad_campaigns (
    shop_id, advertiser_id, target_type, product_id, duration_days, amount_paise
  )
  values (
    p_shop_id, auth.uid(), p_target_type, p_product_id, p_duration_days, v_amount
  )
  returning id into v_campaign_id;
  return v_campaign_id;
end;
$$;

revoke all on function public.create_shop_ad_campaign(uuid, text, uuid, integer) from public;
grant execute on function public.create_shop_ad_campaign(uuid, text, uuid, integer) to authenticated;

create or replace function public.create_product_pool(
  p_shop_id uuid,
  p_product_id uuid,
  p_target_quantity numeric,
  p_pool_unit_price_paise integer,
  p_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_inventory public.inventory%rowtype;
  v_pool_id uuid;
begin
  if auth.uid() is null or not public.is_shop_member(p_shop_id) then
    raise exception 'Shop access denied';
  end if;
  if not exists (
    select 1 from public.shops s
    where s.id = p_shop_id and s.is_active and public.shop_subscription_access(s.id)
  ) then
    raise exception 'Publish your shop and start an active trial or subscription before creating a pool';
  end if;
  if p_target_quantity is null or p_target_quantity < 2
    or p_target_quantity <> round(p_target_quantity, 3) then
    raise exception 'Set a pool target of at least 2 units, up to 3 decimal places';
  end if;
  if p_ends_at is null or p_ends_at < now() + interval '1 hour'
    or p_ends_at > now() + interval '30 days' then
    raise exception 'Choose a pool deadline between 1 hour and 30 days from now';
  end if;

  select i.* into v_inventory
  from public.inventory i
  where i.shop_id = p_shop_id and i.product_id = p_product_id
  for update;
  if not found or not v_inventory.is_available then
    raise exception 'This product is not available in your shop';
  end if;
  if v_inventory.available_quantity < p_target_quantity then
    raise exception 'The pool target cannot exceed current available stock';
  end if;
  select p.* into v_product from public.products p
  where p.id = p_product_id and p.is_active;
  if not found then raise exception 'Choose an active product'; end if;
  if p_pool_unit_price_paise is null or p_pool_unit_price_paise <= 0
    or p_pool_unit_price_paise >= v_inventory.selling_price_paise then
    raise exception 'The pooled price must be positive and lower than the regular price';
  end if;

  insert into public.product_pools (
    shop_id, product_id, created_by, product_name_snapshot, unit_label_snapshot,
    regular_unit_price_paise, pool_unit_price_paise, target_quantity, ends_at
  )
  values (
    p_shop_id, p_product_id, auth.uid(), v_product.name, v_product.unit_label,
    v_inventory.selling_price_paise, p_pool_unit_price_paise, p_target_quantity, p_ends_at
  )
  returning id into v_pool_id;
  return v_pool_id;
end;
$$;

revoke all on function public.create_product_pool(uuid, uuid, numeric, integer, timestamptz) from public;
grant execute on function public.create_product_pool(uuid, uuid, numeric, integer, timestamptz) to authenticated;

create or replace function public.expire_product_pools()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  update public.product_pools
  set status = 'expired'
  where status = 'open' and ends_at <= now();
end;
$$;

revoke all on function public.expire_product_pools() from public;
grant execute on function public.expire_product_pools() to authenticated;

create or replace function public.expire_ad_campaigns()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  update public.shop_ad_campaigns
  set status = 'expired'
  where status = 'active' and ends_at <= now();
end;
$$;

revoke all on function public.expire_ad_campaigns() from public;
grant execute on function public.expire_ad_campaigns() to authenticated;

create or replace function public.leave_product_pool(p_pool_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pool public.product_pools%rowtype;
  v_contribution public.pool_contributions%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select * into v_pool from public.product_pools where id = p_pool_id for update;
  if not found then raise exception 'Pool not found'; end if;
  if v_pool.status <> 'open' or v_pool.ends_at <= now() then
    raise exception 'This pool no longer accepts changes';
  end if;
  select * into v_contribution from public.pool_contributions
  where pool_id = p_pool_id and customer_id = auth.uid() and status = 'joined'
  for update;
  if not found then raise exception 'You have no active reservation in this pool'; end if;

  update public.pool_contributions
  set status = 'withdrawn', updated_at = now()
  where id = v_contribution.id;
  update public.product_pools
  set joined_quantity = greatest(0, joined_quantity - v_contribution.quantity)
  where id = p_pool_id;
end;
$$;

revoke all on function public.leave_product_pool(uuid) from public;
grant execute on function public.leave_product_pool(uuid) to authenticated;

create or replace function public.claim_merchant_subscription_checkout(
  p_merchant_id uuid,
  p_plan_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription public.merchant_subscriptions%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role is required'; end if;
  if p_plan_key is null or p_plan_key not in ('basic', 'advanced') then
    raise exception 'Choose a paid plan';
  end if;
  select * into v_subscription
  from public.merchant_subscriptions
  where merchant_id = p_merchant_id
  for update;
  if not found then raise exception 'Publish your shop to start a trial before selecting a plan'; end if;
  if v_subscription.status = 'active' then
    if v_subscription.plan_key <> p_plan_key then
      raise exception 'Plan changes are unavailable while a subscription is active';
    end if;
    return jsonb_build_object('action', 'active', 'plan_key', v_subscription.plan_key);
  end if;
  if v_subscription.status in ('past_due', 'paused') then
    raise exception 'Resolve the current subscription with Razorpay before starting another plan';
  end if;
  if v_subscription.status in ('cancelled', 'expired')
    and v_subscription.razorpay_subscription_id is not null then
    update public.merchant_subscriptions
    set razorpay_subscription_id = null,
        checkout_url = null
    where id = v_subscription.id;
    v_subscription.razorpay_subscription_id := null;
    v_subscription.checkout_url := null;
  end if;
  if v_subscription.razorpay_subscription_id is not null then
    if v_subscription.plan_key <> p_plan_key then
      raise exception 'A plan checkout is already configured; finish it before choosing another plan';
    end if;
    if nullif(v_subscription.checkout_url, '') is null then
      raise exception 'The existing Razorpay checkout is unavailable; contact support';
    end if;
    return jsonb_build_object(
      'action', 'reuse',
      'checkout_url', v_subscription.checkout_url,
      'plan_key', v_subscription.plan_key
    );
  end if;
  if v_subscription.checkout_lock_until > now() then
    raise exception 'A plan checkout is already being prepared; try again shortly';
  end if;

  update public.merchant_subscriptions
  set plan_key = p_plan_key,
      status = case when trial_ends_at > now() then 'trialing' else 'pending' end,
      cancel_at_period_end = false,
      cancel_requested_at = null,
      checkout_lock_until = now() + interval '3 minutes',
      updated_at = now()
  where id = v_subscription.id;
  return jsonb_build_object(
    'action', 'create',
    'subscription_id', v_subscription.id,
    'plan_key', p_plan_key,
    'trial_ends_at', v_subscription.trial_ends_at
  );
end;
$$;

create or replace function public.claim_ad_campaign_payment_link(
  p_campaign_id uuid,
  p_advertiser_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.shop_ad_campaigns%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role is required'; end if;
  select * into v_campaign
  from public.shop_ad_campaigns
  where id = p_campaign_id and advertiser_id = p_advertiser_id
  for update;
  if not found then raise exception 'Campaign not found'; end if;
  if v_campaign.status <> 'pending_payment' then
    raise exception 'This advertising campaign is no longer awaiting payment';
  end if;
  if not exists (
    select 1 from public.shop_members sm
    where sm.shop_id = v_campaign.shop_id and sm.user_id = p_advertiser_id
  ) or not exists (
    select 1 from public.shops s
    where s.id = v_campaign.shop_id and s.is_active and public.shop_subscription_access(s.id)
  ) then
    raise exception 'Shop access is unavailable for this campaign';
  end if;
  if v_campaign.razorpay_payment_link_id is not null
    and v_campaign.payment_url is not null
    and v_campaign.payment_link_expires_at > now() then
    return jsonb_build_object('action', 'reuse', 'payment_url', v_campaign.payment_url);
  end if;
  if v_campaign.payment_link_lock_until > now() then
    raise exception 'A payment link is already being prepared; try again shortly';
  end if;

  update public.shop_ad_campaigns
  set payment_link_lock_until = now() + interval '3 minutes'
  where id = v_campaign.id;
  return jsonb_build_object(
    'action', 'create',
    'campaign_id', v_campaign.id,
    'amount_paise', v_campaign.amount_paise,
    'duration_days', v_campaign.duration_days,
    'shop_id', v_campaign.shop_id
  );
end;
$$;

revoke all on function public.claim_merchant_subscription_checkout(uuid, text) from public, anon, authenticated;
revoke all on function public.claim_ad_campaign_payment_link(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_merchant_subscription_checkout(uuid, text) to service_role;
grant execute on function public.claim_ad_campaign_payment_link(uuid, uuid) to service_role;

create or replace function public.join_product_pool(
  p_pool_id uuid,
  p_quantity numeric,
  p_fulfillment_type text,
  p_address_id uuid,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid := auth.uid();
  v_pool public.product_pools%rowtype;
  v_shop public.shops%rowtype;
  v_address public.addresses%rowtype;
  v_old_contribution public.pool_contributions%rowtype;
  v_participant record;
  v_total numeric(12,3);
  v_line_total integer;
  v_delivery_fee integer;
  v_order_id uuid;
  v_my_order_id uuid;
  v_inventory_id uuid;
begin
  if v_customer_id is null then raise exception 'Sign in is required'; end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity <> round(p_quantity, 3) then
    raise exception 'Enter a positive quantity up to 3 decimal places';
  end if;
  if p_fulfillment_type is null or p_fulfillment_type not in ('pickup', 'delivery') then
    raise exception 'Choose pickup or delivery';
  end if;
  if p_payment_method is null or p_payment_method not in ('cash', 'upi') then
    raise exception 'Choose cash or UPI';
  end if;

  select * into v_pool from public.product_pools where id = p_pool_id for update;
  if not found then raise exception 'Pool not found'; end if;
  if v_pool.status <> 'open' then raise exception 'This pool is no longer open'; end if;
  if v_pool.ends_at <= now() then
    update public.product_pools set status = 'expired' where id = p_pool_id;
    return null;
  end if;
  if p_quantity > v_pool.target_quantity then
    raise exception 'Your quantity cannot exceed the pool target';
  end if;

  select * into v_shop from public.shops
  where id = v_pool.shop_id and is_active;
  if not found or not public.shop_subscription_access(v_pool.shop_id) then
    raise exception 'This shop is not accepting orders';
  end if;
  if p_fulfillment_type = 'pickup' and not v_shop.pickup_enabled then
    raise exception 'Pickup is not available from this shop';
  end if;
  if p_fulfillment_type = 'delivery' and not v_shop.delivery_enabled then
    raise exception 'Delivery is not available from this shop';
  end if;
  if p_payment_method = 'upi' and nullif(trim(v_shop.upi_id), '') is null then
    raise exception 'This shop has not configured UPI payments';
  end if;
  if p_fulfillment_type = 'delivery' then
    select * into v_address from public.addresses
    where id = p_address_id and customer_id = v_customer_id;
    if not found then raise exception 'Choose a saved delivery address'; end if;
  elsif p_address_id is not null then
    raise exception 'A pickup reservation cannot include a delivery address';
  end if;

  select * into v_old_contribution from public.pool_contributions
  where pool_id = p_pool_id and customer_id = v_customer_id
  for update;
  if found and v_old_contribution.status = 'ordered' then
    raise exception 'Your pooled order has already been created';
  end if;

  insert into public.pool_contributions (
    pool_id, customer_id, quantity, fulfillment_type, address_id, payment_method, status, updated_at
  )
  values (
    p_pool_id, v_customer_id, p_quantity, p_fulfillment_type,
    p_address_id, p_payment_method, 'joined', now()
  )
  on conflict (pool_id, customer_id) do update
  set quantity = excluded.quantity,
      fulfillment_type = excluded.fulfillment_type,
      address_id = excluded.address_id,
      payment_method = excluded.payment_method,
      status = 'joined',
      order_id = null,
      updated_at = now();

  select coalesce(sum(pc.quantity), 0)::numeric(12,3) into v_total
  from public.pool_contributions pc
  where pc.pool_id = p_pool_id and pc.status = 'joined';
  if v_total > v_pool.target_quantity then
    raise exception 'The pool has fewer units available; refresh and try again';
  end if;
  update public.product_pools set joined_quantity = v_total where id = p_pool_id;

  if v_total = v_pool.target_quantity then
    select i.id into v_inventory_id
    from public.inventory i
    where i.shop_id = v_pool.shop_id and i.product_id = v_pool.product_id
      and i.is_available and i.available_quantity >= v_pool.target_quantity
    for update;
    if not found then
      raise exception 'The shop needs to replenish stock before this pool can complete';
    end if;

    for v_participant in
      select pc.*
      from public.pool_contributions pc
      where pc.pool_id = p_pool_id and pc.status = 'joined'
      order by pc.created_at, pc.id
      for update
    loop
      v_line_total := round(v_pool.pool_unit_price_paise * v_participant.quantity)::integer;
      v_delivery_fee := case when v_participant.fulfillment_type = 'delivery'
        then v_shop.delivery_fee_paise else 0 end;

      insert into public.orders (
        customer_id, shop_id, address_id, delivery_address_snapshot,
        fulfillment_type, subtotal_paise, delivery_fee_paise, total_paise,
        payment_method, payment_status, customer_note, upi_id_snapshot
      )
      values (
        v_participant.customer_id,
        v_pool.shop_id,
        v_participant.address_id,
        case when v_participant.fulfillment_type = 'delivery' then
          jsonb_build_object(
            'recipient_name', (select a.recipient_name from public.addresses a where a.id = v_participant.address_id),
            'phone', (select a.phone from public.addresses a where a.id = v_participant.address_id),
            'address_line', (select a.address_line from public.addresses a where a.id = v_participant.address_id),
            'locality', (select a.locality from public.addresses a where a.id = v_participant.address_id),
            'city', (select a.city from public.addresses a where a.id = v_participant.address_id),
            'state', (select a.state from public.addresses a where a.id = v_participant.address_id),
            'postal_code', (select a.postal_code from public.addresses a where a.id = v_participant.address_id)
          )
        else null end,
        v_participant.fulfillment_type,
        v_line_total,
        v_delivery_fee,
        v_line_total + v_delivery_fee,
        v_participant.payment_method,
        'pending',
        'Product pool order',
        v_shop.upi_id
      )
      returning id into v_order_id;

      insert into public.order_items (
        order_id, product_id, product_name_snapshot, unit_label_snapshot,
        unit_price_paise, quantity, line_total_paise
      )
      values (
        v_order_id, v_pool.product_id, v_pool.product_name_snapshot,
        v_pool.unit_label_snapshot, v_pool.pool_unit_price_paise,
        v_participant.quantity, v_line_total
      );
      insert into public.order_status_history (order_id, changed_by, new_status, note)
      values (v_order_id, v_participant.customer_id, 'placed', 'Product pool target reached');
      update public.pool_contributions
      set status = 'ordered', order_id = v_order_id, updated_at = now()
      where id = v_participant.id;
      insert into public.notifications (user_id, notification_type, title, body, data)
      values (
        v_participant.customer_id, 'pool_order_ready', 'Your pooled order is ready',
        'The pool target was reached. Your order is now in Orders; payment is due using your selected method.',
        jsonb_build_object('order_id', v_order_id, 'pool_id', p_pool_id)
      );
      if v_participant.customer_id = v_customer_id then v_my_order_id := v_order_id; end if;
    end loop;

    perform set_config('kiranalink.stock_change_reason', 'order_reservation', true);
    update public.inventory
    set available_quantity = available_quantity - v_pool.target_quantity,
        updated_at = now()
    where id = v_inventory_id;
    update public.product_pools set status = 'fulfilled' where id = p_pool_id;
  end if;

  return v_my_order_id;
end;
$$;

revoke all on function public.join_product_pool(uuid, numeric, text, uuid, text) from public;
grant execute on function public.join_product_pool(uuid, numeric, text, uuid, text) to authenticated;

create or replace function public.claim_razorpay_webhook_event(
  p_event_id text,
  p_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role is required'; end if;
  insert into public.razorpay_webhook_events (event_id, event_type, processing_at)
  values (p_event_id, p_event_type, now())
  on conflict (event_id) do update
  set event_type = excluded.event_type,
      processing_at = now(),
      attempts = public.razorpay_webhook_events.attempts + 1,
      last_error = null
  where public.razorpay_webhook_events.processed_at is null
    and (public.razorpay_webhook_events.processing_at is null
      or public.razorpay_webhook_events.processing_at < now() - interval '5 minutes')
  returning event_id into v_claimed;
  return v_claimed is not null;
end;
$$;

create or replace function public.complete_razorpay_webhook_event(
  p_event_id text,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role is required'; end if;
  update public.razorpay_webhook_events
  set processed_at = case when p_error is null then now() else null end,
      processing_at = null,
      last_error = left(p_error, 1000)
  where event_id = p_event_id;
end;
$$;

revoke all on function public.claim_razorpay_webhook_event(text, text) from public, anon, authenticated;
revoke all on function public.complete_razorpay_webhook_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_razorpay_webhook_event(text, text) to service_role;
grant execute on function public.complete_razorpay_webhook_event(text, text) to service_role;
