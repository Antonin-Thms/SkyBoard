import { describe, expect, it } from "vitest";
import { flightRtba } from "./link";

const G = "0f8b6a52-3c1d-4e2f-9a7b-1c2d3e4f5a6b";
const card = (rtba: { wp: string; offset: string }[]) => ({ kind: "tactical", title: "F", group: G, part: 1, header: {}, rtba });

describe("waypoints de la fiche tactique du vol", () => {
  it("prend la fiche tactique la plus récente qui a une section RTBA", () => {
    const docs = [
      { source: card([{ wp: "OLD", offset: "0:00" }]), created_at: "2026-11-01T10:00:00Z" },
      { source: card([{ wp: "W0", offset: "0:00" }, { wp: "W1", offset: "1:35" }]), created_at: "2026-11-09T10:00:00Z" },
      { source: card([]), created_at: "2026-11-10T10:00:00Z" },
      { source: { kind: "rtba", title: "R", rows: [] }, created_at: "2026-11-11T10:00:00Z" },
      { source: null, created_at: "2026-11-12T10:00:00Z" },
    ];
    expect(flightRtba(docs)?.map((r) => r.wp)).toEqual(["W0", "W1"]);
  });

  it("null sans fiche tactique", () => {
    expect(flightRtba([{ source: null, created_at: "2026-11-01T10:00:00Z" }])).toBeNull();
  });
});
