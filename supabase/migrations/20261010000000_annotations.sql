-- Annotations : traits dessinés au doigt, par page de document.
-- Écriture uniquement via des fonctions qui vérifient la propriété du
-- document et bornent la taille (les traits arrivent de la remote).

create table public.annotations (
  document_id uuid not null references public.documents (id) on delete cascade,
  page        integer not null check (page between 1 and 2000),
  user_id     uuid not null references auth.users (id) on delete cascade,
  strokes     jsonb not null default '[]'::jsonb check (jsonb_typeof(strokes) = 'array'),
  updated_at  timestamptz not null default now(),
  primary key (document_id, page)
);

create index annotations_user_idx on public.annotations (user_id);

alter table public.annotations enable row level security;
revoke all on public.annotations from anon, authenticated;
grant select on public.annotations to authenticated;

create policy "annotations_select_own" on public.annotations
  for select to authenticated using ((select auth.uid()) = user_id);

-- Ajoute un trait (ou le remplace s'il existe déjà : message rejoué).
create or replace function public.annotation_add(document_id uuid, page integer, stroke jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if jsonb_typeof(stroke) <> 'object'
     or jsonb_typeof(stroke->'id') <> 'string'
     or jsonb_typeof(stroke->'points') <> 'array'
     or pg_column_size(stroke) > 65536 then
    raise exception 'trait invalide' using errcode = '22023';
  end if;

  select d.user_id into owner from public.documents d where d.id = annotation_add.document_id;
  if owner is null or owner <> auth.uid() then
    raise exception 'document introuvable' using errcode = 'P0002';
  end if;

  insert into public.annotations as a (document_id, page, user_id, strokes)
  values (annotation_add.document_id, annotation_add.page, owner, jsonb_build_array(stroke))
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

-- Supprime des traits d'une page.
create or replace function public.annotation_remove(document_id uuid, page integer, ids text[])
returns void
language sql
security definer
set search_path = ''
as $$
  update public.annotations a
     set strokes = (
           select coalesce(jsonb_agg(s), '[]'::jsonb)
             from jsonb_array_elements(a.strokes) s
            where not (s->>'id' = any (annotation_remove.ids))
         ),
         updated_at = now()
   where a.document_id = annotation_remove.document_id
     and a.page = annotation_remove.page
     and a.user_id = auth.uid();
$$;

-- Efface les annotations d'une page, ou de documents entiers (page null).
create or replace function public.annotation_clear(document_ids uuid[], page integer default null)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.annotations a
   where a.document_id = any (annotation_clear.document_ids)
     and (annotation_clear.page is null or a.page = annotation_clear.page)
     and a.user_id = auth.uid();
$$;

revoke all on function public.annotation_add(uuid, integer, jsonb) from public, anon;
revoke all on function public.annotation_remove(uuid, integer, text[]) from public, anon;
revoke all on function public.annotation_clear(uuid[], integer) from public, anon;
grant execute on function public.annotation_add(uuid, integer, jsonb) to authenticated;
grant execute on function public.annotation_remove(uuid, integer, text[]) to authenticated;
grant execute on function public.annotation_clear(uuid[], integer) to authenticated;
