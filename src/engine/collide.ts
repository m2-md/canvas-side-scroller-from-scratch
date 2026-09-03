// Saf geometri: daire ile dikdörtgeni ayırmak. Hiçbir cismi kımıldatmaz;
// sadece "değiyorlarsa nasıl ayrılır?" sorusuna cevap verir.

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hit {
  nx: number; // birim normal: daireyi dışarı iten yön
  ny: number;
  depth: number; // iç içe geçme (px)
}

// Falling game'de bu fonksiyon sadece "değiyor mu?" diyordu.
// Şimdi "nasıl ayrılır?" sorusuna da cevap veriyor: normal + derinlik.
export function resolveCircleRect(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
): Hit | null {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w)); // en yakın x
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h)); // en yakın y
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;

  if (d2 > r * r) return null; // temas yok

  // Merkez dikdörtgenin dışında: en yakın nokta bize yönü verir
  if (d2 > 0) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }

  // Merkez dikdörtgenin İÇİNDE (d = 0): en kısa kaçış eksenini seç
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

// Daire bu dikdörtgenin üstünde mi duruyor? (taşıma testi)
export function restsOn(
  cx: number,
  cy: number,
  r: number,
  rect: Rect,
): boolean {
  const withinX = cx > rect.x && cx < rect.x + rect.w;
  const onTop = Math.abs(cy + r - rect.y) < r * 0.6; // taban ~ platform üstü
  return withinX && onTop;
}
