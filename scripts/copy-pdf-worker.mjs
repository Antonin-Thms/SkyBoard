// Copie le worker pdf.js dans public/pdfjs/<version>/ pour qu'il soit servi
// en statique (même version que la bibliothèque installée). Le numéro de
// version dans le chemin permet un cache navigateur « immutable ».
// Lancé avant dev et build.
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const { version } = JSON.parse(readFileSync(require.resolve("pdfjs-dist/package.json"), "utf8"));
const baseDir = join(root, "public", "pdfjs");
const destDir = join(baseDir, version);

rmSync(baseDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "pdf.worker.min.mjs"));
console.log(`pdf.js worker ${version} copié dans public/pdfjs/${version}/`);
