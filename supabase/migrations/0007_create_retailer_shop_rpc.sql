create or replace function public.create_retailer_shop(
  p_name text,
  p_description text,
  p_phone text,
  p_address_line text,
  p_locality text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_pickup_enabled boolean,
  p_delivery_enabled boolean,
  p_delivery_fee_paise integer,
  p_minimum_order_paise integer,
  p_opening_time time,
  p_closing_time time,
  p_support_phone text,
  p_upi_id text
)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_shop public.shops%rowtype;
  owner_user_id uuid := auth.uid();
begin
  if owner_user_id is null then
    raise exception 'Sign in is required to create a shop'
      using errcode = '28000';
  end if;

  insert into public.shops (
    owner_id,
    name,
    description,
    phone,
    address_line,
    locality,
    city,
    state,
    postal_code,
    pickup_enabled,
    delivery_enabled,
    delivery_fee_paise,
    minimum_order_paise,
    opening_time,
    closing_time,
    support_phone,
    upi_id,
    is_active
  )
  values (
    owner_user_id,
    p_name,
    p_description,
    p_phone,
    p_address_line,
    p_locality,
    p_city,
    p_state,
    p_postal_code,
    p_pickup_enabled,
    p_delivery_enabled,
    p_delivery_fee_paise,
    p_minimum_order_paise,
    p_opening_time,
    p_closing_time,
    p_support_phone,
    p_upi_id,
    false
  )
  returning * into created_shop;

  return created_shop;
end;
$$;

revoke all on function public.create_retailer_shop(
  text, text, text, text, text, text, text, text,
  boolean, boolean, integer, integer, time, time, text, text
) from public, anon, authenticated;
grant execute on function public.create_retailer_shop(
  text, text, text, text, text, text, text, text,
  boolean, boolean, integer, integer, time, time, text, text
) to authenticated;
