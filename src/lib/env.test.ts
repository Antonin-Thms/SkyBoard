import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "./env";

describe("normalizeSupabaseUrl", () => {
  it("ne garde que l'origine", () => {
    expect(normalizeSupabaseUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("https://abc.supabase.co/")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(normalizeSupabaseUrl(' "https://abc.supabase.co" ')).toBe("https://abc.supabase.co");
  });

  it("rejette une valeur qui n'est pas une URL", () => {
    expect(() => normalizeSupabaseUrl("abc.supabase.co")).toThrow(/invalide/);
  });
});
