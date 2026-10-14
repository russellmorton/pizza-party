// Where things are in the kitchen: the prep board, the oven and the counter
// (a cutting board and a pizza box). The station you're working at gets the big
// space and the other two sit smaller beside it. Shared by the game and the tests.

export const STATIONS = ["board", "oven", "counter"];
export const LID = .38; // how tall an open box lid looks, as a share of the box

export function layout(W, H, focus = "board") {
  const pad = Math.min(W, H) * .025;
  let big, small;
  if (W >= H * 1.1) {
    const bw = W * .62;
    big = { x: 0, y: 0, w: bw, h: H };
    small = [{ x: bw, y: 0, w: W - bw, h: H / 2 }, { x: bw, y: H / 2, w: W - bw, h: H / 2 }];
  } else {
    const bh = H * .64;
    big = { x: 0, y: 0, w: W, h: bh };
    small = [{ x: 0, y: bh, w: W / 2, h: H - bh }, { x: W / 2, y: bh, w: W / 2, h: H - bh }];
  }
  const others = STATIONS.filter(s => s !== focus);
  const slot = { [focus]: big, [others[0]]: small[0], [others[1]]: small[1] };
  return {
    board: circleIn(inset(slot.board, pad)),
    oven: squareIn(inset(slot.oven, pad)),
    counter: counterIn(inset(slot.counter, pad)),
  };
}

const inset = (r, p) => ({ x: r.x + p, y: r.y + p, w: r.w - 2 * p, h: r.h - 2 * p });
const circleIn = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, r: Math.min(r.w, r.h) / 2 });
function squareIn(r) {
  const s = Math.min(r.w, r.h);
  return { x: r.x + (r.w - s) / 2, y: r.y + (r.h - s) / 2, s };
}
// A worktop with the cutting board and the box side by side, or one above the other.
function counterIn(r) {
  const wide = r.w >= r.h;
  const a = wide ? { ...r, w: r.w * .56 } : { ...r, h: r.h * .56 };
  const b = wide ? { ...r, x: r.x + r.w * .56, w: r.w * .44 } : { ...r, y: r.y + r.h * .56, h: r.h * .44 };
  const s = Math.min(b.w * .88, b.h * .88 / (1 + LID));
  return {
    ...r,
    cut: circleIn(inset(a, Math.min(a.w, a.h) * .06)),
    box: { x: b.x + (b.w - s) / 2, y: b.y + (b.h - s * (1 + LID)) / 2 + s * LID, s }, // (x, y) is the box base's top-left
  };
}

// Blends two layouts, for sliding smoothly from one focus to another.
export function blendLayout(a, b, t) {
  if (typeof a === "number") return a + (b - a) * t;
  const out = {};
  for (const k in b) out[k] = blendLayout(a[k], b[k], t);
  return out;
}

// What a point is over: "board", "oven", "cut", "box" or null.
export function stationAt(L, x, y) {
  if (Math.hypot(x - L.board.x, y - L.board.y) <= L.board.r) return "board";
  const o = L.oven;
  if (x >= o.x && x <= o.x + o.s && y >= o.y && y <= o.y + o.s) return "oven";
  const c = L.counter.cut, b = L.counter.box;
  if (Math.hypot(x - c.x, y - c.y) <= c.r) return "cut";
  if (x >= b.x && x <= b.x + b.s && y >= b.y - b.s * LID && y <= b.y + b.s) return "box";
  return null;
}
