// Copie le worker pdf.js dans public/ pour qu'il soit servi en statique
// (même version que la bibliothèque installée). Lancé avant dev et build.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
const destDir = join(root, "public", "pdfjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "pdf.worker.min.mjs"));
console.log("pdf.js worker copié dans public/pdfjs/");
