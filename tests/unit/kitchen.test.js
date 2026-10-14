import { test } from "node:test";
import assert from "node:assert/strict";
import { layout, blendLayout, stationAt, STATIONS, LID } from "../../src/kitchen.js";

const SIZES = [[800, 560], [1000, 400], [390, 480], [360, 360], [700, 1000]];
// Each station's bounding box.
function boxes(L) {
  const { board: b, oven: o, counter: c } = L;
  return {
    board: { x: b.x - b.r, y: b.y - b.r, w: 2 * b.r, h: 2 * b.r },
    oven: { x: o.x, y: o.y, w: o.s, h: o.s },
    counter: { x: c.x, y: c.y, w: c.w, h: c.h },
  };
}
const overlap = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
const area = r => r.w * r.h;

test("the three stations fit in the kitchen without overlapping", () => {
  for (const [W, H] of SIZES) for (const f of STATIONS) {
    const bx = boxes(layout(W, H, f));
    for (const s of STATIONS) {
      const r = bx[s];
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= W + 1e-6 && r.y + r.h <= H + 1e-6, `${s} outside ${W}x${H}`);
      for (const t of STATIONS) if (s < t) assert.ok(!overlap(bx[s], bx[t]), `${s} and ${t} overlap at ${W}x${H} focus ${f}`);
    }
  }
});

test("the station you're working at gets the most room", () => {
  for (const [W, H] of SIZES) for (const f of STATIONS) {
    const bx = boxes(layout(W, H, f));
    for (const s of STATIONS) if (s !== f) assert.ok(area(bx[f]) > area(bx[s]), `${f} smaller than ${s} at ${W}x${H}`);
  }
});

test("the cutting board and the box sit on the counter, apart", () => {
  for (const [W, H] of SIZES) for (const f of STATIONS) {
    const c = layout(W, H, f).counter, cut = c.cut, b = c.box;
    const cutBox = { x: cut.x - cut.r, y: cut.y - cut.r, w: 2 * cut.r, h: 2 * cut.r };
    const boxBox = { x: b.x, y: b.y - b.s * LID, w: b.s, h: b.s * (1 + LID) };
    for (const r of [cutBox, boxBox]) assert.ok(r.x >= c.x - 1e-6 && r.y >= c.y - 1e-6 && r.x + r.w <= c.x + c.w + 1e-6 && r.y + r.h <= c.y + c.h + 1e-6);
    assert.ok(!overlap(cutBox, boxBox));
  }
});

test("taps land on the right station", () => {
  const L = layout(800, 560, "board");
  assert.equal(stationAt(L, L.board.x, L.board.y), "board");
  assert.equal(stationAt(L, L.oven.x + L.oven.s / 2, L.oven.y + L.oven.s / 2), "oven");
  assert.equal(stationAt(L, L.counter.cut.x, L.counter.cut.y), "cut");
  assert.equal(stationAt(L, L.counter.box.x + 5, L.counter.box.y + 5), "box");
  assert.equal(stationAt(L, 1, 559), null);
});

test("blending slides smoothly from one layout to the next", () => {
  const a = layout(800, 560, "board"), b = layout(800, 560, "oven");
  assert.deepEqual(blendLayout(a, b, 0), a);
  assert.deepEqual(blendLayout(a, b, 1), b);
  const mid = blendLayout(a, b, .5);
  assert.equal(mid.board.r, (a.board.r + b.board.r) / 2);
});
