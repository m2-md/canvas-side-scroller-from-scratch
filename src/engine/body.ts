import { type Vec2, vec } from "./vec";

export interface Body {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  invMass: number; // 1/mass — 0 for static bodies
  bounciness: number; // 0 = no bounce, 1 = full bounce
  grounded?: boolean; // resting on a platform? (platformer flag)
}

// Rectangular platform. If vx is non-zero, it is kinematic (moves autonomously).
export interface RectBody {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number; // kinematic horizontal velocity (px/s); 0 for static platforms
}

export function createBody(
  x: number,
  y: number,
  radius: number,
  opts: { static?: boolean; bounciness?: number } = {},
): Body {
  return {
    pos: vec(x, y),
    vel: vec(),
    radius,
    invMass: opts.static ? 0 : 1 / (radius * radius),
    bounciness: opts.bounciness ?? 0.6,
  };
}
