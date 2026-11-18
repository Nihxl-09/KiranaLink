-- Product media storage. Apply after 0002_operational_flows.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists product_images_shop_upload on storage.objects;
create policy product_images_shop_upload on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.shops s
    where s.id::text = (storage.foldername(name))[1]
      and public.is_shop_member(s.id)
  )
);

drop policy if exists product_images_shop_update on storage.objects;
create policy product_images_shop_update on storage.objects
for update to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.shops s
    where s.id::text = (storage.foldername(name))[1]
      and public.is_shop_member(s.id)
  )
)
with check (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.shops s
    where s.id::text = (storage.foldername(name))[1]
      and public.is_shop_member(s.id)
  )
);

drop policy if exists product_images_shop_delete on storage.objects;
create policy product_images_shop_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.shops s
    where s.id::text = (storage.foldername(name))[1]
      and public.is_shop_member(s.id)
  )
);

create or replace function public.set_product_image(
  p_product_id uuid,
  p_image_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_image_path is null or length(trim(p_image_path)) > 512 then
    raise exception 'Choose a valid product image';
  end if;

  select i.shop_id into v_shop_id
  from public.products p
  join public.inventory i on i.product_id = p.id
  where p.id = p_product_id
    and p.created_by = auth.uid()
    and public.is_shop_member(i.shop_id)
  limit 1;

  if not found then raise exception 'Product image access denied'; end if;
  if split_part(p_image_path, '/', 1) <> v_shop_id::text then
    raise exception 'Product image must belong to this shop';
  end if;

  update public.products
  set image_path = p_image_path
  where id = p_product_id and created_by = auth.uid();
end;
$$;

revoke all on function public.set_product_image(uuid, text) from public;
grant execute on function public.set_product_image(uuid, text) to authenticated;
