"use client";

/**
 * Planche RTBA : 6 cases du slot T0 (HH:MM:SS) et tableau des waypoints
 * (waypoint, T+, TOT). Image fixe : le viewer écrit par-dessus le slot réglé
 * en vol et les heures de passage calculées (voir RtbaLayer).
 */
import { rtbaLayout } from "@/lib/rtba/layout";
import { INK, newPage, toFile } from "./generate";
import type { RtbaRow } from "./tactical";

export interface RtbaLabels {
  slot: string;
  waypoint: string;
}

export async function renderRtba(title: string, rows: RtbaRow[], l: RtbaLabels, scale = 1): Promise<File> {
  const { canvas, ctx } = newPage(scale);
  const g = rtbaLayout(rows.length);

  ctx.fillStyle = INK;
  ctx.font = "600 56px sans-serif";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(title, g.title.x, g.title.y, g.title.w);
  ctx.fillRect(g.title.x, g.title.y + 30, g.title.w, 4);

  // Slot T0 : 6 cases et séparateurs
  ctx.textAlign = "center";
  ctx.font = "700 34px sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText(l.slot.toLocaleUpperCase(), g.slotLabel.x, g.slotLabel.y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  for (const b of g.boxes) {
    ctx.fillStyle = "#fdf1d6";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  ctx.fillStyle = INK;
  ctx.font = "700 90px sans-serif";
  ctx.textBaseline = "middle";
  for (const c of g.colons) ctx.fillText(":", c.x, c.y - 6);

  // Tableau : en-tête sombre, waypoints et T+, colonne TOT remplie par le viewer
  const t = g.table;
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(t.x, t.y, t.w, t.headH);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 32px sans-serif";
  [l.waypoint, "T+", "TOT"].forEach((text, i) => ctx.fillText(text, t.cols[i].x + t.cols[i].w / 2, t.y + t.headH / 2 + 2));
  const font = Math.round(Math.min(48, t.rowH * 0.55));
  rows.forEach((r, i) => {
    const y = t.y + t.headH + i * t.rowH;
    ctx.fillStyle = "#fdf1d6";
    ctx.fillRect(t.cols[0].x, y, t.cols[0].w + t.cols[1].w, t.rowH);
    ctx.fillStyle = INK;
    ctx.font = `600 ${font}px sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(r.wp, t.cols[0].x + 18, y + t.rowH / 2 + 2, t.cols[0].w - 30);
    ctx.textAlign = "center";
    ctx.font = `700 ${font}px sans-serif`;
    ctx.fillText(r.offset, t.cols[1].x + t.cols[1].w / 2, y + t.rowH / 2 + 2, t.cols[1].w - 20);
  });
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 3;
  const bottom = t.y + t.headH + rows.length * t.rowH;
  ctx.strokeRect(t.x, t.y, t.w, bottom - t.y);
  ctx.beginPath();
  for (let i = 0; i <= rows.length; i++) {
    const y = t.y + t.headH + i * t.rowH;
    ctx.moveTo(t.x, y);
    ctx.lineTo(t.x + t.w, y);
  }
  for (const c of t.cols.slice(1)) {
    ctx.moveTo(c.x, t.y);
    ctx.lineTo(c.x, bottom);
  }
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  return toFile(canvas, title);
}
