// KAYIP ZEYTİN — Canvas'ta sıfırdan side-scroller.
// Kamera bir yalandır: ekran hiç kaymaz, biz dünyayı ters yönde kaydırırız.
// Zeytin daldan düşer, kahvaltı sofrasında yuvarlanır, ait olduğu yere —
// bir zeytinyağı kasesine — ulaşır. İyi hissettiren her şey bir kibar yalan.

import { createBody, type Body, type RectBody } from "./engine/body";
import { World } from "./engine/world";
import { vec } from "./engine/vec";
import {
  BUFFER,
  COYOTE,
  buoyancy,
  cutJump,
  followCamera,
  shouldJump,
} from "./logic";

// --- Çift Yükleme Koruması ---------------------------------------------------
const w = window as unknown as { __stopGame?: () => void };
w.__stopGame?.();
let running = true;
const aborter = new AbortController();
w.__stopGame = () => {
  running = false;
  aborter.abort();
};
const on = { signal: aborter.signal };

// --- Tam Ekran Canvas --------------------------------------------------------
let W = window.innerWidth;
let H = window.innerHeight;
const SCALE = Math.min(W, H) / 600; // dünya bir kez bu ölçekle kurulur

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
canvas.width = W;
canvas.height = H;

// --- Dünya Ölçüleri (bir kez bakılır; kamera yalnızca yatay kayar) -----------
const S = SCALE;
const groundY = H * 0.68; // oyun düzleminin taban çizgisi (dünya sabit)

// --- Motor -------------------------------------------------------------------
const world = new World(1000 * S); // yerçekimi px/s²; ölçeğe göre

// Zeytin: tek dinamik cisim. Düşük yarıçap, sekmez.
const START_X = 100 * S;
const START_Y = groundY - 190 * S; // daldan düşecek yükseklik
const OLIVE_R = 18 * S;
const olive: Body = world.add(
  createBody(START_X, START_Y, OLIVE_R, { bounciness: 0 }),
);

// --- Platformlar (RectBody) + kahvaltı teması --------------------------------
type PlatformKind = "simit" | "cheese" | "tray" | "plate" | "table" | "floor";
interface Platform {
  body: RectBody;
  kind: PlatformKind;
}
const platforms: Platform[] = [];

function addPlatform(
  x: number,
  y: number,
  pw: number,
  ph: number,
  kind: PlatformKind,
  vx = 0,
): RectBody {
  const body = world.addRect({
    x: x * S,
    y: y * S,
    w: pw * S,
    h: ph * S,
    vx: vx * S,
  });
  platforms.push({ body, kind });
  return body;
}

// Tasarım koordinatları (×S). groundY dikey referans.
const G = groundY / S;
addPlatform(20, G, 280, 44, "simit");
addPlatform(380, G - 36, 190, 30, "cheese");
const tray = addPlatform(660, G - 10, 210, 26, "tray", 70); // KİNEMATİK çay tepsisi
addPlatform(1140, G - 62, 210, 34, "plate");
addPlatform(1470, G - 18, 250, 44, "simit");
addPlatform(1760, G + 10, 180, 80, "table"); // yaklaşma sofrası (kasenin solunda biter)
addPlatform(1950, G + 140, 230, 200, "floor"); // görünmez kase dibi: zeytin düşmesin

// Çay tepsisinin gidip geldiği sınırlar (dünya px)
const TRAY_MIN = 620 * S;
const TRAY_MAX = 1090 * S;

// --- Final: zeytinyağı kasesi ------------------------------------------------
interface Bowl {
  x: number;
  w: number;
  surface: number;
}
const bowl: Bowl = {
  x: 1955 * S,
  w: 215 * S,
  surface: (G - 22) * S,
};
function inBowl(cx: number, b: Bowl): boolean {
  return cx > b.x && cx < b.x + b.w;
}

// --- Dünya sınırları ---------------------------------------------------------
const WORLD_W = bowl.x + bowl.w + 120 * S; // ≈ 3.5 ekran
const WORLD_BOTTOM = (G + 210) * S; // bu çizginin altı = düşüş

