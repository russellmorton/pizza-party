import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TOPPINGS, TOPPING, SAUCES, SPOOKY_TOPPINGS, SPOOKY_SAUCES, MAX_TOPPINGS, PORTIONS, makeOrder, orderText, named, sauceLook, cheeseName,
  countToppings, orderStatus, sauceStatus, cheeseStatus, sliceOf, emptySlices, spotFor, hitTopping,
  makeCoverage, dab, coverage, gaps, cutFor, doughSize, lumpiness, bakeTick, coolTick, addLog,
} from "../../src/pizza.js";

// a repeatable stand-in for Math.random
function rng(seed = 1) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
const total = o => Object.values(o.toppings).reduce((a, n) => a + n, 0);

test("first orders are one kind of topping, and plenty of it, like a real pizza", () => {
  const r = rng(3), seen = new Set();
  for (let i = 0; i < 200; i++) {
    const o = makeOrder(0, r);
    assert.equal(Object.keys(o.toppings).length, 1);
    assert.ok(total(o) >= 8 && total(o) <= 10);
    seen.add(total(o));
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [8, 9, 10]);
});

test("later orders have up to three kinds, a few of each, and always fit on the pizza", () => {
  const r = rng(5);
  let most = 0;
  for (let i = 0; i < 500; i++) {
    const o = makeOrder(20, r);
    const kinds = Object.keys(o.toppings);
    assert.ok(kinds.length >= 1 && kinds.length <= 3);
    assert.equal(new Set(kinds).size, kinds.length);
    const [few, many] = PORTIONS[kinds.length];
    for (const [id, n] of Object.entries(o.toppings)) { assert.ok(id in TOPPING); assert.ok(n >= few && n <= many); }
    assert.ok(total(o) >= 8, "enough for a topping on every slice");
    assert.ok(total(o) <= MAX_TOPPINGS);
    assert.ok(o.sauce === "tomato" || o.sauce === "pesto");
    most = Math.max(most, kinds.length);
  }
  assert.equal(most, 3);
});

test("no order asks for just one or two of a topping", () => {
  for (const [few] of Object.values(PORTIONS)) assert.ok(few >= 3);
});

test("most monsters want cheese, and the first two always do", () => {
  const r = rng(7);
  for (let i = 0; i < 100; i++) { assert.equal(makeOrder(0, r).cheese, true); assert.equal(makeOrder(1, r).cheese, true); }
  let without = 0;
  for (let i = 0; i < 1000; i++) if (!makeOrder(10, r).cheese) without++;
  assert.ok(without > 150 && without < 350, `${without} of 1000 without cheese`);
});

test("an order gets cheese, or no cheese, just as it says", () => {
  const shreds = [{ x: 0, y: 0 }];
  assert.deepEqual(cheeseStatus({ cheese: true }, []), { done: false, missing: true, extra: false });
  assert.equal(cheeseStatus({ cheese: true }, shreds).done, true);
  assert.equal(cheeseStatus({ cheese: false }, []).done, true);
  assert.deepEqual(cheeseStatus({ cheese: false }, shreds), { done: false, missing: false, extra: true });
  assert.equal(cheeseStatus({}, shreds).done, true, "an order that doesn't say wants cheese");
});

test("at Halloween every ingredient has a spooky version with its own name", () => {
  for (const t of TOPPINGS) {
    const s = SPOOKY_TOPPINGS[t.id];
    assert.ok(s.one && s.many && s.label);
    assert.notEqual(s.one, t.one);
    assert.equal(named(t.id, 1, true), s.one);
    assert.equal(named(t.id, 3, true), s.many);
    assert.equal(named(t.id, 3), t.many);
  }
  for (const k of Object.keys(SAUCES)) {
    assert.notEqual(SPOOKY_SAUCES[k].name, SAUCES[k].name);
    assert.notEqual(sauceLook(k, true).css, SAUCES[k].css);
    assert.equal(sauceLook(k), SAUCES[k]);
  }
  assert.equal(cheeseName(), "cheese");
  assert.equal(cheeseName(true), "cobweb cheese");
  assert.equal(orderText({ toppings: { olive: 3, basil: 4 } }, true), "three spider olives and four basil bats");
});

test("orders read like a sentence", () => {
  assert.equal(orderText({ toppings: { olive: 1 } }), "one olive");
  assert.equal(orderText({ toppings: { mushroom: 3, basil: 2 } }), "three mushrooms and two basil leaves");
  assert.equal(orderText({ toppings: { pepperoni: 2, olive: 1, pepper: 4 } }), "two pepperonis, one olive and four green peppers");
});

test("an order is done only with exactly the right toppings", () => {
  const order = { sauce: "tomato", toppings: { olive: 2, mushroom: 1 } };
  const t = id => ({ id, x: 0, y: 0 });
  assert.deepEqual(orderStatus(order, []), { done: false, missing: ["olive", "mushroom"], extra: [] });
  assert.equal(orderStatus(order, [t("olive"), t("olive"), t("mushroom")]).done, true);
  assert.deepEqual(orderStatus(order, [t("olive"), t("olive"), t("olive"), t("mushroom")]).extra, ["olive"]);
  const withBasil = orderStatus(order, [t("olive"), t("olive"), t("mushroom"), t("basil")]);
  assert.equal(withBasil.done, false);
  assert.deepEqual(withBasil.extra, ["basil"]);
  assert.deepEqual(countToppings([t("olive"), t("basil"), t("olive")]), { olive: 2, basil: 1 });
});

