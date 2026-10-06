import { describe, expect, it } from "vitest";
import { parseRtcSignal } from "./direct-link";

describe("parseRtcSignal", () => {
  it("accepte les messages valides", () => {
    expect(parseRtcSignal({ kind: "hello", from: "abc" })).toEqual({ kind: "hello", from: "abc" });
    expect(parseRtcSignal({ kind: "offer", from: "a", to: "b", sdp: "v=0" })).toEqual({
      kind: "offer",
      from: "a",
      to: "b",
      sdp: "v=0",
    });
    expect(
      parseRtcSignal({ kind: "ice", from: "a", to: "b", candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0, extra: 1 } }),
    ).toEqual({ kind: "ice", from: "a", to: "b", candidate: { candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 } });
  });

  it("rejette les messages invalides", () => {
    expect(parseRtcSignal({ kind: "hello", from: "<x>" })).toBeNull();
    expect(parseRtcSignal({ kind: "offer", from: "a", sdp: "v=0" })).toBeNull();
    expect(parseRtcSignal({ kind: "offer", from: "a", to: "b", sdp: "x".repeat(30_000) })).toBeNull();
    expect(parseRtcSignal({ kind: "ice", from: "a", to: "b", candidate: { candidate: 3 } })).toBeNull();
    expect(parseRtcSignal({ kind: "boom", from: "a" })).toBeNull();
  });
});
