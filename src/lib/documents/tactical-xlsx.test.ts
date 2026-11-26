import { describe, expect, it } from "vitest";
import type { DrawnCell } from "./render-tactical";
import { buildGrid } from "./tactical-xlsx";

const cell = (x: number, y: number, w: number, h: number, text?: string): DrawnCell => ({
  x,
  y,
  w,
  h,
  text,
  color: "#111111",
  bold: false,
  size: 17,
  align: "center",
  valign: "middle",
  border: true,
});

describe("grille Excel de la fiche tactique", () => {
  it("une colonne / une ligne entre deux bords, cases fusionnées sur leur étendue", () => {
    // En-tête sur toute la largeur, puis deux cases côte à côte.
    const grid = buildGrid([cell(100, 100, 200, 30, "HEAD"), cell(100, 130, 80, 30, "A"), cell(180, 130, 120, 30, "B")]);
    const [head, a, b] = grid.cells;
    expect(head).toMatchObject({ c1: a.c1, c2: b.c2, r1: head.r1, r2: head.r1 });
    expect(a.c2 + 1).toBe(b.c1);
    expect(a.r1).toBe(head.r2 + 1);
    // Proportions conservées.
    expect(grid.cols[a.c1 - 1]).toBeCloseTo(80);
    expect(grid.cols[b.c1 - 1]).toBeCloseTo(120);
    expect(grid.rows[a.r1 - 1]).toBeCloseTo(30);
  });

  it("bords presque confondus (arrondis) réunis, cases qui se chevauchent ignorées", () => {
    const grid = buildGrid([cell(100, 100, 50.4, 30), cell(150.9, 100, 50, 30), cell(120, 110, 40, 10)]);
    expect(grid.cells).toHaveLength(2);
    expect(grid.cells[0].c2 + 1).toBe(grid.cells[1].c1);
  });
});
