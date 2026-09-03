// KAYIP ZEYTİN — Saf Mantık: kamera, üç zıplama yalanı, yüzdürme.
// Hepsi DOM'suz, canvas'sız — tarayıcı açmadan test edilir.

// --- Birinci Yalan: Kamera ---------------------------------------------------

export interface Camera {
  x: number;
}

// Kamerayı hedefe yumuşat: lerp + bakış yönüne bakış-önü (lookahead)
export function followCamera(
  camX: number,
  targetX: number, // takip edilen dünya x'i (zeytin)
  facing: number, // -1 sol, +1 sağ
  viewW: number,
  dt: number,
): number {
  const lookahead = facing * viewW * 0.18; // gidilen yöne biraz açıl
  const desired = targetX - viewW * 0.5 + lookahead; // hedefi ortaya al
  const t = 1 - Math.pow(0.001, dt); // dt'den bağımsız yumuşatma
  return camX + (desired - camX) * t;
}

// --- İkinci Yalan: Kibar Yalanlar (coyote + buffer + değişken zıplama) --------

export const COYOTE = 0.1; // sn — zeminden ayrıldıktan sonraki af
export const BUFFER = 0.12; // sn — inmeden önce basılan zıplama hatırlanır

export interface JumpInput {
  timeSinceGround: number; // en son ne zaman zemindeydik
  timeSincePress: number; // en son ne zaman zıpla'ya bastık
}

// Şu an zıplamalı mı? İki kibar yalan tek koşulda.
export function shouldJump(j: JumpInput): boolean {
  return j.timeSinceGround <= COYOTE && j.timeSincePress <= BUFFER;
}

// Tuş erken bırakıldı ve hâlâ yükseliyoruz: zıplamayı kıs
export function cutJump(vy: number): number {
  return vy < 0 ? vy * 0.45 : vy;
}

// --- Üçüncü Yalan: Yüzdürme ---------------------------------------------------

// Yüzdürme: derinlikle orantılı itiş + yüksek sönüm → yumuşak sallanma
export function buoyancy(
  cy: number, // zeytin merkezi y
  vy: number, // dikey hız
  surface: number, // yağ yüzeyi y
  dt: number,
): number {
  const depth = cy - surface;
  if (depth <= 0) return vy; // yağın üstünde: dokunma

  const k = 26; // yay sertliği: batış arttıkça yukarı itiş artar
  const lifted = vy - depth * k * dt; // yerçekimine karşı yukarı kuvvet
  return lifted * Math.pow(0.05, dt); // viskoz sönüm: bata çıka durulur
}