test("sauces can be mixed, but an order needs its own sauce and no other", () => {
  const order = { sauce: "tomato", toppings: {} };
  const d = k => ({ k, x: 0, y: 0, r: .2 });
  assert.deepEqual(sauceStatus(order, []), { done: false, missing: true, extra: [] });
  assert.equal(sauceStatus(order, [d("tomato"), d("tomato")]).done, true);
  assert.deepEqual(sauceStatus(order, [d("tomato"), d("pesto")]), { done: false, missing: false, extra: ["pesto"] });
  assert.deepEqual(sauceStatus(order, [d("pesto")]), { done: false, missing: true, extra: ["pesto"] });
});

test("the pizza has eight slices, the way the cutter cuts it", () => {
  assert.equal(sliceOf(1, .1), 0);            // just past three o'clock
  assert.equal(sliceOf(.1, 1), 1);            // just before six o'clock (y points down)
  assert.equal(sliceOf(-1, .1), 3);
  assert.equal(sliceOf(-1, -.1), 4);
  assert.equal(sliceOf(1, -.1), 7);
  for (let i = 0; i < 8; i++) { const a = (i + .5) * Math.PI / 4; assert.equal(sliceOf(Math.cos(a), Math.sin(a)), i); }
});

test("an order wants something on every slice", () => {
  const at = (i, r = .5) => { const a = (i + .5) * Math.PI / 4; return { id: "olive", x: Math.cos(a) * r, y: Math.sin(a) * r }; };
  assert.deepEqual(emptySlices([]), [0, 1, 2, 3, 4, 5, 6, 7]);
  const bunched = Array.from({ length: 8 }, (_, i) => at(2, .2 + i * .07));
  assert.deepEqual(emptySlices(bunched), [0, 1, 3, 4, 5, 6, 7]);
  assert.deepEqual(emptySlices([0, 1, 2, 3, 4, 5, 6].map(i => at(i))), [7]);
  assert.deepEqual(emptySlices([0, 1, 2, 3, 4, 5, 6, 7].map(i => at(i))), []);
});

test("toppings put down for you go on a slice that has none yet", () => {
  const r = rng(11), placed = [];
  for (let i = 0; i < 8; i++) placed.push(spotFor(placed, r));
  assert.deepEqual(emptySlices(placed), []);
});

test("toppings land on the pizza and spread out", () => {
  const r = rng(9), placed = [];
  for (let i = 0; i < MAX_TOPPINGS; i++) {
    const p = spotFor(placed, r);
    assert.ok(Math.hypot(p.x, p.y) <= .78 + 1e-9);
    placed.push(p);
  }
  let closest = Infinity;
  for (let i = 0; i < placed.length; i++) for (let j = 0; j < i; j++)
    closest = Math.min(closest, Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y));
  assert.ok(closest > .12, `toppings only ${closest.toFixed(3)} apart`);
});

test("tapping finds the topmost topping under a finger", () => {
  const placed = [{ id: "olive", x: 0, y: 0 }, { id: "basil", x: .05, y: 0 }, { id: "pepper", x: .6, y: .2 }];
  assert.equal(hitTopping(placed, .02, 0), 1);
  assert.equal(hitTopping(placed, .6, .25), 2);
  assert.equal(hitTopping(placed, -.6, -.6), -1);
});

test("sauce coverage grows as it is spread and reports the gaps", () => {
  const cov = makeCoverage();
  assert.equal(coverage(cov), 0);
  assert.equal(gaps(cov).length, cov.cells.length);
  const added = dab(cov, 0, 0, .5);
  assert.ok(added > 0);
  assert.equal(dab(cov, 0, 0, .5), 0, "the same spot again covers nothing new");
  assert.ok(coverage(cov) > .2 && coverage(cov) < .3);
  for (const g of gaps(cov)) dab(cov, g.x, g.y, .01);
  assert.equal(coverage(cov), 1);
  assert.equal(gaps(cov).length, 0);
});

test("rolling flattens the dough to full size and smooths it", () => {
  assert.ok(doughSize(0) < .4);
  assert.equal(doughSize(1), 1);
  assert.equal(doughSize(5), 1);
  for (let i = 0; i < 10; i++) assert.ok(doughSize((i + 1) / 10) > doughSize(i / 10));
  assert.ok(lumpiness(0) > 0);
  assert.equal(lumpiness(1), 0);
});

test("the oven always finishes, faster with wood on the fire, and never burns", () => {
  const timeToBake = heat => { let b = 0, t = 0; while (b < 1) { b = bakeTick(b, heat, .1); t += .1; } return t; };
  const cold = timeToBake(0), hot = timeToBake(1);
  assert.ok(cold < 20, `cold oven takes ${cold}s`);
  assert.ok(hot < 5, `hot oven takes ${hot}s`);
  assert.equal(bakeTick(.99, 1, 10), 1);
  let h = 0;
  for (let i = 0; i < 10; i++) h = addLog(h);
  assert.equal(h, 1);
  assert.ok(coolTick(1, 1) < 1);
  assert.equal(coolTick(.05, 10), 0);
});

test("a swipe cuts along its own direction, or the nearest cut not made yet", () => {
  assert.equal(cutFor(1, 0), 0);          // left to right
  assert.equal(cutFor(-1, 0), 0);         // right to left is the same cut
  assert.equal(cutFor(0, 1), 2);          // straight down
  assert.equal(cutFor(1, 1), 1);          // diagonal
  assert.equal(cutFor(-1, 1), 3);         // the other diagonal
  assert.equal(cutFor(1, .1, [0]), 1);    // nearly level again, but that cut is done
  assert.equal(cutFor(1, 0, [0, 1, 3]), 2);
  assert.equal(cutFor(1, 0, [0, 1, 2, 3]), -1);
});

test("every topping has a name for one and for many", () => {
  for (const t of TOPPINGS) { assert.ok(t.one); assert.ok(t.many); assert.notEqual(t.one, t.many); }
});
