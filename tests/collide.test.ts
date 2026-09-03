import { describe, it, expect } from "vitest";
import { resolveCircleRect, restsOn } from "../src/engine/collide";

describe("resolveCircleRect — resolving circle from rectangle", () => {
  it("pushes descending circle upward (normal 0, -1)", () => {
    // Olive directly above the platform, slightly embedded
    const hit = resolveCircleRect(50, 98, 10, { x: 0, y: 100, w: 200, h: 20 });
    expect(hit).not.toBeNull();
    expect(hit!.nx).toBe(0);
    expect(hit!.ny).toBe(-1); // upward: ground normal
    expect(hit!.depth).toBeCloseTo(8); // 10 - (100 - 98)
  });

  it("returns null when circle is far away (no contact)", () => {
    const hit = resolveCircleRect(500, 98, 10, { x: 0, y: 100, w: 200, h: 20 });
    expect(hit).toBeNull();
  });

  it("pushes laterally when touching from the side (normal -1, 0)", () => {
    // Olive resting against left edge of rectangle
    const hit = resolveCircleRect(-4, 110, 10, { x: 0, y: 100, w: 200, h: 20 });
    expect(hit).not.toBeNull();
    expect(hit!.nx).toBe(-1); // push left
    expect(hit!.ny).toBe(0);
  });

  it("chooses shortest escape axis when center is inside", () => {
    // Center closest to top edge: upward escape
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

describe("restsOn — is circle resting on top of platform?", () => {
  const rect = { x: 0, y: 100, w: 200, h: 20 };

  it("returns true if base rests on top of platform", () => {
    // cy + r = 90 + 10 = 100 = rect.y
    expect(restsOn(50, 90, 10, rect)).toBe(true);
  });

  it("returns false if outside horizontal range (edge tolerance)", () => {
    expect(restsOn(-5, 90, 10, rect)).toBe(false);
  });

  it("returns false if base is far from platform top", () => {
    // cy + r = 60, |60 - 100| = 40 > r*0.6
    expect(restsOn(50, 50, 10, rect)).toBe(false);
  });
});
