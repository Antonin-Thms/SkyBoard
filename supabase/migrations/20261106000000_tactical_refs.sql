-- Listes de la fiche tactique : terrains (TACAN, fréquences, piste, ILS…) et
-- stations radio (canal, nom, fréquence), choisies dans la fiche puis
-- recopiées dedans. Une ligne par pilote.

create table public.tactical_refs (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  airbases   jsonb not null default '[]'::jsonb
             check (jsonb_typeof(airbases) = 'array' and pg_column_size(airbases) <= 262144),
  stations   jsonb not null default '[]'::jsonb
             check (jsonb_typeof(stations) = 'array' and pg_column_size(stations) <= 262144),
  updated_at timestamptz not null default now()
);

alter table public.tactical_refs enable row level security;
revoke all on public.tactical_refs from anon, authenticated;
grant select on public.tactical_refs to authenticated;
grant insert (airbases, stations, updated_at) on public.tactical_refs to authenticated;
grant update (airbases, stations, updated_at) on public.tactical_refs to authenticated;

create policy "tactical_refs_select_own" on public.tactical_refs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tactical_refs_insert_own" on public.tactical_refs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tactical_refs_update_own" on public.tactical_refs
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
