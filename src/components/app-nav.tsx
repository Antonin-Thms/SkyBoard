"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { createFolder } from "@/app/(app)/documents/actions";
import type { FolderSummary } from "@/lib/documents/folders";

const LINKS = [
  { href: "/documents", label: "Documents" },
  { href: "/cockpits", label: "Cockpits" },
  { href: "/remote", label: "Remote" },
] as const;

interface AppNavProps {
  folders: FolderSummary[];
  counts: { all: number; common: number; byFolder: Record<string, number> };
}

/** Navigation principale (barre latérale) ; dossiers listés sous Documents. */
export function AppNav({ folders, counts }: AppNavProps) {
  const pathname = usePathname();
  const onDocuments = pathname === "/documents" || pathname.startsWith("/documents/");

  return (
    <div className="flex flex-col gap-8">
      <nav className="flex gap-1 md:flex-col" aria-label="Navigation">
        {LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 text-[15px] transition ${
                active ? "bg-slate-900 text-slate-100" : "text-slate-400 hover:text-slate-100"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent" : "bg-transparent"}`} />
              {label}
            </Link>
          );
        })}
      </nav>

      {onDocuments && <FolderNav folders={folders} counts={counts} />}
    </div>
  );
}

function FolderNav({ folders, counts }: AppNavProps) {
  const params = useSearchParams();
  const router = useRouter();
  const current = params.get("folder") ?? "all";
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const items = [
    { key: "all", href: "/documents", label: "Tous", count: counts.all },
    { key: "common", href: "/documents?folder=common", label: "Communs", count: counts.common },
    ...folders.map((f) => ({
      key: f.id,
      href: `/documents?folder=${f.id}`,
      label: f.name,
      count: counts.byFolder[f.id] ?? 0,
    })),
  ];

  const create = () =>
    startTransition(async () => {
      const res = await createFolder(draft);
      if (res.error) return setError(res.error);
      setError(null);
      setCreating(false);
      setDraft("");
      if (res.id) router.push(`/documents?folder=${res.id}`);
    });

  // Sur téléphone, les dossiers sont proposés dans la page Documents.
  return (
    <div className="hidden flex-col gap-1 text-sm md:flex">
      <div className="label-caps px-3 pb-1.5">Dossiers</div>
      {items.map((item) => {
        const active = current === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex justify-between gap-3 px-3 py-1.5 transition ${
              active ? "bg-slate-900 text-slate-100" : "text-slate-400 hover:text-slate-100"
            }`}
          >
            <span className="truncate">{item.label}</span>
            <span className={active ? "text-accent" : ""}>{item.count}</span>
          </Link>
        );
      })}
      {creating ? (
        <form
          className="mt-1 flex flex-col gap-2 px-1"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input
            className="input"
            autoFocus
            maxLength={100}
            placeholder="Nom (ex. Serveur A)"
            aria-label="Nom du nouveau dossier"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary px-3 py-1" disabled={pending}>
              Créer
            </button>
            <button type="button" className="btn-secondary px-3 py-1" onClick={() => setCreating(false)}>
              Annuler
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </form>
      ) : (
        <button
          type="button"
          className="px-3 py-1.5 text-left text-slate-500 hover:text-slate-100"
          onClick={() => setCreating(true)}
        >
          + Nouveau dossier
        </button>
      )}
    </div>
  );
}
