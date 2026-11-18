-- Re-establish the owner-only shop creation policy for projects with drifted RLS.
alter table public.shops enable row level security;
grant insert on public.shops to authenticated;

drop policy if exists shop_owner_insert on public.shops;
create policy shop_owner_insert on public.shops
for insert to authenticated
with check (owner_id = (select auth.uid()));
