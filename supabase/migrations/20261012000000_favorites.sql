-- Favoris : kneeboards parcourus en mode vol par swipe vertical.
-- Propres à chaque pilote ; possibles aussi sur un document partagé par
-- l'escadron (la policy d'insertion exige que le document soit lisible).

create table public.document_favorites (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, document_id)
);

create index document_favorites_document_idx on public.document_favorites (document_id);

alter table public.document_favorites enable row level security;
revoke all on public.document_favorites from anon, authenticated;
grant select, insert, delete on public.document_favorites to authenticated;

create policy "favorites_select_own" on public.document_favorites
  for select to authenticated using ((select auth.uid()) = user_id);

-- La sous-requête sur documents passe par sa RLS : seuls les documents
-- lisibles (les miens et ceux partagés avec mes escadrons) sont acceptés.
create policy "favorites_insert_own" on public.document_favorites
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.documents d where d.id = document_id)
  );

create policy "favorites_delete_own" on public.document_favorites
  for delete to authenticated using ((select auth.uid()) = user_id);
