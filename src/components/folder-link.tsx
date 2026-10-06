"use client";

import type { AnchorHTMLAttributes } from "react";

/**
 * Lien vers un dossier de la page Documents. Le filtrage par dossier se fait
 * dans le navigateur (tous les documents sont déjà chargés) : on change
 * l'URL sans requête serveur, le changement est instantané. Ctrl/Cmd+clic
 * et clic milieu gardent le comportement normal (nouvel onglet).
 */
export function FolderLink({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...props}
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        window.history.pushState(null, "", href);
      }}
    />
  );
}
