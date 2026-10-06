import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createThrottledSender } from "./throttle";

beforeEach(() => vi.useFakeTimers({ now: 0 }));
afterEach(() => vi.useRealTimers());

describe("createThrottledSender", () => {
  it("envoie le premier message tout de suite puis au plus 1 par intervalle, en gardant le dernier", () => {
    const sent: number[] = [];
    const s = createThrottledSender((v: number) => sent.push(v), 33);
    s.push(1);
    expect(sent).toEqual([1]);
    s.push(2);
    s.push(3);
    expect(sent).toEqual([1]);
    vi.advanceTimersByTime(33);
    expect(sent).toEqual([1, 3]);
  });

  it("limite le débit pendant un geste continu (≈ 30 msg/s)", () => {
    const sent: number[] = [];
    const s = createThrottledSender((v: number) => sent.push(v), 33);
    // 1 s de mouvements à 120 Hz
    for (let i = 0; i < 120; i++) {
      s.push(i);
      vi.advanceTimersByTime(1000 / 120);
    }
    expect(sent.length).toBeGreaterThanOrEqual(25);
    expect(sent.length).toBeLessThanOrEqual(31);
  });

  it("flush envoie immédiatement la dernière valeur (fin de geste garantie)", () => {
    const sent: number[] = [];
    const s = createThrottledSender((v: number) => sent.push(v), 33);
    s.push(1);
    s.push(2);
    s.flush();
    expect(sent).toEqual([1, 2]);
    vi.advanceTimersByTime(100);
    expect(sent).toEqual([1, 2]);
  });

  it("flush sans valeur en attente ne renvoie rien", () => {
    const sent: number[] = [];
    const s = createThrottledSender((v: number) => sent.push(v), 33);
    s.push(1);
    s.flush();
    expect(sent).toEqual([1]);
  });
});
