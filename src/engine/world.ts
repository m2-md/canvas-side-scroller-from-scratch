import { type Body, type RectBody } from "./body";
import { type Vec2, vec, add, scale } from "./vec";
import { resolveCircleRect, restsOn } from "./collide";

// Physics engine World extended for a platformer:
//  - rects: rectangular platforms (can be kinematic)
//  - step: (1) platform carry, (2) gravity integration, (3) circle-rect resolution
// Screen walls (collideWalls) and body-body impulse (collideBodies) removed:
// world is wider than screen, only a single dynamic body exists (olive).
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
    // 1. Kinematic platforms + carry: check who is on top first, then translate.
    for (const rect of this.rects) {
      const dx = rect.vx * dt;
      if (dx !== 0) {
        for (const b of this.bodies) {
          // Is olive resting on this platform? If so, carry it along.
          if (b.invMass > 0 && restsOn(b.pos.x, b.pos.y, b.radius, rect)) {
            b.pos.x += dx;
          }
        }
      }
      rect.x += dx;
    }

    // 2. Integration: gravity -> velocity -> position
    for (const b of this.bodies) {
      if (b.invMass === 0) continue; // statics do not fall
      b.grounded = false; // clean start each frame; collision re-marks it
      b.vel = add(b.vel, scale(this.gravity, dt));
      b.pos = add(b.pos, scale(b.vel, dt));
    }

    // 3. Platform collisions: geometry first, velocity second — golden rule.
    for (const b of this.bodies) {
      if (b.invMass === 0) continue;
      for (const rect of this.rects) {
        const hit = resolveCircleRect(b.pos.x, b.pos.y, b.radius, rect);
        if (!hit) continue;

        // 1. First GEOMETRY: push out penetration
        b.pos.x += hit.nx * hit.depth;
        b.pos.y += hit.ny * hit.depth;

        // 2. Then VELOCITY: zero out velocity component entering surface (platform absorbs, no bounce)
        const vn = b.vel.x * hit.nx + b.vel.y * hit.ny;
        if (vn < 0) {
          b.vel.x -= vn * hit.nx;
          b.vel.y -= vn * hit.ny;
        }

        // 3. If normal points upward: we are grounded
        if (hit.ny < -0.5) b.grounded = true;
      }
    }
  }
}
