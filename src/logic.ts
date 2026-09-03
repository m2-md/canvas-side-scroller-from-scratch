// THE LOST OLIVE — Pure Logic: camera, jump tricks (coyote + buffer), buoyancy.
// All pure functions without DOM or canvas — fully unit-testable.

// --- First Trick: Camera ---------------------------------------------------

export interface Camera {
  x: number;
}

// Smooth camera to target: lerp + lookahead in facing direction
export function followCamera(
  camX: number,
  targetX: number, // tracked world x (olive)
  facing: number, // -1 left, +1 right
  viewW: number,
  dt: number,
): number {
  const lookahead = facing * viewW * 0.18; // bias slightly toward facing direction
  const desired = targetX - viewW * 0.5 + lookahead; // center target with lookahead
  const t = 1 - Math.pow(0.001, dt); // dt-independent smoothing
  return camX + (desired - camX) * t;
}

// --- Second Trick: Jump Mechanics (coyote + buffer + variable jump) --------

export const COYOTE = 0.1; // s — grace period after leaving ground
export const BUFFER = 0.12; // s — early jump input buffered before landing

export interface JumpInput {
  timeSinceGround: number; // time since last grounded
  timeSincePress: number; // time since jump was pressed
}

// Should jump trigger right now? Evaluates both coyote time and input buffer.
export function shouldJump(j: JumpInput): boolean {
  return j.timeSinceGround <= COYOTE && j.timeSincePress <= BUFFER;
}

// Key released early while still rising: cut jump short
export function cutJump(vy: number): number {
  return vy < 0 ? vy * 0.45 : vy;
}

// --- Third Trick: Buoyancy ---------------------------------------------------

// Buoyancy: spring push proportional to depth + high damping -> gentle bobbing
export function buoyancy(
  cy: number, // olive center y
  vy: number, // vertical velocity
  surface: number, // oil surface y
  dt: number,
): number {
  const depth = cy - surface;
  if (depth <= 0) return vy; // above oil: untouched

  const k = 26; // spring stiffness: upward push increases with depth
  const lifted = vy - depth * k * dt; // upward force against gravity
  return lifted * Math.pow(0.05, dt); // viscous damping: settles naturally
}
