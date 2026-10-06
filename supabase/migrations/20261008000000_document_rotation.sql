-- Rotation d'affichage d'un document, par pas de 90° (sens horaire).
alter table public.documents
  add column rotation smallint not null default 0
  check (rotation in (0, 90, 180, 270));

grant update (rotation) on public.documents to authenticated;
