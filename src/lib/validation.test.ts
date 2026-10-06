import { describe, expect, it } from "vitest";
import { cleanName, isUuid } from "./validation";

describe("validation", () => {
  it("isUuid", () => {
    expect(isUuid("68065ea7-c5d2-40e0-b3fc-2f856651e316")).toBe(true);
    expect(isUuid("68065ea7")).toBe(false);
    expect(isUuid(42)).toBe(false);
  });

  it("cleanName", () => {
    expect(cleanName("  Carte   Batumi \n", 200)).toBe("Carte Batumi");
    expect(cleanName("   ", 200)).toBeNull();
    expect(cleanName("abcdef", 3)).toBe("abc");
    expect(cleanName(null, 10)).toBeNull();
  });
});
