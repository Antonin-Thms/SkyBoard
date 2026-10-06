import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("garde les chemins internes", () => {
    expect(safeRedirectPath("/remote")).toBe("/remote");
    expect(safeRedirectPath("/cockpits?x=1")).toBe("/cockpits?x=1");
  });

  it("rejette les redirections externes", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    expect(safeRedirectPath(null)).toBe("/");
  });
});
