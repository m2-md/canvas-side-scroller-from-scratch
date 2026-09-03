import { type Body, type RectBody } from "./body";
import { type Vec2, vec, add, scale } from "./vec";
import { resolveCircleRect, restsOn } from "./collide";

// Fizik yazısının World'ü, platformcuya göre genişletildi:
//  - rects: dikdörtgen platformlar (kinematik olabilir)
//  - step: (1) platform taşıma, (2) yerçekimi entegrasyonu, (3) daire-dikdörtgen çözümleme
// Ekran duvarları (collideWalls) ve cisim-cisim impulse (collideBodies) ÇIKARILDI:
// dünya ekrandan geniş, sahnede tek dinamik cisim var (zeytin).
export class World {
  bodies: Body[] = [];
  rects: RectBody[] = [];
  gravity: Vec2;

  constructor(gravityY = 900) {
    this.gravity = vec(0, gravityY);
  }

  add(body: Body): Body {
    this.bodies.push(body);
    return body;
  }

  addRect(rect: RectBody): RectBody {
    this.rects.push(rect);
    return rect;
  }

  step(dt: number) {
    // 1. Kinematik platformlar + taşıma: önce üstünde kim var diye bak, sonra kaydır.
    for (const rect of this.rects) {
      const dx = rect.vx * dt;
      if (dx !== 0) {
        for (const b of this.bodies) {
          // Zeytin bu platformun üstünde mi? Öyleyse onu da götür.
          if (b.invMass > 0 && restsOn(b.pos.x, b.pos.y, b.radius, rect)) {
            b.pos.x += dx;
          }
        }
      }
      rect.x += dx;
    }

    // 2. Entegrasyon: yerçekimi → hız → konum (fizik yazısından aynen)
    for (const b of this.bodies) {
      if (b.invMass === 0) continue; // statikler düşmez
      b.grounded = false; // her kare temiz başla; çarpışma tekrar işaretler
      b.vel = add(b.vel, scale(this.gravity, dt));
      b.pos = add(b.pos, scale(b.vel, dt));
    }

    // 3. Platform çarpışmaları: önce geometri, sonra hız — hep aynı altın kural.
    for (const b of this.bodies) {
      if (b.invMass === 0) continue;
      for (const rect of this.rects) {
        const hit = resolveCircleRect(b.pos.x, b.pos.y, b.radius, rect);
        if (!hit) continue;

        // 1. ÖNCE GEOMETRİ: iç içe geçmeyi it
        b.pos.x += hit.nx * hit.depth;
        b.pos.y += hit.ny * hit.depth;

        // 2. SONRA HIZ: yalnızca yüzeye giren bileşeni sil (platform yutar, sekmez)
        const vn = b.vel.x * hit.nx + b.vel.y * hit.ny;
        if (vn < 0) {
          b.vel.x -= vn * hit.nx;
          b.vel.y -= vn * hit.ny;
        }

        // 3. Normal yukarı bakıyorsa: zemindeyiz
        if (hit.ny < -0.5) b.grounded = true;
      }
    }
  }
}
