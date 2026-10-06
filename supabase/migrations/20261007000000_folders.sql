-- Dossiers de documents (ex. un dossier par serveur) et dossier actif par cockpit.

create table public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  -- Clé composite : permet aux autres tables de garantir le même propriétaire.
  unique (id, user_id)
);

create index folders_user_sort_idx on public.folders (user_id, sort_order, created_at);

alter table public.folders enable row level security;

revoke all on public.folders from anon, authenticated;
grant select, delete on public.folders to authenticated;
grant insert (name, sort_order) on public.folders to authenticated;
grant update (name, sort_order) on public.folders to authenticated;

create policy "folders_select_own" on public.folders
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "folders_insert_own" on public.folders
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "folders_update_own" on public.folders
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "folders_delete_own" on public.folders
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Document → dossier (null = « Communs », affiché quel que soit le dossier actif).
-- La clé étrangère composite (folder_id, user_id) garantit que le dossier
-- appartient au propriétaire du document. Suppression du dossier : les
-- documents redeviennent communs.
alter table public.documents add column folder_id uuid;
alter table public.documents
  add constraint documents_folder_fk foreign key (folder_id, user_id)
  references public.folders (id, user_id) on delete set null (folder_id);
create index documents_folder_idx on public.documents (folder_id);

grant insert (folder_id) on public.documents to authenticated;
grant update (folder_id) on public.documents to authenticated;

-- Dossier actif d'un cockpit (null = tous les documents).
alter table public.cockpits add column active_folder_id uuid;
alter table public.cockpits
  add constraint cockpits_active_folder_fk foreign key (active_folder_id, user_id)
  references public.folders (id, user_id) on delete set null (active_folder_id);

grant update (active_folder_id) on public.cockpits to authenticated;
