import { describe, expect, it } from "vitest";
import { applyRememberPolicy, shouldRemember } from "./remember";

describe("remember", () => {
  it("se souvient par défaut", () => {
    expect(shouldRemember(undefined)).toBe(true);
    expect(shouldRemember("1")).toBe(true);
    expect(shouldRemember("0")).toBe(false);
  });

  it("garde la durée quand on se souvient", () => {
    const o = { path: "/", maxAge: 100 };
    expect(applyRememberPolicy(o, true)).toBe(o);
  });

  it("transforme en cookie de session sinon", () => {
    expect(applyRememberPolicy({ path: "/", maxAge: 100, expires: new Date() }, false)).toEqual({ path: "/" });
  });

  it("garde les suppressions de cookie", () => {
    expect(applyRememberPolicy({ path: "/", maxAge: 0 }, false)).toEqual({ path: "/", maxAge: 0 });
  });
});
