import { describe, it, expect } from "vitest";
import {
  COYOTE,
  BUFFER,
  buoyancy,
  cutJump,
  followCamera,
  shouldJump,
} from "../src/logic";

describe("shouldJump — coyote + buffer mechanics", () => {
  it("coyote and buffer: can jump shortly after leaving edge", () => {
    expect(shouldJump({ timeSinceGround: 0.08, timeSincePress: 0.05 })).toBe(
      true,
    );
    expect(shouldJump({ timeSinceGround: 0.2, timeSincePress: 0.05 })).toBe(
      false,
    );
    expect(shouldJump({ timeSinceGround: 0.05, timeSincePress: 0.3 })).toBe(
      false,
    );
  });

  it("does not jump when timer expired (COYOTE+1 / BUFFER+1)", () => {
    expect(shouldJump({ timeSinceGround: COYOTE + 1, timeSincePress: 0 })).toBe(
      false,
    );
    expect(shouldJump({ timeSinceGround: 0, timeSincePress: BUFFER + 1 })).toBe(
      false,
    );
  });
});

describe("cutJump — variable jump height", () => {
  it("cuts upward velocity (vy < 0) to less than half", () => {
    expect(cutJump(-100)).toBeCloseTo(-45); // -100 * 0.45
  });

  it("does not touch falling velocity (vy > 0)", () => {
    expect(cutJump(80)).toBe(80);
  });

  it("does not change if velocity is zero", () => {
    expect(cutJump(0)).toBe(0);
  });
});

describe("followCamera — smooth camera tracking", () => {
  const viewW = 800;
  const targetX = 1000;
  const facing = 1;
  const lookahead = facing * viewW * 0.18;
  const desired = targetX - viewW * 0.5 + lookahead;

  it("approaches target without overshooting in a single frame", () => {
    const next = followCamera(0, targetX, facing, viewW, 0.1);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(desired); // never overshoots
  });

  it("dt-independent: one large step ≈ many small steps", () => {
    // Step through 1 second: 10 steps of dt=0.1 vs 100 steps of dt=0.01
    let a = 0;
    for (let i = 0; i < 10; i++)
      a = followCamera(a, targetX, facing, viewW, 0.1);
    let b = 0;
    for (let i = 0; i < 100; i++)
      b = followCamera(b, targetX, facing, viewW, 0.01);
    expect(a).toBeCloseTo(b, 6);
  });

  it("remains in place if already at target", () => {
    const next = followCamera(desired, targetX, facing, viewW, 0.1);
    expect(next).toBeCloseTo(desired);
  });
});

describe("buoyancy — upward spring force beneath liquid surface", () => {
  it("does not affect velocity above surface", () => {
    // cy < surface -> depth negative
    expect(buoyancy(90, 50, 100, 0.1)).toBe(50);
  });

  it("pushes upward beneath surface (negative result = upward)", () => {
    // cy = 140, surface = 100 -> depth = 40
    const vy = buoyancy(140, 0, 100, 0.1);
    expect(vy).toBeLessThan(0);
  });

  it("pushes harder the deeper it is submerged", () => {
    const shallow = buoyancy(110, 0, 100, 0.1); // depth 10
    const deep = buoyancy(160, 0, 100, 0.1); // depth 60
    expect(deep).toBeLessThan(shallow); // deeper -> stronger upward push
  });
});
