-- Réordonnancement des documents en un seul appel.
-- security invoker : la RLS et les privilèges de colonne s'appliquent.
create or replace function public.reorder_documents(ids uuid[])
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.documents d
     set sort_order = o.ord
    from unnest(ids) with ordinality as o(id, ord)
   where d.id = o.id
     and d.user_id = (select auth.uid());
$$;

revoke all on function public.reorder_documents(uuid[]) from public, anon;
grant execute on function public.reorder_documents(uuid[]) to authenticated;
