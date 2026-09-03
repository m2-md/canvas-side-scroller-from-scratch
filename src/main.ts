// THE LOST OLIVE — Canvas side-scroller from scratch.
// The camera is an illusion: the screen never moves, we translate the world in reverse.
// The olive drops from a branch, rolls across the breakfast table, and reaches
// where it belongs — a bowl of olive oil.

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

// --- Double-loading Protection ---------------------------------------------------
const w = window as unknown as { __stopGame?: () => void };
w.__stopGame?.();
let running = true;
const aborter = new AbortController();
w.__stopGame = () => {
  running = false;
  aborter.abort();
};
const on = { signal: aborter.signal };

// --- Fullscreen Canvas --------------------------------------------------------
let W = window.innerWidth;
let H = window.innerHeight;
const SCALE = Math.min(W, H) / 600; // world is initialized once with this scale

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
canvas.width = W;
canvas.height = H;

// --- World Dimensions (fixed once; camera moves only horizontally) -----------
const S = SCALE;
const groundY = H * 0.68; // baseline of play plane (world constant)

// --- Engine -------------------------------------------------------------------
const world = new World(1000 * S); // gravity px/s²; scaled

// Olive: single dynamic body. Small radius, no bounce.
const START_X = 100 * S;
const START_Y = groundY - 190 * S; // height to drop from branch
const OLIVE_R = 18 * S;
const olive: Body = world.add(
  createBody(START_X, START_Y, OLIVE_R, { bounciness: 0 }),
);

// --- Platforms (RectBody) + breakfast theme --------------------------------
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

// Design coordinates (×S). groundY is vertical reference.
const G = groundY / S;
addPlatform(20, G, 280, 44, "simit");
addPlatform(380, G - 36, 190, 30, "cheese");
const tray = addPlatform(660, G - 10, 210, 26, "tray", 70); // KINEMATIC tea tray
addPlatform(1140, G - 62, 210, 34, "plate");
addPlatform(1470, G - 18, 250, 44, "simit");
addPlatform(1760, G + 10, 180, 80, "table"); // approach table (ends left of the bowl)
addPlatform(1950, G + 140, 230, 200, "floor"); // invisible bowl floor: keeps olive from falling

// Tea tray patrol boundaries (world px)
const TRAY_MIN = 620 * S;
const TRAY_MAX = 1090 * S;

// --- Finale: olive oil bowl ------------------------------------------------
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

// --- World boundaries ---------------------------------------------------------
const WORLD_W = bowl.x + bowl.w + 120 * S; // ≈ 3.5 screens
const WORLD_BOTTOM = (G + 210) * S; // below this line = fell off

// --- Camera & game state ----------------------------------------------------
const cam = { x: 0 }; // world will be translated left by this amount
let facing = 1; // -1 left, +1 right
let oliveAngle = 0; // roll rotation angle (visual illusion)
let timeSinceGround = COYOTE + 1;
let timeSincePress = BUFFER + 1;
let state: "playing" | "won" | "lost" = "playing";

const RUN_SPEED = 240 * S;
const JUMP_SPEED = 560 * S;

// --- Background layers (parallax decor) ----------------------------------
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

// --- Input: keyboard + touch ----------------------------------------------
const keys = new Set<string>();

