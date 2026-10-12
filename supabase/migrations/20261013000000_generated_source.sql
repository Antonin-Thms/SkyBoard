-- Planches créées dans SkyBoard (checklist, table RAMROD) : contenu d'origine
-- (titre, éléments, caractères) conservé pour pouvoir les modifier.
-- Rempli par le client à la création ; null pour un fichier envoyé.

alter table public.documents
  add column source jsonb
  check (source is null or (jsonb_typeof(source) = 'object' and pg_column_size(source) <= 65536));

-- Parties d'une même checklist (plusieurs pages = plusieurs documents).
create index documents_source_group_idx on public.documents (user_id, (source->>'group'))
  where source ? 'group';

-- Écrit à la création seulement (une modification recrée la planche).
grant insert (source) on public.documents to authenticated;
