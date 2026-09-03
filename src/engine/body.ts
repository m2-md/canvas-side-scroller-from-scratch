import { type Vec2, vec } from "./vec";

export interface Body {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  invMass: number; // 1/kütle — statik cisimler için 0
  bounciness: number; // 0 = hiç sekmez, 1 = tam sekme
  grounded?: boolean; // bir platformun üstünde mi? (platformcu bayrağı)
}

// Dikdörtgen platform. vx sıfırdan farklıysa kinematik (kendiliğinden hareket eder).
export interface RectBody {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number; // kinematik yatay hız (px/s); sabit platformda 0
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
