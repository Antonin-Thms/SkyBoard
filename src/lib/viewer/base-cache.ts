"use client";

import type { Rotation } from "@/lib/database.types";
import { fitScale, type Size } from "./fit";
import { naturalSize, renderRegion, type CancelHook } from "./render";
import { loadDocumentSource } from "./sources";
import type { ViewerDocument } from "./types";

/**
 * Rendus de base (page entière ajustée à la fenêtre) déjà prêts : changer de
 * document vers un voisin pré-rendu est instantané, sans attendre pdf.js.
 * Peu d'entrées : chaque canvas pèse plusieurs dizaines de Mo à la résolution
 * d'un casque.
 */
const MAX_ENTRIES = 8;

export interface BaseRender {
  canvas: HTMLCanvasElement;
  /** Taille d'affichage (px CSS) de la page ajustée à la fenêtre */
  display: Size;
}

export interface PageRef {
  doc: ViewerDocument;
  page: number;
  rotation: Rotation;
}

const ready = new Map<string, BaseRender>();
const inflight = new Map<string, Promise<BaseRender>>();

/** Clé d'un rendu : page, rotation et taille de la fenêtre (l'URL signée n'en fait pas partie). */
export function baseKey({ doc, page, rotation }: PageRef, container: Size, dpr: number) {
  return `${doc.id}:${page}:${rotation}:${Math.round(container.width)}x${Math.round(container.height)}@${dpr}`;
}

/** Rendu déjà prêt (lecture synchrone), marqué comme récemment utilisé. */
export function peekBaseRender(key: string): BaseRender | undefined {
  const hit = ready.get(key);
  if (hit) {
    ready.delete(key);
    ready.set(key, hit);
  }
  return hit;
}

/**
 * Rendu de base d'une page, partagé : un pré-rendu en cours sert directement
 * l'affichage s'il porte sur la même page. `onCancel` n'est utilisé que si
 * ce rendu n'est pas déjà en cours ailleurs.
 */
export function renderBase(ref: PageRef, container: Size, dpr: number, onCancel?: CancelHook) {
  const key = baseKey(ref, container, dpr);
  const hit = peekBaseRender(key);
  if (hit) return Promise.resolve(hit);
  let task = inflight.get(key);
  if (!task) {
    task = (async () => {
      const source = await loadDocumentSource(ref.doc);
      const natural = await naturalSize(source, ref.page, ref.rotation);
      const fit = fitScale(container, natural);
      const { canvas } = await renderRegion(source, ref.page, fit * dpr, undefined, onCancel, ref.rotation);
      const render = { canvas, display: { width: natural.width * fit, height: natural.height * fit } };
      store(key, render);
      return render;
    })();
    inflight.set(key, task);
    task.finally(() => inflight.delete(key)).catch(() => {});
  }
  return task;
}

function store(key: string, render: BaseRender) {
  ready.delete(key);
  ready.set(key, render);
  while (ready.size > MAX_ENTRIES) {
    const [oldest, evicted] = ready.entries().next().value!;
    ready.delete(oldest);
    // Libère la mémoire du canvas tout de suite.
    evicted.canvas.width = 0;
    evicted.canvas.height = 0;
  }
}
