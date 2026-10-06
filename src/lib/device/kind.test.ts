import { describe, expect, it } from "vitest";
import { classifyDevice } from "./kind";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36",
};

describe("classifyDevice", () => {
  it("iPhone = téléphone", () => {
    expect(classifyDevice({ coarsePointer: true, maxTouchPoints: 5, userAgent: UA.iphone, shortSide: 393 })).toBe("phone");
  });

  it("iPad (qui se présente comme un Mac) = tablette, même avec un clavier/trackpad", () => {
    expect(classifyDevice({ coarsePointer: true, maxTouchPoints: 5, userAgent: UA.ipad, shortSide: 820 })).toBe("tablet");
    expect(classifyDevice({ coarsePointer: false, maxTouchPoints: 5, userAgent: UA.ipad, shortSide: 820 })).toBe("tablet");
  });

  it("Mac et PC = ordinateur, même un PC Windows tactile", () => {
    expect(classifyDevice({ coarsePointer: false, maxTouchPoints: 0, userAgent: UA.mac, shortSide: 900 })).toBe("desktop");
    expect(classifyDevice({ coarsePointer: false, maxTouchPoints: 10, userAgent: UA.windows, shortSide: 1080 })).toBe("desktop");
  });

  it("Android : téléphone ou tablette selon la taille", () => {
    expect(classifyDevice({ coarsePointer: true, maxTouchPoints: 5, userAgent: UA.android, shortSide: 412 })).toBe("phone");
    expect(classifyDevice({ coarsePointer: true, maxTouchPoints: 5, userAgent: UA.android, shortSide: 800 })).toBe("tablet");
  });
});
