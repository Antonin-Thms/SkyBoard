"use client";

// Build "legacy" : inclut les polyfills (le build moderne exige des API JS
// très récentes, absentes de WebView2 / Safari mobile actuels).
type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | undefined;

/**
 * Charge pdf.js à la demande (navigateur uniquement) et configure son worker,
 * servi depuis public/pdfjs/ (voir scripts/copy-pdf-worker.mjs).
 */
export function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
    return pdfjs;
  });
  return pdfjsPromise;
}