// --- Kamera & oyun durumu ----------------------------------------------------
const cam = { x: 0 }; // dünya bu kadar sola itilecek
let facing = 1; // -1 sol, +1 sağ
let oliveAngle = 0; // yuvarlanma açısı (görünürdeki yalan)
let timeSinceGround = COYOTE + 1;
let timeSincePress = BUFFER + 1;
let state: "playing" | "won" | "lost" = "playing";

const RUN_SPEED = 240 * S;
const JUMP_SPEED = 560 * S;

// --- Arka plan katmanları (parallax dekoru) ----------------------------------
const farHills = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 240 + 60) * S,
  r: (120 + ((i * 37) % 90)) * S,
  hue: 150 + ((i * 13) % 30),
}));
const midProps = Array.from({ length: 10 }, (_, i) => ({
  x: (i * 320 + 120) * S,
  y: (60 + ((i * 53) % 90)) * S,
  r: (34 + ((i * 29) % 28)) * S,
}));

// --- Girdi: klavye + dokunmatik ----------------------------------------------
const keys = new Set<string>();

function pressJump() {
  timeSincePress = 0; // event: tuşa basıldığı an tampona yaz
}
function releaseJump() {
  olive.vel.y = cutJump(olive.vel.y);
}
function restartIfEnded() {
  if (state !== "playing") resetGame();
}

const JUMP_KEYS = new Set(["ArrowUp", "w", "W", " ", "Spacebar"]);

window.addEventListener(
  "keydown",
  (e) => {
    if (JUMP_KEYS.has(e.key)) {
      e.preventDefault();
      if (state === "playing") pressJump();
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") e.preventDefault();
    if (e.key === "Enter") restartIfEnded();
    keys.add(e.key);
  },
  on,
);

window.addEventListener(
  "keyup",
  (e) => {
    if (JUMP_KEYS.has(e.key) && state === "playing") releaseJump();
    keys.delete(e.key);
  },
  on,
);

// Dokunmatik: sol/sağ yarı basılı tutma → yatay; yukarı kaydırma → zıplama.
interface Touch {
  startX: number;
  startY: number;
  side: number; // -1 sol yarı, +1 sağ yarı
  jumped: boolean;
}
let touch: Touch | null = null;

canvas.addEventListener(
  "pointerdown",
  (e) => {
    if (state !== "playing") {
      resetGame();
      return;
    }
    const side = e.clientX < window.innerWidth / 2 ? -1 : 1;
    touch = { startX: e.clientX, startY: e.clientY, side, jumped: false };
  },
  on,
);

// move & up window'dan dinlenir: parmak canvas dışına kaysa bile kopmasın.
window.addEventListener(
  "pointermove",
  (e) => {
    if (!touch) return;
    if (touch.startY - e.clientY > 40 && !touch.jumped) {
      pressJump(); // yukarı kaydırma = zıplama
      touch.jumped = true;
    }
  },
  on,
);
window.addEventListener(
  "pointerup",
  () => {
    if (!touch) return;
    if (touch.jumped) releaseJump(); // parmağı kaldırınca zıplamayı kes
    touch = null;
  },
  on,
);
window.addEventListener("pointercancel", () => (touch = null), on);

window.addEventListener(
  "resize",
  () => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
  },
  on,
);

// --- Reset: sayfa YENİLENMEZ, sadece durum sıfırlanır ------------------------
function resetGame() {
  olive.pos = vec(START_X, START_Y);
  olive.vel = vec();
  oliveAngle = 0;
  cam.x = 0;
  timeSinceGround = COYOTE + 1;
  timeSincePress = BUFFER + 1;
  state = "playing";
}

