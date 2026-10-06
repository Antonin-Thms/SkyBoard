-- Escadrilles : partage de dossiers en lecture entre pilotes.
--
-- Un utilisateur crée une escadrille et diffuse son lien d'invitation. Le
-- propriétaire d'un dossier peut le partager avec une escadrille dont il est
-- membre : les membres voient ce dossier et ses documents (lecture seule) et
-- peuvent le choisir comme dossier actif de leurs cockpits. Chacun garde ses
-- propres annotations.

create table public.squadrons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique,
  created_at  timestamptz not null default now()
);

create table public.squadron_members (
  squadron_id uuid not null references public.squadrons (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  callsign    text not null check (char_length(callsign) between 1 and 40),
  joined_at   timestamptz not null default now(),
  primary key (squadron_id, user_id)
);

create index squadron_members_user_idx on public.squadron_members (user_id);

alter table public.folders add column squadron_id uuid references public.squadrons (id) on delete set null;
create index folders_squadron_idx on public.folders (squadron_id);

-- ---------------------------------------------------------------------------
-- Droits d'accès
-- ---------------------------------------------------------------------------
create or replace function public.is_squadron_member(squadron uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.squadron_members m
     where m.squadron_id = squadron and m.user_id = auth.uid()
  );
$$;

-- Dossier lisible : le sien, ou partagé avec une escadrille dont on est membre.
create or replace function public.can_read_folder(folder uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.folders f
     where f.id = folder
       and (f.user_id = auth.uid()
            or (f.squadron_id is not null and public.is_squadron_member(f.squadron_id)))
  );
$$;

revoke all on function public.is_squadron_member(uuid) from public, anon;
revoke all on function public.can_read_folder(uuid) from public, anon;
grant execute on function public.is_squadron_member(uuid) to authenticated;
grant execute on function public.can_read_folder(uuid) to authenticated;

alter table public.squadrons enable row level security;
alter table public.squadron_members enable row level security;
revoke all on public.squadrons, public.squadron_members from anon, authenticated;
grant select on public.squadrons, public.squadron_members to authenticated;

create policy "squadrons_select_member" on public.squadrons
  for select to authenticated using (public.is_squadron_member(id));
create policy "squadron_members_select_member" on public.squadron_members
  for select to authenticated using (public.is_squadron_member(squadron_id));

-- Dossiers et documents partagés : visibles (lecture) par les membres.
drop policy "folders_select_own" on public.folders;
create policy "folders_select_own_or_shared" on public.folders
  for select to authenticated
  using ((select auth.uid()) = user_id or (squadron_id is not null and public.is_squadron_member(squadron_id)));

drop policy "documents_select_own" on public.documents;
create policy "documents_select_own_or_shared" on public.documents
  for select to authenticated
  using ((select auth.uid()) = user_id or (folder_id is not null and public.can_read_folder(folder_id)));

drop policy "kneeboards_select_own" on storage.objects;
create policy "kneeboards_select_own_or_shared" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kneeboards'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.documents d
         -- « objects.name » : la colonne name de documents masquerait celle de l'objet.
         where (d.storage_path = objects.name or d.thumbnail_path = objects.name)
           and d.folder_id is not null
           and public.can_read_folder(d.folder_id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- Dossier actif d'un cockpit : peut être un dossier partagé (d'un autre
-- utilisateur). La clé composite est remplacée par une clé simple et un
-- contrôle d'accès à l'écriture.
-- ---------------------------------------------------------------------------
alter table public.cockpits drop constraint cockpits_active_folder_fk;
alter table public.cockpits
  add constraint cockpits_active_folder_fk foreign key (active_folder_id)
  references public.folders (id) on delete set null;

create or replace function public.cockpits_check_active_folder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active_folder_id is not null
     and new.active_folder_id is distinct from old.active_folder_id
     and not public.can_read_folder(new.active_folder_id) then
    raise exception 'dossier inaccessible' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger cockpits_check_active_folder
  before update of active_folder_id on public.cockpits
  for each row execute function public.cockpits_check_active_folder();

-- Plus d'accès à un dossier partagé : les cockpits qui l'affichaient reviennent à « tous ».
create or replace function public.reset_inaccessible_active_folders(squadron uuid, member uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.cockpits c
     set active_folder_id = null
    from public.folders f
   where c.active_folder_id = f.id
     and f.user_id <> c.user_id
     and (member is null or c.user_id = member)
     and (f.squadron_id is null or f.squadron_id = squadron)
     and not exists (
       select 1 from public.squadron_members m
        where m.squadron_id = f.squadron_id and m.user_id = c.user_id
     );
$$;
revoke all on function public.reset_inaccessible_active_folders(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Annotations : chacun annote pour soi, y compris les documents partagés.
-- ---------------------------------------------------------------------------
alter table public.annotations drop constraint annotations_pkey;
alter table public.annotations add constraint annotations_pkey primary key (document_id, page, user_id);

create or replace function public.annotation_add(document_id uuid, page integer, stroke jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if jsonb_typeof(stroke) <> 'object'
     or jsonb_typeof(stroke->'id') <> 'string'
     or jsonb_typeof(stroke->'points') <> 'array'
     or pg_column_size(stroke) > 65536 then
    raise exception 'trait invalide' using errcode = '22023';
  end if;

  if me is null or not exists (
    select 1 from public.documents d
     where d.id = annotation_add.document_id
       and (d.user_id = me or (d.folder_id is not null and public.can_read_folder(d.folder_id)))
  ) then
    raise exception 'document introuvable' using errcode = 'P0002';
  end if;

  insert into public.annotations as a (document_id, page, user_id, strokes)
  values (annotation_add.document_id, annotation_add.page, me, jsonb_build_array(stroke))
  on conflict on constraint annotations_pkey do update
     set strokes = (
           select coalesce(jsonb_agg(s), '[]'::jsonb)
             from jsonb_array_elements(a.strokes) s
            where s->>'id' <> stroke->>'id'
         ) || jsonb_build_array(stroke),
         updated_at = now()
   where jsonb_array_length(a.strokes) < 1000;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestion des escadrilles (fonctions : règles vérifiées en base)
-- ---------------------------------------------------------------------------
create or replace function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/', '-_');
$$;
revoke all on function public.new_invite_code() from public, anon, authenticated;

create or replace function public.create_squadron(name text, callsign text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  sid uuid;
begin
  if me is null then raise exception 'non connecté' using errcode = '42501'; end if;
  if (select count(*) from public.squadron_members m where m.user_id = me) >= 20 then
    raise exception 'quota atteint (20 max)' using errcode = '53400';
  end if;
  insert into public.squadrons (name, owner_id, invite_code)
  values (trim(create_squadron.name), me, public.new_invite_code())
  returning id into sid;
  insert into public.squadron_members (squadron_id, user_id, callsign)
  values (sid, me, trim(create_squadron.callsign));
  return sid;
end;
$$;

create or replace function public.join_squadron(code text, callsign text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  sid uuid;
begin
  if me is null then raise exception 'non connecté' using errcode = '42501'; end if;
  select s.id into sid from public.squadrons s where s.invite_code = join_squadron.code;
  if sid is null then raise exception 'invitation invalide' using errcode = 'P0002'; end if;
  if (select count(*) from public.squadron_members m where m.squadron_id = sid) >= 100 then
    raise exception 'escadrille complète (100 max)' using errcode = '53400';
  end if;
  insert into public.squadron_members (squadron_id, user_id, callsign)
  values (sid, me, trim(join_squadron.callsign))
  on conflict (squadron_id, user_id) do update set callsign = excluded.callsign;
  return sid;
end;
$$;

-- Quitter (ou retirer un membre, pour le propriétaire). Le propriétaire ne
-- quitte pas : il supprime l'escadrille. Les dossiers du membre partagés
-- avec l'escadrille cessent de l'être.
create or replace function public.leave_squadron(squadron uuid, member uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid := coalesce(member, me);
  owner uuid;
begin
  select s.owner_id into owner from public.squadrons s where s.id = squadron;
  if owner is null or not public.is_squadron_member(squadron) then
    raise exception 'escadrille introuvable' using errcode = 'P0002';
  end if;
  if target <> me and owner <> me then
    raise exception 'réservé au propriétaire' using errcode = '42501';
  end if;
  if target = owner then
    raise exception 'le propriétaire supprime l''escadrille' using errcode = '42501';
  end if;
  delete from public.squadron_members m where m.squadron_id = squadron and m.user_id = target;
  update public.folders f set squadron_id = null where f.squadron_id = squadron and f.user_id = target;
  perform public.reset_inaccessible_active_folders(squadron, null);
end;
$$;

create or replace function public.delete_squadron(squadron uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.squadrons s where s.id = squadron and s.owner_id = auth.uid()) then
    raise exception 'réservé au propriétaire' using errcode = '42501';
  end if;
  update public.folders f set squadron_id = null where f.squadron_id = squadron;
  perform public.reset_inaccessible_active_folders(squadron, null);
  delete from public.squadrons s where s.id = squadron;
end;
$$;

create or replace function public.regenerate_squadron_invite(squadron uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text := public.new_invite_code();
begin
  update public.squadrons s set invite_code = code where s.id = squadron and s.owner_id = auth.uid();
  if not found then raise exception 'réservé au propriétaire' using errcode = '42501'; end if;
  return code;
end;
$$;

-- Partager un de ses dossiers avec une escadrille dont on est membre (null : ne plus partager).
create or replace function public.share_folder(folder uuid, squadron uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous uuid;
begin
  select f.squadron_id into previous from public.folders f where f.id = folder and f.user_id = auth.uid();
  if not found then raise exception 'dossier introuvable' using errcode = 'P0002'; end if;
  if squadron is not null and not public.is_squadron_member(squadron) then
    raise exception 'escadrille introuvable' using errcode = 'P0002';
  end if;
  update public.folders f set squadron_id = squadron where f.id = folder;
  if previous is not null then
    perform public.reset_inaccessible_active_folders(previous, null);
  end if;
end;
$$;

revoke all on function public.create_squadron(text, text) from public, anon;
revoke all on function public.join_squadron(text, text) from public, anon;
revoke all on function public.leave_squadron(uuid, uuid) from public, anon;
revoke all on function public.delete_squadron(uuid) from public, anon;
revoke all on function public.regenerate_squadron_invite(uuid) from public, anon;
revoke all on function public.share_folder(uuid, uuid) from public, anon;
grant execute on function public.create_squadron(text, text) to authenticated;
grant execute on function public.join_squadron(text, text) to authenticated;
grant execute on function public.leave_squadron(uuid, uuid) to authenticated;
grant execute on function public.delete_squadron(uuid) to authenticated;
grant execute on function public.regenerate_squadron_invite(uuid) to authenticated;
grant execute on function public.share_folder(uuid, uuid) to authenticated;
