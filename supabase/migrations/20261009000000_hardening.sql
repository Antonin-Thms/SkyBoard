-- Durcissement : état persisté protégé, quotas par utilisateur.

-- ---------------------------------------------------------------------------
-- Régénérer l'URL du viewer repart d'un état vierge : un état injecté via
-- l'ancien canal ne survit pas à la révocation.
-- ---------------------------------------------------------------------------
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
     set viewer_token = new_token,
         last_state = null
   where id = cockpit_id
     and user_id = auth.uid();
  if not found then
    raise exception 'cockpit introuvable' using errcode = 'P0002';
  end if;
  return new_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dernier état : écrit uniquement via save_last_state, qui borne sa taille
-- et n'écrase jamais un état plus récent (plusieurs remotes, écritures dans
-- le désordre). Un seq très en avance sur l'horloge (état forgé) est ignoré.
-- ---------------------------------------------------------------------------
revoke update (last_state) on public.cockpits from authenticated;

create or replace function public.save_last_state(cockpit_id uuid, state jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ms numeric := extract(epoch from clock_timestamp()) * 1000;
  max_ahead_ms constant numeric := 120000;
  new_seq numeric;
begin
  if jsonb_typeof(state) <> 'object' or pg_column_size(state) > 2048 then
    raise exception 'état invalide' using errcode = '22023';
  end if;
  if jsonb_typeof(state->'seq') <> 'number' then
    raise exception 'état invalide' using errcode = '22023';
  end if;
  new_seq := (state->>'seq')::numeric;
  if new_seq < 0 or new_seq > now_ms + max_ahead_ms then
    raise exception 'état invalide' using errcode = '22023';
  end if;

  update public.cockpits c
     set last_state = state
   where c.id = cockpit_id
     and c.user_id = auth.uid()
     and (
       c.last_state is null
       or jsonb_typeof(c.last_state->'seq') <> 'number'
       or (c.last_state->>'seq')::numeric < new_seq
       or (c.last_state->>'seq')::numeric > now_ms + max_ahead_ms
     );
end;
$$;

revoke all on function public.save_last_state(uuid, jsonb) from public, anon;
grant execute on function public.save_last_state(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Quotas par utilisateur, vérifiés en base (pas contournables par des
-- requêtes parallèles ou un appel direct à l'API).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_user_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_rows integer := tg_argv[0]::integer;
  current_rows integer;
begin
  -- Sérialise les insertions d'un même utilisateur sur cette table.
  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || new.user_id::text));
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name)
     into current_rows
    using new.user_id;
  if current_rows >= max_rows then
    raise exception 'quota atteint (% max)', max_rows using errcode = '53400';
  end if;
  return new;
end;
$$;

create trigger documents_quota before insert on public.documents
  for each row execute function public.enforce_user_quota('500');
create trigger cockpits_quota before insert on public.cockpits
  for each row execute function public.enforce_user_quota('20');
create trigger folders_quota before insert on public.folders
  for each row execute function public.enforce_user_quota('50');

-- Volume de fichiers par utilisateur (bucket kneeboards) : 1 Go.
create or replace function public.kneeboards_bytes_used(uid uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0)
    from storage.objects o
   where o.bucket_id = 'kneeboards'
     and (storage.foldername(o.name))[1] = uid::text;
$$;

revoke all on function public.kneeboards_bytes_used(uuid) from public, anon;
grant execute on function public.kneeboards_bytes_used(uuid) to authenticated;

drop policy if exists "kneeboards_insert_own" on storage.objects;
create policy "kneeboards_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kneeboards'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.kneeboards_bytes_used((select auth.uid())) < 1073741824
  );

-- ---------------------------------------------------------------------------
-- Jumelage par QR code : le QR ne contient qu'un code aléatoire à usage
-- unique, valable 2 minutes. Le jeton de connexion n'est créé côté serveur
-- qu'au moment du scan. Accessible uniquement par le serveur (service_role).
-- ---------------------------------------------------------------------------
create table public.remote_pairings (
  code_hash  text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  cockpit_id uuid not null references public.cockpits (id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz
);

create index remote_pairings_expires_idx on public.remote_pairings (expires_at);

alter table public.remote_pairings enable row level security;
revoke all on public.remote_pairings from anon, authenticated;
