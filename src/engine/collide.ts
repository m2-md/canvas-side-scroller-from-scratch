// Pure geometry: separating circle from rectangle. Does not move any body;
// only answers the question: "if they touch, how should they separate?"

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hit {
  nx: number; // unit normal: direction pushing the circle out
  ny: number;
  depth: number; // penetration depth (px)
}

// Resolves contact: returns normal + penetration depth.
export function resolveCircleRect(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
): Hit | null {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w)); // closest x
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h)); // closest y
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;

  if (d2 > r * r) return null; // no contact

  // Center is outside rectangle: closest point gives us direction
  if (d2 > 0) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }

  // Center is INSIDE rectangle (d = 0): choose shortest escape axis
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const m = Math.min(left, right, top, bottom);
  if (m === top) return { nx: 0, ny: -1, depth: top + r };
  if (m === bottom) return { nx: 0, ny: 1, depth: bottom + r };
  if (m === left) return { nx: -1, ny: 0, depth: left + r };
  return { nx: 1, ny: 0, depth: right + r };
}

// Is circle resting on top of this rectangle? (carry test)
export function restsOn(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
): boolean {
  const withinX = cx > rect.x && cx < rect.x + rect.w;
  const onTop = Math.abs(cy + r - rect.y) < r * 0.6; // base ~ platform top
  return withinX && onTop;
}
