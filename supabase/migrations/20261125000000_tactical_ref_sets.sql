-- Fiche tactique : plusieurs listes nommées (une par serveur / campagne :
-- « Manex DJS Germany », « Inter-escadrilles Nov 26 »…), dont une active.
-- Les listes existantes (une par pilote) deviennent une première liste nommée.

create table public.tactical_ref_sets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  airbases   jsonb not null default '[]'::jsonb
             check (jsonb_typeof(airbases) = 'array' and pg_column_size(airbases) <= 262144),
  stations   jsonb not null default '[]'::jsonb
             check (jsonb_typeof(stations) = 'array' and pg_column_size(stations) <= 262144),
  support    jsonb not null default '[]'::jsonb
             check (jsonb_typeof(support) = 'array' and pg_column_size(support) <= 262144),
  active     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tactical_ref_sets_user_idx on public.tactical_ref_sets (user_id);
-- Une seule liste active par pilote.
create unique index tactical_ref_sets_one_active on public.tactical_ref_sets (user_id) where active;

alter table public.tactical_ref_sets enable row level security;
revoke all on public.tactical_ref_sets from anon, authenticated;
grant select, delete on public.tactical_ref_sets to authenticated;
grant insert (name, airbases, stations, support, active) on public.tactical_ref_sets to authenticated;
grant update (name, airbases, stations, support, active, updated_at) on public.tactical_ref_sets to authenticated;

create policy "tactical_ref_sets_select_own" on public.tactical_ref_sets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tactical_ref_sets_insert_own" on public.tactical_ref_sets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "tactical_ref_sets_update_own" on public.tactical_ref_sets
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "tactical_ref_sets_delete_own" on public.tactical_ref_sets
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Reprise des listes existantes (la colonne support peut manquer : lue via to_jsonb).
insert into public.tactical_ref_sets (user_id, name, airbases, stations, support, active)
select r.user_id, 'Mes listes', r.airbases, r.stations, coalesce(to_jsonb(r) -> 'support', '[]'::jsonb), true
from public.tactical_refs r;
