/**
 * Nom de fichier sûr pour un téléchargement : sans accents (certains
 * navigateurs ignorent sinon le nom proposé) ni caractères interdits sous
 * Windows.
 */
export function fileName(name: string, ext: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]+/g, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${base || "kneeboard"}.${ext}`;
}
