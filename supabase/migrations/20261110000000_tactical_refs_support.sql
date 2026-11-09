-- Fiche tactique : liste « support » (ravitailleurs, AWACS, GCI…) à côté
-- des terrains et des stations radio.

alter table public.tactical_refs
  add column support jsonb not null default '[]'::jsonb
  check (jsonb_typeof(support) = 'array' and pg_column_size(support) <= 262144);

grant insert (support) on public.tactical_refs to authenticated;
grant update (support) on public.tactical_refs to authenticated;
