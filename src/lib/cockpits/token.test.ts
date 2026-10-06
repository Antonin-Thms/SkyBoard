import { describe, expect, it } from "vitest";
import { buildViewerUrl, isViewerToken } from "./token";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde";

describe("isViewerToken", () => {
  it("accepte le format généré par la base", () => {
    expect(TOKEN).toHaveLength(43);
    expect(isViewerToken(TOKEN)).toBe(true);
  });

  it("rejette le reste", () => {
    expect(isViewerToken(TOKEN.slice(1))).toBe(false);
    expect(isViewerToken(`${TOKEN.slice(1)}=`)).toBe(false);
    expect(isViewerToken(`${TOKEN.slice(1)}/`)).toBe(false);
    expect(isViewerToken(undefined)).toBe(false);
  });
});

describe("buildViewerUrl", () => {
  it("construit l'URL avec les options", () => {
    expect(buildViewerUrl("https://sb.app", TOKEN)).toBe(`https://sb.app/viewer/${TOKEN}`);
    expect(buildViewerUrl("https://sb.app", TOKEN, { transparent: true, hideStatus: true, cursor: true })).toBe(
      `https://sb.app/viewer/${TOKEN}?transparent=1&status=0&cursor=1`,
    );
  });
});
