import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { deriveChannelName } = await import("./channel");

describe("deriveChannelName", () => {
  const secret = "s".repeat(32);

  it("est déterministe et ne contient pas le token", () => {
    const token = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";
    const name = deriveChannelName(token, secret);
    expect(name).toBe(deriveChannelName(token, secret));
    expect(name).toMatch(/^cockpit:[A-Za-z0-9_-]{43}$/);
    expect(name).not.toContain(token);
  });

  it("change avec le token et avec le secret", () => {
    expect(deriveChannelName("a", secret)).not.toBe(deriveChannelName("b", secret));
    expect(deriveChannelName("a", secret)).not.toBe(deriveChannelName("a", "t".repeat(32)));
  });
});