// --- Güncelleme --------------------------------------------------------------
function update(dt: number) {
  if (state === "playing") {
    // Yatay girdi: klavye ya da dokunmatik yarı
    let dir = 0;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dir = -1;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dir = 1;
    if (touch) dir = touch.side;
    if (dir !== 0) facing = dir;

    const targetVx = dir * RUN_SPEED;
    olive.vel.x += (targetVx - olive.vel.x) * Math.min(1, dt * 12);

    // İki kibar yalan: sayaçları besle, koşul tutunca zıpla + tüket
    if (olive.grounded) timeSinceGround = 0;
    else timeSinceGround += dt;
    timeSincePress += dt; // her kare artar; tuşa basınca 0'a döner (event)

    if (shouldJump({ timeSinceGround, timeSincePress })) {
      olive.vel.y = -JUMP_SPEED;
      timeSincePress = BUFFER + 1; // tüket: aynı basış tek zıplama
      timeSinceGround = COYOTE + 1; // tüket: havada ikinci zıplama yok
    }
  }

  if (state === "playing" || state === "won") {
    world.step(dt);

    // Çay tepsisi sınıra gelince yön değiştirir (hareketi vx'e emanet, yönü oyuna)
    if (tray.x < TRAY_MIN) {
      tray.x = TRAY_MIN;
      tray.vx = Math.abs(tray.vx);
    }
    if (tray.x + tray.w > TRAY_MAX) {
      tray.x = TRAY_MAX - tray.w;
      tray.vx = -Math.abs(tray.vx);
    }

    // Zeytin yuvarlanıyor: yol / yarıçap = açı (görünürdeki yalan)
    oliveAngle += (olive.vel.x * dt) / olive.radius;

    // Kamera: yumuşak takip, sonra dünyaya sığdır
    cam.x = followCamera(cam.x, olive.pos.x, facing, W, dt);
    cam.x = Math.max(0, Math.min(cam.x, WORLD_W - W)); // dünyanın dışını gösterme

    // Üçüncü yalan: yağa değince eve döndü
    if (
      inBowl(olive.pos.x, bowl) &&
      olive.pos.y + olive.radius > bowl.surface
    ) {
      olive.vel.y = buoyancy(olive.pos.y, olive.vel.y, bowl.surface, dt);
      if (state === "playing") state = "won"; // yağa değdi: eve döndü
    }

    // Düşmek: nazik bir kayıp
    if (olive.pos.y - olive.radius > WORLD_BOTTOM) {
      state = "lost";
    }
  }
}

// --- Çizim: katman katman yalan ----------------------------------------------
function layer(factor: number, body: () => void) {
  ctx.save();
  ctx.translate(-cam.x * factor, 0); // uzak katman az kayar
  body();
  ctx.restore();
}

