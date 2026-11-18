-- Authenticated device tokens and order-event notifications.
-- Apply after 0003_product_media.sql.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  push_claimed_at timestamptz,
  push_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists push_tokens_user_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
alter table public.notifications enable row level security;

revoke all on public.push_tokens, public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;

drop policy if exists notifications_read_self on public.notifications;
create policy notifications_read_self on public.notifications
for select to authenticated using (user_id = auth.uid());

create or replace function public.register_push_token(
  p_token text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_platform not in ('ios', 'android')
    or p_token !~ '^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9._=-]+\]$'
    or length(p_token) > 250 then
    raise exception 'Push token or platform is invalid';
  end if;

  insert into public.push_tokens (user_id, token, platform, updated_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (token) do update
  set user_id = excluded.user_id,
      platform = excluded.platform,
      updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public;
grant execute on function public.register_push_token(text, text) to authenticated;

create or replace function public.claim_push_notification(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role is required'; end if;
  update public.notifications
  set push_claimed_at = now()
  where id = p_notification_id
    and push_sent_at is null
    and (push_claimed_at is null or push_claimed_at < now() - interval '5 minutes');
  return found;
end;
$$;

revoke all on function public.claim_push_notification(uuid) from public, anon, authenticated;
grant execute on function public.claim_push_notification(uuid) to service_role;

create or replace function public.enqueue_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  if tg_op = 'INSERT' then
    for v_recipient in
      select sm.user_id from public.shop_members sm
      where sm.shop_id = new.shop_id and sm.user_id <> new.customer_id
    loop
      insert into public.notifications (user_id, notification_type, title, body, data)
      values (
        v_recipient, 'new_order', 'New customer order',
        'Order #' || new.order_number || ' is waiting for your shop.',
        jsonb_build_object('order_id', new.id, 'shop_id', new.shop_id)
      );
    end loop;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.notifications (user_id, notification_type, title, body, data)
    values (
      new.customer_id, 'order_status', 'Order update',
      'Your order #' || new.order_number || ' is now ' || replace(new.status::text, '_', ' ') || '.',
      jsonb_build_object('order_id', new.id, 'status', new.status)
    );
  end if;

  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'submitted' then
      for v_recipient in
        select sm.user_id from public.shop_members sm
        where sm.shop_id = new.shop_id and sm.user_id <> new.customer_id
      loop
        insert into public.notifications (user_id, notification_type, title, body, data)
        values (
          v_recipient, 'payment_review', 'Payment needs review',
          'UPI payment for order #' || new.order_number || ' was submitted.',
          jsonb_build_object('order_id', new.id, 'shop_id', new.shop_id)
        );
      end loop;
    else
      insert into public.notifications (user_id, notification_type, title, body, data)
      values (
        new.customer_id, 'payment_status', 'Payment update',
        'Payment for order #' || new.order_number || ' is ' || new.payment_status || '.',
        jsonb_build_object('order_id', new.id, 'payment_status', new.payment_status)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_enqueue_notifications on public.orders;
create trigger orders_enqueue_notifications
  after insert or update of status, payment_status on public.orders
  for each row execute function public.enqueue_order_notification();
