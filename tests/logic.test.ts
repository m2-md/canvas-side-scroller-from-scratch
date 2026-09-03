import { describe, it, expect } from "vitest";
import {
  COYOTE,
  BUFFER,
  buoyancy,
  cutJump,
  followCamera,
  shouldJump,
} from "../src/logic";

describe("shouldJump — coyote + buffer, iki yalan tek koşul", () => {
  it("coyote ve tampon: kenardan yeni ayrılmışken zıplayabilir", () => {
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

  it("tüketilmiş sayaçlar (COYOTE+1 / BUFFER+1) zıplatmaz", () => {
    expect(shouldJump({ timeSinceGround: COYOTE + 1, timeSincePress: 0 })).toBe(
      false,
    );
    expect(shouldJump({ timeSinceGround: 0, timeSincePress: BUFFER + 1 })).toBe(
      false,
    );
  });
});

describe("cutJump — değişken zıplama yüksekliği", () => {
  it("yükselirken (vy < 0) hızı yarıdan biraz azına keser", () => {
    expect(cutJump(-100)).toBeCloseTo(-45); // -100 * 0.45
  });

  it("düşerken (vy > 0) hıza dokunmaz", () => {
    expect(cutJump(80)).toBe(80);
  });

  it("hız sıfırsa değişmez", () => {
    expect(cutJump(0)).toBe(0);
  });
});

describe("followCamera — bir sayıyı hedefe yaklaştırmak", () => {
  const viewW = 800;
  const targetX = 1000;
  const facing = 1;
  const lookahead = facing * viewW * 0.18;
  const desired = targetX - viewW * 0.5 + lookahead;

  it("hedefe yaklaşır ama tek karede aşmaz", () => {
    const next = followCamera(0, targetX, facing, viewW, 0.1);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(desired); // asla aşmaz
  });

  it("dt'den bağımsız: bir büyük adım ≈ çok küçük adım", () => {
    // 1 saniyeyi tek dt=0.1'lik 10 adımda vs dt=0.01'lik 100 adımda geç
    let a = 0;
    for (let i = 0; i < 10; i++)
      a = followCamera(a, targetX, facing, viewW, 0.1);
    let b = 0;
    for (let i = 0; i < 100; i++)
      b = followCamera(b, targetX, facing, viewW, 0.01);
    expect(a).toBeCloseTo(b, 6);
  });

  it("zaten hedefteyse yerinde kalır", () => {
    const next = followCamera(desired, targetX, facing, viewW, 0.1);
    expect(next).toBeCloseTo(desired);
  });
});

describe("buoyancy — yüzeyin altında yukarı iten yay", () => {
  it("yüzeyin üstünde hıza dokunmaz", () => {
    // cy < surface → depth negatif
    expect(buoyancy(90, 50, 100, 0.1)).toBe(50);
  });

  it("yüzeyin altında yukarı iter (sonuç negatif = yukarı)", () => {
    // cy = 140, surface = 100 → depth = 40
    const vy = buoyancy(140, 0, 100, 0.1);
    expect(vy).toBeLessThan(0);
  });

  it("ne kadar batarsa o kadar sert iter", () => {
    const shallow = buoyancy(110, 0, 100, 0.1); // depth 10
    const deep = buoyancy(160, 0, 100, 0.1); // depth 60
    expect(deep).toBeLessThan(shallow); // daha derin → daha güçlü yukarı itiş
  });
});
