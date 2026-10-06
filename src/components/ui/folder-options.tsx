import { Folder, Users } from "lucide-react";
import type { FolderSummary } from "@/lib/documents/folders";
import type { SelectOption } from "./select";

const icon = (shared: boolean) =>
  shared ? <Users size={15} strokeWidth={1.75} /> : <Folder size={15} strokeWidth={1.75} />;

/**
 * Options de liste déroulante pour les dossiers : les miens d'abord, puis
 * ceux partagés par chaque escadron (groupés sous son nom).
 */
export function folderOptions(
  folders: FolderSummary[],
  first: { value: string; label: string }[] = [],
): SelectOption[] {
  return [
    ...first.map((f) => ({ ...f, icon: <Folder size={15} strokeWidth={1.75} /> })),
    ...folders.filter((f) => !f.readOnly).map((f) => ({ value: f.id, label: f.name, icon: icon(!!f.squadronId) })),
    ...folders
      .filter((f) => f.readOnly)
      .map((f) => ({
        value: f.id,
        label: f.name,
        icon: icon(true),
        group: `Escadron ${f.squadronName ?? ""}`.trim(),
      })),
  ];
}
