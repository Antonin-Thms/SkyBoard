"use client";

import { Files, House, LogOut, Plane, Plus, Smartphone, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition, type ReactNode } from "react";
import { createFolder } from "@/app/(app)/documents/actions";
import { FolderLink } from "@/components/folder-link";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Menu } from "@/components/ui/menu";
import type { FolderSummary } from "@/lib/documents/folders";
import { useT } from "@/lib/i18n/client";
import { fmt } from "@/lib/i18n/define";

const LINKS = [
  { href: "/documents", key: "documents", Icon: Files },
  { href: "/cockpits", key: "cockpits", Icon: Plane },
  { href: "/remote", key: "remote", Icon: Smartphone },
  { href: "/escadrons", key: "squadrons", Icon: Users },
] as const;

interface AppShellProps {
  folders: FolderSummary[];
  counts: { all: number; common: number; byFolder: Record<string, number> };
  email: string;
  version: string | undefined;
  logout: () => void;
  children: ReactNode;
}

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/**
 * Cadre de l'application :
 * - ordinateur : barre latérale (repliée en colonne d'icônes sur la Remote
 *   sous 1280 px, pour laisser la place aux commandes) ;
 * - téléphone : en-tête compact et barre d'onglets en bas d'écran.
 */
export function AppShell({ folders, counts, email, version, logout, children }: AppShellProps) {
  const t = useT();
  const pathname = usePathname();
  const onDocuments = isActive(pathname, "/documents");
  // Remote : barre latérale réduite à une colonne d'icônes sous 1280 px.
  const rail = isActive(pathname, "/remote");

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      {/* Téléphone : en-tête compact */}
      <header className="flex items-center justify-between px-4 pb-1 pt-[max(0.875rem,env(safe-area-inset-top))] pl-[max(1rem,env(safe-area-inset-left))] md:hidden">
        <Link href="/" className="font-condensed text-lg font-semibold tracking-[0.2em]" title={t.nav.home}>
          SKYBOARD
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <AccountMenu email={email} logout={logout} />
        </div>
      </header>

      {/* Ordinateur : barre latérale (ou colonne d'icônes) */}
      <aside
        className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line md:flex ${
          rail ? "w-16 items-center py-5 xl:w-60 xl:items-stretch xl:py-7" : "w-60 py-7"
        }`}
      >
        <Link
          href="/"
          title={t.nav.home}
          className={`font-condensed font-semibold tracking-[0.2em] ${rail ? "text-[15px] xl:px-6 xl:text-xl" : "px-6 text-xl"}`}
        >
          <span className={rail ? "xl:hidden" : "hidden"}>SB</span>
          <span className={rail ? "hidden xl:inline" : ""}>SKYBOARD</span>
        </Link>

        <nav className={`mt-7 flex flex-col gap-0.5 ${rail ? "items-center xl:items-stretch" : ""}`} aria-label={t.nav.navigation}>
          <SideLink href="/" label={t.nav.home} Icon={House} active={pathname === "/"} rail={rail} />
          {LINKS.map(({ href, key, Icon }) => (
            <SideLink key={href} href={href} label={t.nav[key]} Icon={Icon} active={isActive(pathname, href)} rail={rail} />
          ))}
        </nav>

        {onDocuments && (
          <Suspense>
            <FolderNav folders={folders} counts={counts} />
          </Suspense>
        )}

        <div className={`mt-auto flex flex-col gap-1.5 text-[13px] text-subtle ${rail ? "items-center xl:items-stretch xl:px-6" : "px-6"}`}>
          <span className={`truncate ${rail ? "hidden xl:block" : ""}`} title={email}>
            {email}
          </span>
          <form action={logout}>
            <button
              type="submit"
              title={t.nav.logout}
              className="flex items-center gap-2 py-1 text-muted transition hover:text-fg"
            >
              <LogOut size={14} strokeWidth={1.75} />
              <span className={rail ? "sr-only xl:not-sr-only" : ""}>{t.nav.logout}</span>
            </button>
          </form>
          {version && (
            <span className={`font-condensed text-[10px] tracking-widest text-disabled ${rail ? "hidden xl:block" : ""}`}>
              V · {version.toUpperCase()}
            </span>
          )}
        </div>
      </aside>

      <main className="relative w-full min-w-0 flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 md:px-10 md:py-8">
        {/* Ordinateur : langue en haut à droite */}
        <div className="mx-auto mb-2 hidden max-w-6xl justify-end md:-mt-4 md:flex">
          <LanguageSwitcher />
        </div>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Téléphone : barre d'onglets */}
      <nav
        aria-label={t.nav.navigation}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {LINKS.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] transition ${
                active ? "text-accent shadow-[inset_0_2px_0_var(--color-accent)]" : "text-muted"
              }`}
            >
              <Icon size={22} strokeWidth={1.75} />
              {t.nav[key]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function SideLink({
  href,
  label,
  Icon,
  active,
  rail,
}: {
  href: string;
  label: string;
  Icon: typeof Files;
  active: boolean;
  rail: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 text-[15px] transition ${
        rail ? "size-11 justify-center xl:h-auto xl:w-auto xl:justify-start xl:px-6 xl:py-2.5" : "px-6 py-2.5"
      } ${active ? "bg-raised text-fg shadow-[inset_2px_0_0_var(--color-accent)]" : "text-muted hover:text-fg"}`}
    >
      <Icon size={rail ? 20 : 17} strokeWidth={1.75} className={active ? "text-accent" : ""} />
      <span className={rail ? "sr-only xl:not-sr-only" : ""}>{label}</span>
    </Link>
  );
}

function AccountMenu({ email, logout }: { email: string; logout: () => void }) {
  const t = useT();
  const formId = "logout-form";
  return (
    <>
      <form id={formId} action={logout} className="hidden" />
      <Menu
        label={t.nav.account}
        trigger={<UserRound size={20} strokeWidth={1.75} />}
        triggerClassName="btn-icon"
        items={[
          { label: email || t.nav.account, onSelect: () => {}, disabled: true },
          {
            label: t.nav.logout,
            icon: <LogOut size={16} strokeWidth={1.75} />,
            separator: true,
            onSelect: () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit(),
          },
        ]}
      />
    </>
  );
}

function FolderNav({ folders, counts }: Pick<AppShellProps, "folders" | "counts">) {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const current = params.get("folder") ?? "all";
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const own = [
    { key: "all", href: "/documents", label: t.nav.folders.all, count: counts.all, shared: false },
    { key: "common", href: "/documents?folder=common", label: t.common.folders.common, count: counts.common, shared: false },
    ...folders
      .filter((f) => !f.readOnly)
      .map((f) => ({
        key: f.id,
        href: `/documents?folder=${f.id}`,
        label: f.name,
        count: counts.byFolder[f.id] ?? 0,
        shared: !!f.squadronId,
        title: f.squadronName ? fmt(t.nav.folders.sharedWith, { name: f.squadronName }) : undefined,
      })),
  ];
  // Dossiers partagés par les coéquipiers (lecture seule).
  const shared = folders
    .filter((f) => f.readOnly)
    .map((f) => ({
      key: f.id,
      href: `/documents?folder=${f.id}`,
      label: f.name,
      count: counts.byFolder[f.id] ?? 0,
      shared: false,
      title: f.squadronName ? fmt(t.nav.folders.squadronReadOnly, { name: f.squadronName }) : undefined,
    }));

  const create = () =>
    startTransition(async () => {
      const res = await createFolder(draft);
      if (res.error) return setError(res.error);
      setError(null);
      setCreating(false);
      setDraft("");
      if (res.id) router.push(`/documents?folder=${res.id}`);
    });

  const item = (it: (typeof own)[number] & { title?: string }) => {
    const active = current === it.key;
    return (
      <FolderLink
        key={it.key}
        href={it.href}
        title={it.title}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2 px-6 py-1.5 transition ${
          active ? "bg-raised text-fg shadow-[inset_2px_0_0_var(--color-accent)]" : "text-muted hover:text-fg"
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{it.label}</span>
        {it.shared && <Users size={13} strokeWidth={1.75} className="shrink-0 text-subtle" aria-label={t.common.shared} />}
        <span className={`numeric text-[13px] ${active ? "text-accent" : ""}`}>{it.count}</span>
      </FolderLink>
    );
  };

  return (
    <div className="mt-7 hidden flex-col gap-0.5 text-sm md:flex">
      <div className="label-caps px-6 pb-2">{t.nav.folders.title}</div>
      {own.map(item)}
      {creating ? (
        <form
          className="mt-1 flex flex-col gap-2 px-5"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input
            className="input"
            autoFocus
            maxLength={100}
            aria-label={t.nav.folders.newFolderName}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={pending}
          />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary min-h-8 px-3" disabled={pending}>
              {t.common.create}
            </button>
            <button type="button" className="btn-ghost min-h-8" onClick={() => setCreating(false)}>
              {t.common.cancel}
            </button>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </form>
      ) : (
        <button
          type="button"
          className="flex items-center gap-2 px-6 py-1.5 text-left text-subtle transition hover:text-fg"
          onClick={() => setCreating(true)}
        >
          <Plus size={13} strokeWidth={1.75} />
          {t.nav.folders.newFolder}
        </button>
      )}
      {shared.length > 0 && (
        <>
          <div className="label-caps px-6 pb-2 pt-5">{t.nav.folders.squadrons}</div>
          {shared.map(item)}
        </>
      )}
    </div>
  );
}