function pressJump() {
  timeSincePress = 0; // event: record key press into buffer
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

// Touch: hold left/right half -> horizontal movement; swipe up -> jump.
interface Touch {
  startX: number;
  startY: number;
  side: number; // -1 left half, +1 right half
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

// move & up attached to window so touch isn't lost if finger leaves canvas.
window.addEventListener(
  "pointermove",
  (e) => {
    if (!touch) return;
    if (touch.startY - e.clientY > 40 && !touch.jumped) {
      pressJump(); // swipe up = jump
      touch.jumped = true;
    }
  },
  on,
);
window.addEventListener(
  "pointerup",
  () => {
    if (!touch) return;
    if (touch.jumped) releaseJump(); // release jump when lifting finger
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

// --- Reset: page DOES NOT reload, only resets state ------------------------
function resetGame() {
  olive.pos = vec(START_X, START_Y);
  olive.vel = vec();
  oliveAngle = 0;
  cam.x = 0;
  timeSinceGround = COYOTE + 1;
  timeSincePress = BUFFER + 1;
  state = "playing";
}

// --- Update --------------------------------------------------------------
function update(dt: number) {
  if (state === "playing") {
    // Horizontal input: keyboard or touch side
    let dir = 0;
    if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dir = -1;
    if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dir = 1;
    if (touch) dir = touch.side;
    if (dir !== 0) facing = dir;

    const targetVx = dir * RUN_SPEED;
    olive.vel.x += (targetVx - olive.vel.x) * Math.min(1, dt * 12);

    // Coyote + buffer: feed timers, jump on condition + consume
    if (olive.grounded) timeSinceGround = 0;
    else timeSinceGround += dt;
    timeSincePress += dt; // increases each frame; resets to 0 on keydown
    if (shouldJump({ timeSinceGround, timeSincePress })) {
      olive.vel.y = -JUMP_SPEED;
      timeSincePress = BUFFER + 1; // consume: one jump per press
      timeSinceGround = COYOTE + 1; // consume: no double jumping in air
    }
  }

  if (state === "playing" || state === "won") {
    world.step(dt);

    // Tea tray reverses direction at boundary (movement by vx, reversal by game)
    if (tray.x < TRAY_MIN) {
      tray.x = TRAY_MIN;
      tray.vx = Math.abs(tray.vx);
    }
    if (tray.x + tray.w > TRAY_MAX) {
      tray.x = TRAY_MAX - tray.w;
      tray.vx = -Math.abs(tray.vx);
    }

    // Olive rolls: distance / radius = angle (visual roll)
    oliveAngle += (olive.vel.x * dt) / olive.radius;

    // Camera: smooth follow, then clamp to world
    cam.x = followCamera(cam.x, olive.pos.x, facing, W, dt);
    cam.x = Math.max(0, Math.min(cam.x, WORLD_W - W)); // do not show outside world

    // Buoyancy: home safe once touching oil
    if (
      inBowl(olive.pos.x, bowl) &&
      olive.pos.y + olive.radius > bowl.surface
    ) {
      olive.vel.y = buoyancy(olive.pos.y, olive.vel.y, bowl.surface, dt);
      if (state === "playing") state = "won"; // touched oil: home safe
    }

    // Falling: gentle loss
    if (olive.pos.y - olive.radius > WORLD_BOTTOM) {
      state = "lost";
    }
  }
}

// --- Draw: layered parallax ----------------------------------------------
function layer(factor: number, body: () => void) {
  ctx.save();
  ctx.translate(-cam.x * factor, 0); // distant layers shift less
  body();
  ctx.restore();
}

function draw() {
  drawSky(); // sky: never scrolls (infinitely far), static gradient

  layer(0.2, drawFarHills); // distant hills: 20% of camera
  layer(0.5, drawMidProps); // midground: 50%
  layer(1.0, () => {
    // play layer: 100% — actual world
    drawPlatforms();
    drawBowl();
    drawOlive();
  });

  drawHud(); // UI: world-independent, never translated
}

function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#ffe7c7"); // light peach
  g.addColorStop(0.5, "#ffd9b0");
  g.addColorStop(1, "#fff2df"); // cream
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Gentle morning sun (top right)
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
  // Soft cloud puffs
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
  // Starting branch (olive drops from here)
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
    if (p.kind === "floor") continue; // invisible bowl floor

    // Common shadow
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
      // sesame seeds
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
      // tea glass
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

  // Ceramic body
  ctx.fillStyle = "#e7eef3";
  ctx.beginPath();
  ctx.moveTo(bowl.x, top);
  ctx.quadraticCurveTo(cx, top + depth * 1.9, bowl.x + bowl.w, top);
  ctx.closePath();
  ctx.fill();

  // Oil
  const oil = ctx.createLinearGradient(0, top, 0, top + depth);
  oil.addColorStop(0, "#e6b422");
  oil.addColorStop(1, "#b8860b");
  ctx.fillStyle = oil;
  ctx.beginPath();
  ctx.ellipse(cx, top, bowl.w / 2 - 6 * S, 12 * S, 0, 0, Math.PI * 2);
  ctx.fill();

  // Surface gloss
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
  ctx.rotate(oliveAngle); // visualize rolling

  // Body: deep green-black
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

  // Pit accent (makes rotation readable)
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

  // Bright highlight
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

  // Inside oil: semi-transparent oil sheen over submerged portion
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
  ctx.fillText("THE LOST OLIVE", 20 * S, 18 * S);

  ctx.font = `600 ${12 * S}px Outfit, system-ui, sans-serif`;
  ctx.fillStyle = "rgba(70,45,20,0.6)";
  ctx.fillText("← → / A D roll · ↑ / W / Space jump", 20 * S, 44 * S);

  if (state === "won") drawEndCard("HOME AT LAST", "#3f7d2f");
  else if (state === "lost") drawEndCard("The olive fell off the table", "#a04a2f");
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
  ctx.fillText("PLAY AGAIN — tap or Enter", W / 2, py + ph * 0.68);
  ctx.restore();
}

// --- Game loop ------------------------------------------------------------
let last = performance.now();

function frame(now: number) {
  if (!running) return; // old instance quietly dies (double-load protection)
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
