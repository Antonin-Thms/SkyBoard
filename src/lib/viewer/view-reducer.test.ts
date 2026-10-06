import { describe, expect, it } from "vitest";
import { INITIAL_VIEW_STATE } from "@/lib/sync/protocol";
import { viewReducer } from "./view-reducer";

const s = (seq: number, page = 1) => ({ ...INITIAL_VIEW_STATE, docId: "a", page, seq });

describe("viewReducer", () => {
  it("applique un état plus récent, ignore les plus anciens", () => {
    let v = viewReducer(null, { type: "remote", state: s(10, 2) });
    expect(v?.page).toBe(2);
    v = viewReducer(v, { type: "remote", state: s(9, 5) });
    expect(v?.page).toBe(2);
    v = viewReducer(v, { type: "remote", state: s(11, 3) });
    expect(v?.page).toBe(3);
  });

  it("la navigation locale est remplacée par le prochain état distant", () => {
    let v = viewReducer(null, { type: "remote", state: s(10, 2) });
    v = viewReducer(v, { type: "local", docId: "b", page: 4 });
    expect(v).toMatchObject({ docId: "b", page: 4, seq: 10 });
    v = viewReducer(v, { type: "remote", state: s(11, 1) });
    expect(v).toMatchObject({ docId: "a", page: 1 });
  });
});
