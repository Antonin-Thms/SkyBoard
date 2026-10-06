-- SkyBoard — schéma initial
-- Tables cockpits / documents, RLS, bucket Storage privé "kneeboards".

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Génération de token viewer : 32 octets aléatoires encodés en base64url (43 car.)
-- ---------------------------------------------------------------------------
create or replace function public.generate_viewer_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
$$;

revoke all on function public.generate_viewer_token() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.cockpits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 100),
  viewer_token text not null unique,
  last_state   jsonb,
  created_at   timestamptz not null default now()
);

create index cockpits_user_id_idx on public.cockpits (user_id, created_at);

create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 200),
  type           text not null check (type in ('application/pdf', 'image/png', 'image/jpeg')),
  storage_path   text not null unique,
  thumbnail_path text,
  page_count     integer not null default 1 check (page_count between 1 and 2000),
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  -- Les fichiers doivent être dans le dossier de leur propriétaire : empêche
  -- un utilisateur de référencer le fichier d'un autre (que la route viewer,
  -- en service_role, signerait sinon).
  constraint documents_storage_path_owner check (split_part(storage_path, '/', 1) = user_id::text),
  constraint documents_thumbnail_path_owner check (
    thumbnail_path is null or split_part(thumbnail_path, '/', 1) = user_id::text
  )
);

create index documents_user_sort_idx on public.documents (user_id, sort_order, created_at);

-- ---------------------------------------------------------------------------
-- Token viewer : toujours généré par la base, jamais choisi par le client.
-- ---------------------------------------------------------------------------
create or replace function public.cockpits_set_viewer_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.viewer_token := public.generate_viewer_token();
  return new;
end;
$$;

create trigger cockpits_set_viewer_token
  before insert on public.cockpits
  for each row execute function public.cockpits_set_viewer_token();

-- Régénère le token (révoque l'ancienne URL viewer). Vérifie le propriétaire.
create or replace function public.regenerate_viewer_token(cockpit_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_token text := public.generate_viewer_token();
begin
  update public.cockpits
     set viewer_token = new_token
   where id = cockpit_id
     and user_id = auth.uid();
  if not found then
    raise exception 'cockpit introuvable' using errcode = 'P0002';
  end if;
  return new_token;
end;
$$;

revoke all on function public.regenerate_viewer_token(uuid) from public, anon;
grant execute on function public.regenerate_viewer_token(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privilèges : les clients ne peuvent écrire que certaines colonnes.
-- ---------------------------------------------------------------------------
revoke all on public.cockpits, public.documents from anon, authenticated;

grant select, delete on public.cockpits to authenticated;
grant insert (name) on public.cockpits to authenticated;
grant update (name, last_state) on public.cockpits to authenticated;

grant select, delete on public.documents to authenticated;
grant insert (name, type, storage_path, thumbnail_path, page_count, sort_order) on public.documents to authenticated;
grant update (name, thumbnail_path, sort_order) on public.documents to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.cockpits enable row level security;
alter table public.documents enable row level security;

create policy "cockpits_select_own" on public.cockpits
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "cockpits_insert_own" on public.cockpits
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cockpits_update_own" on public.cockpits
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "cockpits_delete_own" on public.cockpits
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "documents_select_own" on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "documents_insert_own" on public.documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "documents_update_own" on public.documents
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "documents_delete_own" on public.documents
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage : bucket privé, 50 Mo max, types limités. Chemins "<user_id>/...".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kneeboards',
  'kneeboards',
  false,
  52428800,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "kneeboards_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'kneeboards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "kneeboards_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kneeboards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "kneeboards_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'kneeboards' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'kneeboards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "kneeboards_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'kneeboards' and (storage.foldername(name))[1] = (select auth.uid())::text);
