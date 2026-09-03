# THE LOST OLIVE — A Side-Scroller from Scratch in Canvas

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/canvas-side-scroller-from-scratch/)** · [Source](https://github.com/m2-md/canvas-side-scroller-from-scratch)
<!-- LINKS:END -->

Working code for the article "The Camera Is a Lie: A Side-Scroller from Scratch in
Canvas and the Polite Lies We Tell the Player". An olive falls off a branch, rolls
across a warm pastel breakfast table and reaches where it belongs — a bowl of olive
oil. The article's carrying idea: **game development is the art of lies told in the
player's favor.**

Three layers:

- **The engine taken off the shelf** (`src/engine/`): the `vec` + `body` + `world`
  from the physics article were copied as-is, then extended for a platformer. The
  new `collide.ts` separates a circle from a rectangle (`resolveCircleRect`: normal
  + depth); `world.step` runs platform carrying + gravity integration + collision in
  a single loop. Screen walls and body-to-body impulse were REMOVED.
- **Pure logic** (`src/logic.ts`): the camera (`followCamera` — lerp + lookahead,
  independent of `dt`), the three jump lies (`shouldJump` coyote+buffer, `cutJump`
  variable height) and buoyancy (`buoyancy`). All of it without DOM, without canvas.
- **The game** (`src/main.ts`): a hand-built camera (`ctx.translate(-cam.x, 0)`),
  parallax layers (`layer(0.2)` / `layer(0.5)` / `layer(1.0)`), a kinematic tea
  tray, keyboard **and** touch input, a state machine (`playing`/`won`/`lost`) and
  `resetGame()` — losing/winning does **not** reload the page.

Zero assets, no sound, no network requests. Production build: **JS 9.91 KB
(gzip 4.15 KB)** (verify with `npm run build`).

## Setup and running

```bash
npm install
npm run dev     # http://localhost:5173 (or whatever port Vite gives you)
```

**How to play:** `←` `→` or `A` `D` roll the olive; `↑` / `W` / `Space` make it
jump. The olive can still jump just after it has left the edge (coyote), a jump
pressed a tick before landing fires when it touches the ground (buffer), and
releasing the key early gives a lower jump (variable jump). The kinematic **tea
tray** carries the olive on top of it along with it. If it falls into the gap it is
a gentle loss; when it reaches the oil bowl it is `won` — the olive bobs and settles
in the oil. The win/lose screen returns to `resetGame()` with a touch or `Enter`,
the page does not reload.

**Mobile:** holding the left/right half of the screen moves horizontally, swiping up
jumps (this was not in the original tutorial — in this version it is fully playable).

## Tests

```bash
npm test        # 18 unit tests
```

The tests verify the pure logic without a browser:

- `tests/collide.test.ts` — `resolveCircleRect` landing from above (`ny === -1`,
  `depth ≈ 8`, exactly the test in the article), side contact, escaping from inside
  the center, null when far; `restsOn` edge tolerance.
- `tests/logic.test.ts` — `shouldJump` three cases (exactly the test in the article)
  + consumed counter; `cutJump` (cuts while rising, does not touch while falling);
  `followCamera` (approaches the target, does not overshoot, independent of `dt`);
  `buoyancy` (`vy` unchanged above the surface, pushes up below it, gets stronger
  with depth).

## File layout

```
index.html
src/
  engine/
    vec.ts       # copied verbatim from the physics article
    body.ts      # grounded? + RectBody added to Body
    collide.ts   # NEW: Rect, Hit, resolveCircleRect, restsOn
    world.ts     # step rewritten for the platformer (carrying + integration + collision)
  logic.ts       # followCamera, shouldJump, cutJump, buoyancy (pure)
  main.ts        # camera, parallax, input, state, drawing, fullscreen canvas
tests/
  collide.test.ts
  logic.test.ts
```

## Lessons learned (also told in the article)

- In a side-scroller there is no such thing as a camera object: the screen is fixed,
  you scroll the world in the opposite direction (`ctx.translate(-cam.x, 0)`). The
  framework's `follow()` hides this one line.
- Smoothing must be independent of `dt`: `1 - Math.pow(0.001, dt)` feels the same on
  every frame. The same `Math.pow(constant, dt)` pattern is also used in buoyancy damping.
- Parallax is the layers of the lie: far scrolls 20%, middle 50%, the gameplay plane 100%.
- Circle-rectangle resolution is the continuation of the boolean test in the falling
  game: closest point + normal + depth. Geometry first, velocity second — always the
  same golden rule.
- Good jumping is not physics, it is polite lies: coyote (~0.1s), buffer (~0.12s),
  variable jump.
- A moving platform does not trick, it carries: first check who is on top of it, then
  move both together.
- Losing and winning are not `location.reload()`, they are a state + `resetGame()`.
- The first version of this game had a layout bug: the large "table" platform
  overlapped the bowl region and the olive sat on the table instead of sinking into
  the oil. The bug was caught not by eye but by a 5-scenario simulation test driving
  the engine headless (falling off the branch, being carried by the tray, jumping,
  settling on the surface, falling into the gap). The lesson: if your win condition
  is untested, your game may be unwinnable.

## License

MIT
