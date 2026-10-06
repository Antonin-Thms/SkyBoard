import { afterEach, describe, expect, it, vi } from "vitest";
import { isUuid } from "./validation";
import { uuid } from "./uuid";

afterEach(() => vi.restoreAllMocks());

describe("uuid", () => {
  it("génère un UUID valide", () => {
    expect(isUuid(uuid())).toBe(true);
  });

  it("fonctionne sans crypto.randomUUID (contexte non sécurisé)", () => {
    vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
      throw new Error("insecure");
    });
    const id = uuid();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("4");
  });
});
