// Pizza rules shared by the game and the tests: orders, toppings, sauce
// coverage and baking. Positions on the pizza are in units of the sauce
// area's radius, so (0, 0) is the middle and 1 is where the crust starts.

export const TOPPINGS = [
  { id: "pepperoni", one: "pepperoni", many: "pepperonis" },
  { id: "mushroom", one: "mushroom", many: "mushrooms" },
  { id: "olive", one: "olive", many: "olives" },
  { id: "pepper", one: "green pepper", many: "green peppers" },
  { id: "pineapple", one: "pineapple", many: "pineapples" },
  { id: "basil", one: "basil leaf", many: "basil leaves" },
];
export const TOPPING = Object.fromEntries(TOPPINGS.map(t => [t.id, t]));

export const SAUCES = {
  tomato: { name: "tomato", colour: "red", css: "#d8392b", dark: "#a8261b" },
  pesto: { name: "pesto", colour: "green", css: "#5a9e35", dark: "#3c7422" },
};

export const MAX_TOPPINGS = 24;
export const SAUCE_DONE = .8;     // fraction of the pizza to cover before the rest fills itself in
export const CHEESE_DONE = 140;   // shreds of cheese
export const ROLL_DRAG = 5;       // board widths of rolling to flatten the dough
export const LOG_HEAT = .3;

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const word = n => WORDS[n] ?? String(n);
export const named = (id, n) => n === 1 ? TOPPING[id].one : TOPPING[id].many;

function shuffle(a, rand) {
  for (let i = a.length - 1; i > 0; i--) { const j = rand() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Orders start small (one kind, up to three) and grow to three kinds of up to five.
export function makeOrder(served = 0, rand = Math.random) {
  const kinds = served < 2 ? 1 : served < 6 ? 1 + (rand() < .6) : 1 + (rand() * 3 | 0);
  const most = served < 2 ? 3 : served < 6 ? 4 : 5;
  const ids = shuffle(TOPPINGS.map(t => t.id), rand).slice(0, kinds);
  const toppings = Object.fromEntries(ids.map(id => [id, 1 + (rand() * most | 0)]));
  return { sauce: rand() < .7 ? "tomato" : "pesto", toppings };
}

export function orderText(order) {
  const parts = Object.entries(order.toppings).map(([id, n]) => `${word(n)} ${named(id, n)}`);
  return parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts.at(-1) : parts[0];
}

export function countToppings(placed) {
  const n = {};
  for (const t of placed) n[t.id] = (n[t.id] || 0) + 1;
  return n;
}

// How the toppings on the pizza compare with the order.
export function orderStatus(order, placed) {
  const have = countToppings(placed);
  const missing = [], extra = [];
  for (const [id, n] of Object.entries(order.toppings)) if ((have[id] || 0) < n) missing.push(id);
  for (const [id, n] of Object.entries(have)) if (n > (order.toppings[id] || 0)) extra.push(id);
  return { done: !missing.length && !extra.length, missing, extra };
}

// Somewhere roomy for the next topping: the best of a handful of random spots.
export function spotFor(placed, rand = Math.random, reach = .78) {
  let best = null, bestD = -1;
  for (let i = 0; i < 30; i++) {
    const a = rand() * Math.PI * 2, r = reach * Math.sqrt(rand());
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    let d = Infinity;
    for (const t of placed) d = Math.min(d, Math.hypot(t.x - x, t.y - y));
    if (d > bestD) { bestD = d; best = { x, y }; }
  }
  return best;
}

// The topmost topping under a point, or -1.
export function hitTopping(placed, x, y, r = .16) {
  for (let i = placed.length - 1; i >= 0; i--) if (Math.hypot(placed[i].x - x, placed[i].y - y) < r) return i;
  return -1;
}

// Sauce coverage: a grid of cells across the circle, each covered or not.
export function makeCoverage(n = 18) {
  const cells = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = (i + .5) / n * 2 - 1, y = (j + .5) / n * 2 - 1;
    if (Math.hypot(x, y) <= 1) cells.push({ x, y });
  }
  return { cells, covered: new Uint8Array(cells.length) };
}
export function dab(cov, x, y, r) {
  let added = 0;
  cov.cells.forEach((c, i) => {
    if (!cov.covered[i] && Math.hypot(c.x - x, c.y - y) <= r) { cov.covered[i] = 1; added++; }
  });
  return added;
}
export const coverage = cov => cov.covered.reduce((a, v) => a + v, 0) / cov.cells.length;
export function gaps(cov) {
  return cov.cells.filter((_, i) => !cov.covered[i]);
}

// Cuts run through the middle at 0°, 45°, 90° or 135° (k = 0..3). A swipe picks the
// cut closest to its direction, or the nearest one not made yet.
export function cutFor(dx, dy, done = []) {
  const want = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 4) + 4) % 4;
  for (const step of [0, 1, -1, 2]) { const k = (want + step + 4) % 4; if (!done.includes(k)) return k; }
  return -1;
}

// Rolling flattens the dough from a ball into a full-size base, and smooths its lumps.
export const doughSize = roll => .36 + .64 * (1 - (1 - Math.min(1, roll)) ** 2);
export const lumpiness = roll => .12 * (1 - Math.min(1, roll));

// The oven always bakes, just slowly; logs on the fire speed it up. It never burns.
export const bakeTick = (bake, heat, dt) => Math.min(1, bake + dt * (.06 + .24 * heat));
export const coolTick = (heat, dt) => Math.max(0, heat - dt * .1);
export const addLog = heat => Math.min(1, heat + LOG_HEAT);
