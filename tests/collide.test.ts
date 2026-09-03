import { describe, it, expect } from "vitest";
import { resolveCircleRect, restsOn } from "../src/engine/collide";

describe("resolveCircleRect — daireyi dikdörtgenden ayırmak", () => {
  it("üstten inen daireyi yukarı iter (normal 0,-1)", () => {
    // Zeytin platformun tam üstünde, biraz gömülü
    const hit = resolveCircleRect(50, 98, 10, { x: 0, y: 100, w: 200, h: 20 });
    expect(hit).not.toBeNull();
    expect(hit!.nx).toBe(0);
    expect(hit!.ny).toBe(-1); // yukarı: zemin normali
    expect(hit!.depth).toBeCloseTo(8); // 10 - (100 - 98)
  });

  it("uzaktaki daire için temas yok (null)", () => {
    const hit = resolveCircleRect(500, 98, 10, { x: 0, y: 100, w: 200, h: 20 });
    expect(hit).toBeNull();
  });

  it("yandan değen daireyi yatay iter (normal -1,0)", () => {
    // Zeytin dikdörtgenin sol kenarına yaslanıyor
    const hit = resolveCircleRect(-4, 110, 10, { x: 0, y: 100, w: 200, h: 20 });
    expect(hit).not.toBeNull();
    expect(hit!.nx).toBe(-1); // sola it
    expect(hit!.ny).toBe(0);
  });

  it("merkez tam içerideyse en kısa kaçış eksenini seçer", () => {
    // Merkez üst kenara en yakın: yukarı kaçış
    const hit = resolveCircleRect(100, 104, 10, {
      x: 0,
      y: 100,
      w: 200,
      h: 40,
    });
    expect(hit).not.toBeNull();
    expect(hit!.nx).toBe(0);
    expect(hit!.ny).toBe(-1);
  });
});

describe("restsOn — daire platformun üstünde mi duruyor?", () => {
  const rect = { x: 0, y: 100, w: 200, h: 20 };

  it("taban platform üstüne oturmuşsa true", () => {
    // cy + r = 90 + 10 = 100 = rect.y
    expect(restsOn(50, 90, 10, rect)).toBe(true);
  });

  it("x aralığının dışındaysa false (kenar toleransı)", () => {
    expect(restsOn(-5, 90, 10, rect)).toBe(false);
  });

  it("taban platform üstünden uzaksa false", () => {
    // cy + r = 60, |60 - 100| = 40 > r*0.6
    expect(restsOn(50, 50, 10, rect)).toBe(false);
  });
});