function draw() {
  drawSky(); // gökyüzü: hiç kaymaz (sonsuz uzak), sabit gradient

  layer(0.2, drawFarHills); // uzak tepeler: kameranın %20'si
  layer(0.5, drawMidProps); // orta plan: %50
  layer(1.0, () => {
    // oyun düzlemi: %100 — gerçek dünya
    drawPlatforms();
    drawBowl();
    drawOlive();
  });

  drawHud(); // arayüz: dünyadan bağımsız, hiç kaydırılmaz
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ffe7c7"); // açık şeftali
  g.addColorStop(0.5, "#ffd9b0");
  g.addColorStop(1, "#fff2df"); // krem
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Yumuşak sabah güneşi (sağ üstte, hafif)
  const sun = ctx.createRadialGradient(
    W * 0.8,
    H * 0.22,
    0,
    W * 0.8,
    H * 0.22,
    120 * S,
  );
  sun.addColorStop(0, "rgba(255,247,220,0.95)");
  sun.addColorStop(1, "rgba(255,247,220,0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(W * 0.8, H * 0.22, 120 * S, 0, Math.PI * 2);
  ctx.fill();
}

function drawFarHills() {
  for (const h of farHills) {
    ctx.fillStyle = `hsla(${h.hue} 40% 78% / 0.55)`;
    ctx.beginPath();
    ctx.arc(h.x, groundY + 40 * S, h.r, Math.PI, 0);
    ctx.fill();
  }
}

function drawMidProps() {
  // Yumuşak bulut lekeleri
  for (const p of midProps) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.arc(p.x + p.r, p.y + 6 * S, p.r * 0.8, 0, Math.PI * 2);
    ctx.arc(p.x - p.r, p.y + 8 * S, p.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(x: number, y: number, rw: number, rh: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, rw, rh, r);
}

function drawPlatforms() {
  // Başlangıç dalı (zeytin buradan düşer)
  ctx.strokeStyle = "#7a5230";
  ctx.lineWidth = 8 * S;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(START_X - 60 * S, START_Y - 70 * S);
  ctx.lineTo(START_X + 20 * S, START_Y - 30 * S);
  ctx.stroke();
  ctx.fillStyle = "#6fae5b";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(
      START_X - 40 * S + i * 24 * S,
      START_Y - 58 * S + i * 14 * S,
      16 * S,
      8 * S,
      -0.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  for (const p of platforms) {
    const b = p.body;
    if (p.kind === "floor") continue; // görünmez kase dibi

    // Ortak gölge
    ctx.fillStyle = "rgba(120,72,40,0.18)";
    roundRect(b.x + 4 * S, b.y + 8 * S, b.w, b.h, 12 * S);
    ctx.fill();

    if (p.kind === "simit") {
      ctx.fillStyle = "#c98a3c";
      roundRect(b.x, b.y, b.w, b.h, b.h / 2);
      ctx.fill();
      ctx.fillStyle = "#e8b25c";
      roundRect(b.x, b.y, b.w, b.h * 0.55, b.h / 2);
      ctx.fill();
      // susam
      ctx.fillStyle = "#fff4d6";
      for (let i = 0; i < b.w / (18 * S); i++) {
        ctx.beginPath();
        ctx.arc(
          b.x + 12 * S + i * 18 * S,
          b.y + b.h * 0.3,
          1.6 * S,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (p.kind === "cheese") {
      ctx.fillStyle = "#fff6cf";
      roundRect(b.x, b.y, b.w, b.h, 6 * S);
      ctx.fill();
      ctx.strokeStyle = "#f2d98a";
      ctx.lineWidth = 2 * S;
      ctx.stroke();
      ctx.fillStyle = "#f2e3a0";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(
          b.x + 24 * S + i * 40 * S,
          b.y + b.h * 0.5,
          4 * S,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    } else if (p.kind === "tray") {
      ctx.fillStyle = "#b06a3a";
      roundRect(b.x, b.y, b.w, b.h, 8 * S);
      ctx.fill();
      ctx.fillStyle = "#d98f57";
      roundRect(b.x + 6 * S, b.y + 4 * S, b.w - 12 * S, b.h * 0.4, 6 * S);
      ctx.fill();
      // çay bardağı
      ctx.fillStyle = "#7a1f1f";
      ctx.beginPath();
      ctx.ellipse(
        b.x + b.w / 2,
        b.y - 10 * S,
        18 * S,
        10 * S,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else if (p.kind === "plate") {
      ctx.fillStyle = "#eef1f5";
      roundRect(b.x, b.y, b.w, b.h, b.h / 2);
      ctx.fill();
      ctx.strokeStyle = "#c9d2dc";
      ctx.lineWidth = 3 * S;
      ctx.stroke();
    } else if (p.kind === "table") {
      ctx.fillStyle = "#c98d5a";
      roundRect(b.x, b.y, b.w, b.h, 10 * S);
      ctx.fill();
      ctx.fillStyle = "#dda56f";
      roundRect(b.x, b.y, b.w, b.h * 0.3, 10 * S);
      ctx.fill();
    }
  }
}

function drawBowl() {
  const cx = bowl.x + bowl.w / 2;
  const top = bowl.surface;
  const depth = 70 * S;

  // Seramik gövde
  ctx.fillStyle = "#e7eef3";
  ctx.beginPath();
  ctx.moveTo(bowl.x, top);
  ctx.quadraticCurveTo(cx, top + depth * 1.9, bowl.x + bowl.w, top);
  ctx.closePath();
  ctx.fill();

  // Yağ
  const oil = ctx.createLinearGradient(0, top, 0, top + depth);
  oil.addColorStop(0, "#e6b422");
  oil.addColorStop(1, "#b8860b");
  ctx.fillStyle = oil;
  ctx.beginPath();
  ctx.ellipse(cx, top, bowl.w / 2 - 6 * S, 12 * S, 0, 0, Math.PI * 2);
  ctx.fill();

  // Yüzey parlaması
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 2 * S;
  ctx.beginPath();
  ctx.ellipse(
    cx,
    top,
    bowl.w / 2 - 14 * S,
    7 * S,
    0,
    Math.PI * 1.1,
    Math.PI * 1.9,
  );
  ctx.stroke();
}

function drawOlive() {
  ctx.save();
  ctx.translate(olive.pos.x, olive.pos.y);
  ctx.rotate(oliveAngle); // yuvarlanmayı görünür kıl

  // Gövde: koyu yeşil–siyah
  const body = ctx.createRadialGradient(
    -OLIVE_R * 0.3,
    -OLIVE_R * 0.3,
    OLIVE_R * 0.2,
    0,
    0,
    OLIVE_R,
  );
  body.addColorStop(0, "#4a5d23");
  body.addColorStop(1, "#1e2610");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, OLIVE_R, 0, Math.PI * 2);
  ctx.fill();

  // Çekirdek lekesi (dönüşü okunur kılar)
  ctx.fillStyle = "#8a6d3b";
  ctx.beginPath();
  ctx.ellipse(
    OLIVE_R * 0.35,
    0,
    OLIVE_R * 0.32,
    OLIVE_R * 0.5,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // Parlak highlight
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.ellipse(
    -OLIVE_R * 0.35,
    -OLIVE_R * 0.35,
    OLIVE_R * 0.28,
    OLIVE_R * 0.18,
    -0.6,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();

  // Yağın içindeyse: batmış kısmın üstüne yarı saydam yağ örtüsü
  if (state === "won" && olive.pos.y + OLIVE_R > bowl.surface) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bowl.x, bowl.surface, bowl.w, 90 * S);
    ctx.clip();
    ctx.fillStyle = "rgba(184,134,11,0.55)";
    ctx.beginPath();
    ctx.arc(olive.pos.x, olive.pos.y, OLIVE_R * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHud() {
  ctx.fillStyle = "rgba(70,45,20,0.85)";
  ctx.font = `700 ${20 * S}px Outfit, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("KAYIP ZEYTİN", 20 * S, 18 * S);

  ctx.font = `600 ${12 * S}px Outfit, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(70,45,20,0.6)";
  ctx.fillText("← → / A D yuvarlan · ↑ / W / Space zıpla", 20 * S, 44 * S);

  if (state === "won") drawEndCard("EVE DÖNDÜN", "#3f7d2f");
  else if (state === "lost") drawEndCard("Zeytin sofradan düştü", "#a04a2f");
}

function drawEndCard(title: string, color: string) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const pw = Math.min(W * 0.8, 420 * S);
  const ph = 150 * S;
  const px = (W - pw) / 2;
  const py = H * 0.32;
  ctx.fillStyle = "rgba(255,250,240,0.92)";
  roundRect(px, py, pw, ph, 20 * S);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,72,40,0.25)";
  ctx.lineWidth = 2 * S;
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = `800 ${30 * S}px Outfit, system-ui, sans-serif`;
  ctx.fillText(title, W / 2, py + ph * 0.36);

  ctx.fillStyle = "rgba(70,45,20,0.75)";
  ctx.font = `600 ${15 * S}px Outfit, system-ui, sans-serif`;
  ctx.fillText("TEKRAR OYNA — dokun ya da Enter", W / 2, py + ph * 0.68);
  ctx.restore();
}

// --- Oyun döngüsü ------------------------------------------------------------
let last = performance.now();

function frame(now: number) {
  if (!running) return; // eski kopya sessizce ölür (çift yükleme koruması)
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
