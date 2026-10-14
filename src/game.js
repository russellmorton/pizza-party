import {
  TOPPINGS, TOPPING, SAUCES, MAX_TOPPINGS, SAUCE_DONE, CHEESE_DONE, ROLL_DRAG,
  makeOrder, orderText, countToppings, orderStatus, spotFor, hitTopping, cutFor,
  makeCoverage, dab, coverage, gaps, doughSize, bakeTick, coolTick, addLog, word, named,
} from "./pizza.js";
import {
  TOPPING_SIZE, drawBoard, drawPin, drawPizza, drawTopping, drawOvenAt, ovenFloor, drawPeel, drawCounter, drawBox, drawTarget,
  sizeSauce, paintDabs, clearSauce,
} from "./draw.js";
import { layout, blendLayout, stationAt, LID } from "./kitchen.js";
import { monsterSVG, MONSTER_COLOURS, KINDS, INK } from "./monster.js";

const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pick = a => a[Math.random() * a.length | 0];
const cap = s => s[0].toUpperCase() + s.slice(1);

// ---------- state ----------
// Steps: roll → sauce → cheese → top → bake → cut → box → serve → eat. The step chips group them in six.
const CHIP = { roll: 0, sauce: 1, cheese: 1, top: 2, bake: 3, cut: 4, box: 5, serve: 5, eat: 5 };
let mode = "orders", muted = false;
let served = [];
let customer = newCustomer(), order = makeOrder(0);
let P = freshPizza();
let busy = false;      // a step is finishing and will move on by itself

function freshPizza() {
  return {
    step: "roll", where: "board", roll: 0, sauce: null, dabs: [], cov: makeCoverage(), cheese: [], toppings: [],
    bake: 0, heat: 0, cuts: [], eaten: Array(8).fill(false), box: "counter", lid: 0, lidTo: 0,
  };
}
function newCustomer(prev) {
  let c;
  do c = { kind: Math.random() * KINDS | 0, colour: pick(MONSTER_COLOURS) }; while (prev && c.colour === prev.colour);
  return c;
}

// ---------- sound + voice ----------
let ac, noiseBuf;
function audio() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } }
  if (ac?.state === "suspended") ac.resume().catch(() => {});
  return ac;
}
function tone(freq, t0, dur, type = "sine", gain = .18, slide) {
  const a = audio(); if (!a || muted) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime + t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, a.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, a.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(gain, a.currentTime + t0 + .02);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur);
  o.connect(g).connect(a.destination); o.start(a.currentTime + t0); o.stop(a.currentTime + t0 + dur + .05);
}
function hiss(dur, freq, type = "bandpass", gain = .2, t0 = 0) {
  const a = audio(); if (!a || muted) return;
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  const t = a.currentTime + t0;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + .01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(a.destination); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
}
const sfx = {
  roll: () => { hiss(.22, 260, "lowpass", .35); tone(70, 0, .2, "sine", .08); },
  squish: () => tone(200 + Math.random() * 80, 0, .14, "sine", .14, 110),
  sprinkle: () => hiss(.14, 6000, "highpass", .08),
  plop: () => tone(520 + Math.random() * 120, 0, .16, "sine", .22, 200),
  pop: () => tone(320, 0, .12, "sine", .2, 900),
  crackle: () => { for (let i = 0; i < 7; i++) hiss(.04, 1500 + Math.random() * 2500, "bandpass", .4, i * .05 + Math.random() * .03); tone(90, 0, .35, "triangle", .1, 55); },
  whoosh: () => hiss(.6, 700, "bandpass", .25),
  ding: () => { tone(1568, 0, 1.4, "sine", .2); tone(3136, 0, .8, "sine", .05); },
  slice: () => { hiss(.3, 3200, "bandpass", .25); tone(900, 0, .3, "triangle", .03, 1400); },
  nom: () => { tone(190, 0, .07, "square", .05, 120); tone(160, .1, .08, "square", .05, 100); },
  full: () => { tone(200, 0, .15, "square", .05); tone(160, .12, .2, "square", .05); },
  done: () => { [659, 784, 1047].forEach((f, i) => tone(f, i * .09, .25, "triangle", .14)); },
  yay: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .11, .35, "triangle", .16)); tone(1568, .5, .5, "sine", .08); },
};
const every = (fn, ms) => { let last = 0; return () => { const n = performance.now(); if (n - last > ms) { last = n; fn(); } }; };
const rollSound = every(sfx.roll, 160);

function say(text, queue = false) {
  $("announce").textContent = text;
  if (muted) return;
  try {
    if (!queue) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = .9; u.pitch = 1.25;
    speechSynthesis.speak(u);
  } catch {}
}

// ---------- title ----------
const titleCols = ["#d8392b", "#ffc83d", "#5a9e35"];
$("title").innerHTML = [..."Pizza Party"].map((ch, i) =>
  ch === " " ? " " : `<span aria-hidden="true" style="color:${titleCols[i % 3]}">${ch}</span>`).join("");

// ---------- icons ----------
const ICON = {
  pin: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="2" y="27" width="13" height="10" rx="5" fill="#b8743c"/><rect x="49" y="27" width="13" height="10" rx="5" fill="#b8743c"/><rect x="12" y="21" width="40" height="22" rx="7" fill="#e8b06c"/></g><path d="M17 27h30" stroke="#fff" stroke-opacity=".6" stroke-width="3" stroke-linecap="round"/></svg>`,
  ladle: c => `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M44 6 L36 30" fill="none" stroke-width="7"/><path d="M44 6 L36 30" fill="none" stroke="#c9ccd6" stroke-width="3"/><path d="M12 32 h40 a20 18 0 0 1 -40 0z" fill="#c9ccd6"/><path d="M15 34 h34 a17 13 0 0 1 -34 0z" fill="${c}" stroke="none"/></g><path d="M26 54 c-2 4 -1 7 2 7 s4 -3 2 -7 l-2 -4z" fill="${c}" stroke="${INK}" stroke-width="2"/></svg>`,
  cheese: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M14 10 h36 l6 44 h-48z" fill="#d6dbe6"/><path d="M26 2 h12 v8 h-12z" fill="#ff5a5f"/></g><g fill="${INK}"><circle cx="22" cy="22" r="2.5"/><circle cx="32" cy="22" r="2.5"/><circle cx="42" cy="22" r="2.5"/><circle cx="25" cy="33" r="2.5"/><circle cx="35" cy="33" r="2.5"/><circle cx="22" cy="44" r="2.5"/><circle cx="32" cy="44" r="2.5"/><circle cx="42" cy="44" r="2.5"/></g><g stroke="#e1b93e" stroke-width="4" stroke-linecap="round"><path d="M18 58 l4 4"/><path d="M34 58 l-3 5"/><path d="M46 58 l3 4"/></g></svg>`,
  undo: `<svg viewBox="0 0 64 64" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 26 h22 a12 12 0 0 1 0 24 h-14"/><path d="M28 16 l-10 10 l10 10"/></svg>`,
  oven: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M6 58 V32 C6 8 58 8 58 32 V58Z" fill="#d9694a"/><path d="M18 58 V42 C18 28 46 28 46 42 V58Z" fill="#3a1a10"/></g><path d="M26 56 q-2 -10 6 -16 q-1 7 4 9 q2 -4 1 -8 q6 6 2 15z" fill="#ffb02e"/></svg>`,
  log: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M8 26 h40 a8 10 0 0 1 0 20 h-40 z" fill="#8a5232"/><ellipse cx="10" cy="36" rx="8" ry="10" fill="#e3b77e"/></g><ellipse cx="10" cy="36" rx="3.5" ry="4.5" fill="none" stroke="#b07a46" stroke-width="2"/><path d="M22 31 h18 M26 41 h16" stroke="#5e341d" stroke-width="2.5" stroke-linecap="round"/><path d="M46 20 q-3 -7 3 -12 q0 5 4 6 q1 -3 0 -6 q6 6 1 12z" fill="#ffb02e" stroke="#e0661a" stroke-width="2"/></svg>`,
  peel: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-linecap="round"><path d="M36 36 L58 58" stroke-width="11"/><path d="M36 36 L58 58" stroke="#b8743c" stroke-width="6"/><circle cx="26" cy="26" r="21" fill="#e9c48f" stroke-width="3"/></g></svg>`,
  cutter: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linecap="round"><path d="M30 34 L54 8" stroke-width="10"/><path d="M30 34 L54 8" stroke="#ff5a5f" stroke-width="5"/><circle cx="24" cy="40" r="18" fill="#dfe3ec"/><circle cx="24" cy="40" r="4" fill="${INK}"/></g></svg>`,
};

// Paints a topping into a small <canvas>, for the bins, the order ticket and your hand.
function toppingCanvas(cv, id, cssSize, scale = .38, rot = id === "basil" ? -.5 : 0) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(cssSize * dpr);
  cv.style.width = cv.style.height = cssSize + "px";
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTopping(c, id, cssSize / 2, cssSize / 2, cssSize * scale, rot);
}

// ---------- customer card ----------
const creatureEl = $("creature"), ticketEl = $("ticket"), shelfEl = $("shelf");
function renderCreature(mood = "wait") {
  creatureEl.innerHTML = monsterSVG(customer.kind, customer.colour, mood);
  creatureEl.setAttribute("aria-label", order ? `A hungry monster who wants ${orderText(order)} on ${SAUCES[order.sauce].name} sauce. Tap to hear the order.` : "A hungry monster. Make any pizza you like!");
}
function renderTicket() {
  if (!order) {
    ticketEl.innerHTML = `<div class="ticket-title">Order</div><p class="any">Any pizza you like!</p>`;
    return;
  }
  const s = SAUCES[order.sauce];
  ticketEl.innerHTML = `<div class="ticket-title">Order</div>
    <div class="line sauce-line" data-sauce="${order.sauce}"><span class="swatch" style="background:${s.css}"></span><span>${cap(s.name)} sauce</span></div>
    ${Object.entries(order.toppings).map(([id, n]) => `<div class="line" data-id="${id}" data-count="${n}" aria-label="${word(n)} ${named(id, n)}"><canvas aria-hidden="true"></canvas><span class="dots" aria-hidden="true">${"<i></i>".repeat(n)}</span><b class="extra" hidden></b></div>`).join("")}
    <div class="line no-line" hidden></div>`;
  ticketEl.querySelectorAll(".line[data-id]").forEach(l => toppingCanvas(l.querySelector("canvas"), l.dataset.id, 30, .4));
  updateTicket();
}
function updateTicket() {
  if (!order) return;
  const have = countToppings(P.toppings);
  ticketEl.querySelectorAll(".line[data-id]").forEach(l => {
    const n = have[l.dataset.id] || 0, want = +l.dataset.count;
    l.querySelectorAll(".dots i").forEach((d, i) => d.classList.toggle("on", i < n));
    const x = l.querySelector(".extra");
    x.hidden = n <= want; x.textContent = `+${n - want}`;
    l.classList.toggle("full", n === want);
  });
  const sauceLine = ticketEl.querySelector(".sauce-line");
  sauceLine.classList.toggle("full", P.sauce === order.sauce && coverage(P.cov) >= SAUCE_DONE);
  const wrong = Object.keys(have).filter(id => !(id in order.toppings));
  const no = ticketEl.querySelector(".no-line");
  no.hidden = !wrong.length;
  no.innerHTML = wrong.map(id => `<span class="nope"><canvas data-id="${id}" aria-hidden="true"></canvas></span>`).join("") + `<span class="vh">No ${wrong.map(id => named(id, 2)).join(" or ")}</span>`;
  no.querySelectorAll("canvas").forEach(c => toppingCanvas(c, c.dataset.id, 26, .4));
}
function renderShelf() {
  shelfEl.innerHTML = served.slice(-8).map(c => `<div>${monsterSVG(c.kind, c.colour, "happy")}</div>`).join("");
  shelfEl.setAttribute("aria-label", `${served.length} ${served.length === 1 ? "pizza" : "pizzas"} served`);
}
function hop(cls = "happy") { creatureEl.classList.remove(cls); void creatureEl.offsetWidth; creatureEl.classList.add(cls); }


// ---------- step chips, hints + tray ----------
const tray = $("tray");
function renderSteps() {
  document.querySelectorAll("#steps li").forEach((li, i) => {
    li.classList.toggle("now", i === CHIP[P.step]);
    li.classList.toggle("done", i < CHIP[P.step]);
    if (i === CHIP[P.step]) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
}
const tool = (id, label, icon, cls = "") => `<button class="tool ${cls}" id="tool-${id}" aria-label="${label}"><span class="ico">${icon}</span><span class="lbl">${label}</span></button>`;
const meter = `<div class="meter" role="progressbar" aria-label="Baking" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="meter-fill"></div><span class="meter-pizza">${ICON.oven}</span></div>`;
function renderTray() {
  const st = P.step;
  let h = "";
  if (st === "roll") h = tool("roll", "Roll", ICON.pin);
  else if (st === "sauce") h = Object.entries(SAUCES).map(([k, s]) => tool(`ladle-${k}`, `${cap(s.name)} sauce`, ICON.ladle(s.css))).join("");
  else if (st === "cheese") h = tool("cheese", "Cheese", ICON.cheese);
  else if (st === "top") h = TOPPINGS.map(t => `<button class="tool bin" data-id="${t.id}" aria-label="${cap(t.many)}"><span class="ico"><canvas aria-hidden="true"></canvas></span><span class="lbl">${cap(t.one)}</span></button>`).join("")
    + tool("undo", "Take one off", ICON.undo, "small") + tool("peel", "Peel", ICON.peel, "go");
  else if (st === "bake") h = tool("log", "Wood", ICON.log) + meter + tool("peel", "Peel", ICON.peel, "go");
  else if (st === "cut") h = tool("cutter", "Cutter", ICON.cutter);
  tray.innerHTML = `<p class="hint" id="hint"></p><div class="tools">${h}</div>`;
  tray.dataset.step = st;
  tray.querySelectorAll(".bin").forEach(b => {
    toppingCanvas(b.querySelector("canvas"), b.dataset.id, 46);
    b.addEventListener("click", e => tapBin(b.dataset.id, b, e.detail === 0));
  });
  const on = (id, fn) => { const el = $(`tool-${id}`); if (el) el.addEventListener("click", e => { audio(); fn(el, e.detail === 0); }); };
  on("roll", rollButton);
  for (const k of Object.keys(SAUCES)) on(`ladle-${k}`, (el, kb) => toggleTool("ladle", k, el, kb));
  on("cheese", (el, kb) => toggleTool("cheese", null, el, kb));
  on("undo", () => held ? putAway() : P.toppings.length && removeTopping(P.toppings.length - 1));
  on("peel", (el, kb) => toggleTool("peel", null, el, kb));
  on("log", (el, kb) => toggleTool("log", null, el, kb));
  on("cutter", (el, kb) => toggleTool("cutter", null, el, kb));
  updateTray();
}
// The tools that make sense at each step; anything else in your hand is put away.
const TOOLS = { roll: [], sauce: ["ladle"], cheese: ["cheese"], top: ["topping", "peel"], bake: ["peel", "log"], cut: ["cutter"], box: ["pizza"], serve: ["box"], eat: [] };
function updateTray() {
  tray.querySelectorAll(".tool[id^=tool-]").forEach(b => {
    const [, kind, id] = b.id.split("-");
    if (["ladle", "cheese", "peel", "log", "cutter"].includes(kind)) b.setAttribute("aria-pressed", held?.kind === kind && (!id || held.id === id));
  });
  tray.querySelectorAll(".bin").forEach(b => b.setAttribute("aria-pressed", held?.kind === "topping" && held.id === b.dataset.id));
  if (P.step === "top") $("tool-undo").disabled = !P.toppings.length && !held;
  const peel = $("tool-peel");
  if (peel) peel.classList.toggle("pulse", !held && (P.step === "top" ? readyToBake() : P.where === "oven" && P.bake >= 1));
  const hint = $("hint");
  if (hint) hint.textContent = hintText();
  creatureEl.classList.toggle("target", held?.kind === "box");
}
const readyToBake = () => !order || orderStatus(order, P.toppings).done;
function hintText() {
  const k = held?.kind;
  switch (P.step) {
    case "roll": return pointerKind === "touch" ? "Rub the rolling pin over the dough" : "Move the rolling pin over the dough";
    case "sauce": return k === "ladle" ? "Tap the pizza to pour on the sauce" : "Pick up a ladle of sauce";
    case "cheese": return k === "cheese" ? "Tap the pizza to sprinkle the cheese" : "Pick up the cheese";
    case "top":
      if (k === "peel") return "Tap the pizza to slide the peel under it";
      if (k === "topping") return "Tap the pizza to put it down";
      return readyToBake() ? "Ready? Pick up the peel" : "Pick up a topping";
    case "bake":
      if (P.where === "peel") return P.bake >= 1 ? "Put it on the cutting board" : "Tap the oven to slide it in";
      if (P.bake >= 1) return k === "peel" ? "Tap the oven to take it out" : "Ding! Pick up the peel";
      return k === "log" ? "Tap the oven to add the wood" : "Add wood to make the fire hotter";
    case "cut": return k === "cutter" ? "Tap the edge of the pizza to cut it" : "Pick up the cutter";
    case "box": return k === "pizza" ? "Tap the box to put it in" : "Tap the pizza to pick it up";
    case "serve": return k === "box" ? "Give it to the monster!" : "Tap the box to pick it up";
  }
  return "";
}

const workLabel = {
  roll: "The kitchen. A ball of dough on the board: roll it flat.",
  sauce: "The kitchen. Pizza dough on the board: pour on the sauce.",
  cheese: "The kitchen. Pizza with sauce on the board: sprinkle the cheese.",
  top: "The kitchen. Pick up a topping, then tap the pizza to put it down. Press Enter to put down what you're holding.",
  bake: "The kitchen. The oven is ready for the pizza.",
  cut: "The kitchen. A baked pizza on the cutting board: cut it into slices.",
  box: "The kitchen. Eight slices on the cutting board, and an open pizza box.",
  serve: "The kitchen. A pizza box, ready for the monster.",
  eat: "The monster is eating the pizza.",
};
function setStep(step) {
  P.step = step;
  busy = false;
  if (held && !TOOLS[step].includes(held.kind)) putAway(true);
  renderSteps();
  renderTray();
  cv.setAttribute("aria-label", workLabel[step]);
  if (step === "sauce") say("Nice and flat! Now pick up a ladle and pour on the sauce.");
  if (step === "cheese") say("Now the cheese!");
  if (step === "top") say(order ? `Now the toppings! ${cap(orderText(order))}. Pick one up and put it on the pizza.` : "Now decorate your pizza! Pick up a topping and put it on the pizza.");
  if (step === "cut") say("Now cut it into slices! Pick up the cutter.");
  if (step === "box") say("Eight slices! Now put it in the box.");
  if (step === "serve") say("Give the box to the monster!");
}
function finishStep(next, delay = 800) {
  if (busy) return;
  busy = true;
  sfx.done();
  setTimeout(() => setStep(next), reduce ? 150 : delay);
}

// ---------- the kitchen ----------
// One canvas holds the prep board, the oven and the counter. The pizza moves
// between them: board → peel → oven → peel → cutting board → box → monster.
const wrap = $("work"), cv = $("work-canvas"), ctx = cv.getContext("2d");
const sauceCv = document.createElement("canvas");
let W = 300, H = 300, dpr = 1;
let focus = "board", L = layout(W, H), Lfrom = null, Lt0 = 0;
function fit() {
  const r = wrap.getBoundingClientRect();
  W = Math.max(160, Math.floor(r.width)); H = Math.max(160, Math.floor(r.height));
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.style.width = W + "px"; cv.style.height = H + "px";
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  L = layout(W, H, focus); Lfrom = null;
  // sauce is painted at the size the pizza has on the big board
  sizeSauce(sauceCv, layout(W, H, "board").board.r * .92 * .84, dpr);
  if (P.sauce) paintDabs(sauceCv, P.dabs, P.sauce);
  lastSig = null;
}
new ResizeObserver(fit).observe(wrap);

function focusFor() {
  if (["roll", "sauce", "cheese", "top"].includes(P.step)) return "board";
  if (P.step === "bake") return P.where === "peel" && P.bake >= 1 ? "counter" : "oven";
  return "counter";
}
function setFocus(f) {
  if (f === focus) return;
  focus = f;
  if (reduce) { L = layout(W, H, f); return; }
  Lfrom = L; Lt0 = performance.now();
}

// Where the pizza is drawn, and how big. Null while it's in your hand.
function pizzaAt() {
  if (P.where === "board") return { x: L.board.x, y: L.board.y, R: L.board.r * .92 * doughSize(P.roll), sq: 1 };
  if (P.where === "oven") { const f = ovenFloor(L.oven); return { x: f.x, y: f.y, R: f.R, sq: f.squash }; }
  if (P.where === "counter") return { x: L.counter.cut.x, y: L.counter.cut.y, R: L.counter.cut.r * .9, sq: 1 };
  if (P.where === "box" && P.box !== "hand") { const b = L.counter.box; return { x: b.x + b.s / 2, y: b.y + b.s / 2, R: b.s * .42, sq: 1 }; }
  return null;
}
// A point on the canvas in pizza units (1 = the edge of the sauce).
function toU(p, g = pizzaAt()) { return { x: (p.x - g.x) / (g.R * .84), y: (p.y - g.y) / (g.R * .84 * g.sq) }; }
function local(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

// animation bits that aren't part of the pizza itself
let pinY = null, rollAnim = null, cutAnim = null, sparks = [], puffs = [];

let last = performance.now(), lastSig = null;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  setFocus(focusFor());
  if (Lfrom) {
    const t = Math.min(1, (now - Lt0) / 700), e = t < .5 ? 2 * t * t : 1 - (2 - 2 * t) ** 2 / 2;
    const to = layout(W, H, focus);
    L = blendLayout(Lfrom, to, e);
    if (t >= 1) { L = to; Lfrom = null; }
  }
  if (rollAnim) {
    const p = Math.min(1, (now - rollAnim.t0) / rollAnim.ms), R = L.board.r * .92 * doughSize(P.roll);
    pinY = L.board.y - R * .9 + R * 1.8 * p;
    P.roll = rollAnim.from + (rollAnim.to - rollAnim.from) * p;
    if (p >= 1) { rollAnim = null; pinY = null; afterRoll(); }
  }
  if (cutAnim) {
    cutAnim.p = Math.min(1, (now - cutAnim.t0) / cutAnim.ms);
    if (cutAnim.p >= 1) { const done = cutAnim.done; cutAnim = null; done(); }
  }
  bakeFrame(dt);
  if (P.lid !== P.lidTo) P.lid = P.lidTo > P.lid ? Math.min(P.lidTo, P.lid + dt * 2.2) : Math.max(P.lidTo, P.lid - dt * 2.2);
  puffs = puffs.filter(p => now - p.t < 400);

  // Only redraw when something has changed or is moving: a big canvas is costly to repaint.
  const ovenLive = focus === "oven" || P.where === "oven" || P.heat > 0 || sparks.length > 0;
  const moving = Lfrom || rollAnim || cutAnim || puffs.length || ovenLive || P.lid !== P.lidTo;
  const sig = [W, H, dpr, P.step, P.where, P.box, P.roll, pinY, P.dabs.length, P.sauce, P.cheese.length, P.toppings.length,
    P.toppings.reduce((a, t) => a + t.x + t.y * 3, 0), P.cuts.join(), P.eaten.join(), held?.kind].join("|");
  if (moving || sig !== lastSig) {
    lastSig = moving ? null : sig;
    draw(now, ovenLive);
  }
  requestAnimationFrame(frame);
}

function draw(now, ovenLive) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  drawBoard(ctx, L.board.x, L.board.y, L.board.r);
  drawOvenAt(ctx, L.oven, ovenLive ? now / 1000 : 0, P.heat, sparks);
  drawCounter(ctx, L.counter);
  const cut = L.counter.cut;
  drawBoard(ctx, cut.x, cut.y, cut.r);
  const g = pizzaAt(), pz = { ...P, sauceImg: sauceCv, cutAnim };
  const pizzaHere = () => {
    ctx.save();
    ctx.translate(g.x, g.y); ctx.scale(1, g.sq); ctx.translate(-g.x, -g.y);
    drawPizza(ctx, g.x, g.y, g.R, pz);
    ctx.restore();
  };
  if (P.box !== "hand") drawBox(ctx, L.counter.box, P.lid, P.where === "box" ? pizzaHere : null, LID);
  if (g && P.where !== "box") pizzaHere();
  if (P.step === "roll") drawPin(ctx, L.board.x, pinY ?? L.board.y + L.board.r * .5, L.board.r * 1.5);
  if (P.where === "oven" && P.bake >= 1) {
    const o = L.oven;
    ctx.fillStyle = "#fff6c9"; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = "round";
    ctx.font = `800 ${o.s * .14}px "Baloo 2", system-ui, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.strokeText("Ding!", o.x + o.s / 2, o.y + o.s * .36); ctx.fillText("Ding!", o.x + o.s / 2, o.y + o.s * .36);
  }
  const target = targetShape();
  if (target) drawTarget(ctx, target);
  for (const p of puffs) {
    const k = (now - p.t) / 400;
    ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 + k), 0, Math.PI * 2); ctx.stroke();
  }
}

// The dashed ring showing where the thing in your hand can go.
function targetShape() {
  if (!held) return null;
  const k = held.kind, g = pizzaAt(), o = L.oven, b = L.counter.box;
  const pizzaRing = g && { x: g.x, y: g.y, r: g.R * 1.04 };
  const mouth = { x: o.x + o.s * .2, y: o.y + o.s * .42, w: o.s * .6, h: o.s * .4 };
  if (["topping", "ladle", "cheese"].includes(k)) return P.where === "board" ? pizzaRing : null;
  if (k === "peel") {
    if (P.where === "board") return P.step === "top" && readyToBake() ? pizzaRing : null;
    if (P.where === "peel") return P.bake >= 1 ? { ...L.counter.cut, r: L.counter.cut.r * 1.02 } : mouth;
    return P.bake >= 1 ? mouth : null;
  }
  if (k === "log") return mouth;
  if (k === "cutter") return P.where === "counter" ? pizzaRing : null;
  if (k === "pizza") return { x: b.x - 4, y: b.y - b.s * LID - 4, w: b.s + 8, h: b.s * (1 + LID) + 8 };
  return null;
}

// ---------- your hand ----------
// Tap something to pick it up and it comes with you; tap where it should go to use it.
// Tools (ladles, cheese, peel, cutter) stay in your hand until you put them back;
// a topping or a log is one piece at a time.
let held = null;                       // { kind, id, rot }
let pointerKind = "mouse";
const heldEl = document.createElement("div");
heldEl.className = "held"; heldEl.hidden = true; heldEl.setAttribute("aria-hidden", "true");
document.body.append(heldEl);
const lastPointer = { x: 0, y: 0 };
addEventListener("pointerdown", e => { pointerKind = e.pointerType; lastPointer.x = e.clientX; lastPointer.y = e.clientY; }, true);
addEventListener("pointermove", e => {
  lastPointer.x = e.clientX; lastPointer.y = e.clientY;
  if (held && e.pointerType !== "touch") moveHeld(e.clientX, e.clientY);
});
function moveHeld(x, y) { heldEl.style.transform = `translate(${x}px,${y}px) rotate(${held?.rot || 0}rad)`; }

function svgHeld(svg, size) {
  heldEl.innerHTML = `<div style="width:${size}px;height:${size}px">${svg}</div>`;
  return [size / 2, size / 2];
}
function canvasHeld(w, h, paint) {
  const c = document.createElement("canvas"), d = Math.min(devicePixelRatio || 1, 2);
  c.width = w * d; c.height = h * d; c.style.width = w + "px"; c.style.height = h + "px";
  const x = c.getContext("2d"); x.setTransform(d, 0, 0, d, 0, 0);
  paint(x);
  heldEl.replaceChildren(c);
}
// Draws what's in your hand. Returns the point that sits under the pointer.
function renderHeld() {
  const k = held.kind, pr = Math.max(34, Math.min(76, L.counter.cut.r * .8));
  const ts = size => Math.round(Math.max(72, Math.min(140, size))); // tools scale with the kitchen
  let c;
  if (k === "topping") {
    const r = L.board.r * .92 * .84 * TOPPING_SIZE, size = Math.ceil(r / .38);
    const cnv = document.createElement("canvas"); toppingCanvas(cnv, held.id, size, .38, 0); heldEl.replaceChildren(cnv);
    c = [size / 2, size / 2];
  } else if (k === "ladle") c = svgHeld(ICON.ladle(SAUCES[held.id].css), ts(L.board.r * .42));
  else if (k === "cheese") c = svgHeld(ICON.cheese, ts(L.board.r * .36));
  else if (k === "log") c = svgHeld(ICON.log, ts(L.oven.s * .3));
  else if (k === "cutter") c = svgHeld(ICON.cutter, ts(L.counter.cut.r * .55));
  else if (k === "peel") {
    const r = pr * 1.12;
    canvasHeld(r * 2.6, r * 2.6, x => { drawPeel(x, r * 1.05, r * 1.05, r); if (P.where === "peel") drawPizza(x, r * 1.05, r * 1.05, pr, { ...P, sauceImg: sauceCv }); });
    c = [r * 1.05, r * 1.05];
  } else if (k === "pizza") {
    canvasHeld(pr * 2.3, pr * 2.3, x => drawPizza(x, pr * 1.15, pr * 1.15, pr, { ...P, sauceImg: sauceCv }));
    c = [pr * 1.15, pr * 1.15];
  } else if (k === "box") {
    const bs = pr * 1.6;
    canvasHeld(bs * 1.2, bs * 1.2, x => drawBox(x, { x: bs * .08, y: bs * .08, s: bs }, 1, null, LID));
    c = [bs * .6, bs * .6];
  }
  heldEl.style.margin = `${-c[1]}px 0 0 ${-c[0]}px`;
}
// Picks something up. (x, y) is where it appears on screen.
function hold(kind, id, x, y, rot = 0) {
  held = { kind, id, rot };
  renderHeld();
  heldEl.hidden = false;
  document.body.classList.add("holding");
  moveHeld(x, y);
  heldEl.animate([{ scale: .6 }, { scale: 1.15 }, { scale: 1 }], { duration: reduce ? 0 : 220 });
  lastSig = null;
  updateTray();
}
function putAway(quiet) {
  if (!held) return;
  held = null;
  heldEl.hidden = true;
  document.body.classList.remove("holding");
  lastSig = null;
  if (!quiet) { sfx.pop(); updateTray(); }
}
// Where something picked up from the tray first appears: under a mouse, or lifted out of its button.
function fromButton(btn, byKeyboard) {
  const r = btn.getBoundingClientRect();
  const follow = !byKeyboard && (pointerKind === "mouse" || pointerKind === "pen");
  return follow ? [lastPointer.x, lastPointer.y] : [r.left + r.width / 2, r.top + r.height * .25];
}
const carrying = () => held && (held.kind === "pizza" || held.kind === "box" || (held.kind === "peel" && P.where === "peel"));
function toggleTool(kind, id, btn, byKeyboard) {
  if (busy) return;
  if (carrying()) return say(P.where === "peel" ? "Put the pizza down first!" : "Put that down first!");
  if (held?.kind === kind && (held.id ?? null) === id) return putAway();
  hold(kind, id, ...fromButton(btn, byKeyboard));
  tone(600, 0, .1, "sine", .12, 900);
  if (kind === "ladle") say(`${cap(SAUCES[id].name)} sauce`);
}

// ---------- tapping in the kitchen ----------
let press = null, lastRoll = null;
cv.addEventListener("pointerdown", e => {
  audio();
  press = { x: e.clientX, y: e.clientY, moved: 0 };
  if (e.pointerType === "touch") { cv.setPointerCapture(e.pointerId); lastRoll = local(e); }
});
cv.addEventListener("pointermove", e => {
  if (press) press.moved += Math.hypot(e.clientX - press.x, e.clientY - press.y), press.x = e.clientX, press.y = e.clientY;
  // rolling needs no click: just move the pin over the dough (or rub it with a finger)
  if (P.step !== "roll" || rollAnim || busy) return;
  const p = local(e);
  if (Math.hypot(p.x - L.board.x, p.y - L.board.y) > L.board.r) { pinY = null; lastRoll = null; return; }
  if (lastRoll) {
    const d = Math.hypot(p.x - lastRoll.x, p.y - lastRoll.y);
    if (d > 0) { rollBy(d / (L.board.r * 2 * ROLL_DRAG)); rollSound(); }
  }
  pinY = p.y; lastRoll = p;
});
cv.addEventListener("pointerleave", () => { pinY = null; lastRoll = null; });
cv.addEventListener("pointerup", e => {
  if (press && press.moved < 14) tapAt(local(e), e);
  press = null;
  if (e.pointerType === "touch") lastRoll = null;
});
cv.addEventListener("pointercancel", () => { press = null; lastRoll = null; });
cv.addEventListener("keydown", e => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); audio(); keyUse(); }
});

function tapAt(p, e) {
  if (busy) return;
  const at = stationAt(L, p.x, p.y), g = pizzaAt();
  const onPizza = !!g && Math.hypot(p.x - g.x, (p.y - g.y) / g.sq) <= g.R;
  const u = g ? toU(p, g) : null;
  const onBoardPizza = onPizza && P.where === "board";
  switch (held?.kind) {
    case "ladle": return onBoardPizza ? pour(u) : say("Pour it on the pizza!");
    case "cheese": return onBoardPizza ? sprinkleAt(u) : say("Sprinkle it on the pizza!");
    case "topping": return onBoardPizza && Math.hypot(u.x, u.y) < .95 ? putDown(u) : say("Put it on the pizza!");
    case "peel": return usePeel(at, onPizza);
    case "log": return at === "oven" ? throwLog() : say("Put the wood in the oven!");
    case "cutter": return onPizza && P.where === "counter" ? cutOnce(p.x - g.x, p.y - g.y) : say("Cut the pizza on the cutting board!");
    case "pizza": return at === "box" ? boxIt() : at === "cut" ? setDownPizza() : say("Put it in the box!");
    case "box": return at === "box" ? setDownBox() : say("Give it to the monster!");
  }
  if (P.step === "top" && onBoardPizza) {
    const i = hitTopping(P.toppings, u.x, u.y);
    if (i < 0) return say("Tap a topping down below to pick it up!");
    const [t] = P.toppings.splice(i, 1);
    hold("topping", t.id, e.clientX, e.clientY - (e.pointerType === "touch" ? 30 : 0), t.rot);
    sfx.pop();
    return updateTicket();
  }
  if (P.step === "box" && onPizza && P.where === "counter") return pickUpPizza(e.clientX, e.clientY);
  if (P.step === "serve" && at === "box") return pickUpBox(e.clientX, e.clientY);
  say(hintText());
}
// Enter on the kitchen does the obvious thing with what you're holding.
function keyUse() {
  if (busy) return;
  const k = held?.kind, r = cv.getBoundingClientRect();
  if (P.step === "roll") return rollButton();
  if (k === "ladle") { const open = gaps(P.cov); return pour(open.length ? pick(open) : { x: 0, y: 0 }); }
  if (k === "cheese") { const a = Math.random() * 7, d = Math.random() * .6; return sprinkleAt({ x: Math.cos(a) * d, y: Math.sin(a) * d }); }
  if (k === "topping") return putDown(spotFor(P.toppings));
  if (k === "peel") return usePeel(P.where === "peel" ? (P.bake >= 1 ? "cut" : "oven") : P.where === "oven" ? "oven" : "board", true);
  if (k === "log") return throwLog();
  if (k === "cutter") { const n = [0, 2, 1, 3].find(n => !P.cuts.includes(n)); return n === undefined ? undefined : cutOnce(Math.cos(n * Math.PI / 4), Math.sin(n * Math.PI / 4)); }
  if (k === "pizza") return boxIt();
  if (!held && P.step === "box") return pickUpPizza(r.left + L.counter.cut.x, r.top + L.counter.cut.y);
  if (!held && P.step === "serve") return pickUpBox(r.left + L.counter.box.x, r.top + L.counter.box.y);
  say(hintText());
}

// ---------- step 1: roll the dough ----------
function rollBy(amount) {
  if (P.step !== "roll" || busy) return;
  P.roll = Math.min(1, P.roll + amount);
  afterRoll();
}
function afterRoll() {
  if (P.roll >= 1 && P.step === "roll") finishStep("sauce");
}
function rollButton() {
  if (P.step !== "roll" || busy || rollAnim) return;
  sfx.roll();
  if (reduce) return rollBy(.2);
  rollAnim = { t0: performance.now(), ms: 450, from: P.roll, to: Math.min(1, P.roll + .2) };
}

// ---------- step 2: sauce and cheese ----------
function chooseSauce(k) {
  if (P.sauce === k) return;
  P.sauce = k;
  paintDabs(sauceCv, P.dabs, k); // recolour what's already spread
  updateTicket();
}
function addDab(x, y, r = .2) {
  if (Math.hypot(x, y) > 1.15) return;
  const sp = Array.from({ length: 2 }, () => [(Math.random() - .5) * r, (Math.random() - .5) * r, r * (.06 + Math.random() * .06)]);
  const d = { x, y, r, sp };
  P.dabs.push(d);
  paintDabs(sauceCv, [d], P.sauce);
  dab(P.cov, x, y, r);
}
// A ladle of sauce lands where you tap and swirls out.
function pour(u) {
  if (P.step !== "sauce" || busy) return;
  chooseSauce(held.id);
  sfx.squish();
  const pts = [[0, 0], ...Array.from({ length: 9 }, (_, i) => [Math.cos(i * .9) * .045 * (i + 1), Math.sin(i * .9) * .045 * (i + 1)])];
  pts.forEach(([dx, dy], i) => setTimeout(() => { if (P.step === "sauce") { addDab(u.x + dx, u.y + dy, .2); if (i === pts.length - 1) checkSauce(); } }, reduce ? 0 : i * 30));
}
function checkSauce() {
  updateTicket();
  if (P.step !== "sauce" || busy || coverage(P.cov) < SAUCE_DONE) return;
  if (order && P.sauce !== order.sauce) {
    if (P.wrongSaid !== P.sauce) {
      P.wrongSaid = P.sauce;
      const want = SAUCES[order.sauce];
      say(`Hmm, this monster wants ${want.name} sauce. Pick up the ${want.colour} sauce.`);
    }
    return;
  }
  // spread the last little gaps for them
  for (const g of gaps(P.cov)) addDab(g.x, g.y, .16);
  updateTicket();
  finishStep("cheese");
}
function sprinkle(x, y, n, spread) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = spread * Math.sqrt(Math.random());
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (Math.hypot(px, py) > .97) continue;
    P.cheese.push({ x: px, y: py, a: Math.random() * Math.PI, l: .07 + Math.random() * .05, spot: Math.random() < .08 });
  }
  if (P.cheese.length >= CHEESE_DONE) finishStep("top");
}
// A handful of cheese falls where you tap.
function sprinkleAt(u) {
  if (P.step !== "cheese" || busy) return;
  sfx.sprinkle();
  for (let i = 0; i < 5; i++) setTimeout(() => { if (P.step === "cheese") sprinkle(u.x, u.y, 8, .42); }, reduce ? 0 : i * 45);
}

// ---------- step 3: toppings ----------
function tapBin(id, bin, byKeyboard) {
  audio();
  if (P.step !== "top" || busy) return;
  if (carrying()) return say("Put the pizza down first!");
  if (held?.kind === "topping" && held.id === id) return putAway();
  if (P.toppings.length >= MAX_TOPPINGS) {
    sfx.full();
    say("The pizza is full!");
    return;
  }
  hold("topping", id, ...fromButton(bin, byKeyboard), Math.random() * Math.PI * 2);
  tone(600, 0, .1, "sine", .12, 900);
  say(cap(TOPPING[id].one));
}
function putDown(u) {
  const t = { id: held.id, x: u.x, y: u.y, rot: held.rot };
  putAway(true);
  landTopping(t);
}
function landTopping(t) {
  if (P.step !== "top") return;
  P.toppings.push(t);
  sfx.plop();
  const n = countToppings(P.toppings)[t.id];
  if (!order) say(`${word(n)} ${named(t.id, n)}`);
  else {
    const st = orderStatus(order, P.toppings), want = order.toppings[t.id];
    if (!want) say(`Oh no, no ${named(t.id, 2)} for this monster! Take it off.`);
    else if (n > want) say(`Oops, too many ${named(t.id, 2)}! Take one off.`);
    else if (st.done) { say(`${cap(word(n))}! That's just right. Pick up the peel!`); hop(); }
    else if (n === want) { const id = st.missing.find(i => !st.extra.includes(i)) ?? st.missing[0]; say(id ? `${cap(word(n))}! Now ${word(order.toppings[id])} ${named(id, order.toppings[id])}.` : cap(word(n))); }
    else say(cap(word(n)));
  }
  updateTicket(); updateTray();
}
function removeTopping(i) {
  const [t] = P.toppings.splice(i, 1);
  const g = pizzaAt();
  if (g) puffs.push({ x: g.x + t.x * g.R * .84, y: g.y + t.y * g.R * .84, r: g.R * .1, t: performance.now() });
  sfx.pop();
  if (order && orderStatus(order, P.toppings).done) say("That's just right. Pick up the peel!");
  updateTicket(); updateTray();
}
function notReady() {
  const st = orderStatus(order, P.toppings);
  if (st.extra.length) return `Not yet! Too many ${named(st.extra[0], 2)}.`;
  const id = st.missing[0], need = order.toppings[id] - (countToppings(P.toppings)[id] || 0);
  return `Not yet! It needs ${word(need)} more ${named(id, need)}.`;
}

// ---------- step 4: into the oven with the peel ----------
function usePeel(at, onPizza) {
  if (P.where === "board") {
    if (P.step !== "top") return say("Make the pizza first!");
    if (!onPizza) return say("Slide the peel under the pizza!");
    if (!readyToBake()) return say(notReady());
    P.where = "peel";
    renderHeld();
    sfx.whoosh();
    setStep("bake");
    return say("Now tap the oven to slide it in!");
  }
  if (P.where === "peel") {
    if (P.bake < 1) {
      if (at !== "oven") return say("Put it in the oven!");
      P.where = "oven";
      putAway(true);
      sfx.whoosh();
      updateTray();
      return say("Into the oven! Add wood to make the fire hot.");
    }
    if (at !== "cut") return say("Put it on the cutting board!");
    P.where = "counter";
    putAway(true);
    sfx.plop();
    return setStep("cut");
  }
  if (P.where === "oven") {
    if (at !== "oven") return say("The pizza is in the oven!");
    if (P.bake < 1) return say("Not ready yet! Add some wood to make it hotter.");
    P.where = "peel";
    renderHeld();
    sfx.whoosh();
    updateTray();
    say("Now put it on the cutting board!");
  }
}
function throwLog() {
  putAway(true);
  P.heat = addLog(P.heat);
  sfx.crackle();
  for (let i = 0; i < 26; i++) sparks.push({ x: .5 + (Math.random() - .5) * .16, y: .63, vx: (Math.random() - .5) * .25, vy: -.2 - Math.random() * .45, life: 1 });
  updateTray();
  if (P.where !== "oven") say("The fire is getting hot!");
}
function bakeFrame(dt) {
  if (P.where === "oven" && P.bake < 1) {
    P.bake = bakeTick(P.bake, P.heat, dt);
    if (P.bake >= 1) { sfx.ding(); hop("wiggle"); say("Ding! It's ready. Use the peel to take it out."); updateTray(); }
  }
  P.heat = coolTick(P.heat, dt);
  sparks = sparks.filter(sp => (sp.life -= dt * 1.4) > 0);
  for (const sp of sparks) { sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += .3 * dt; }
  const m = P.step === "bake" && tray.querySelector(".meter");
  if (m) { m.querySelector(".meter-fill").style.width = P.bake * 100 + "%"; m.setAttribute("aria-valuenow", Math.round(P.bake * 100)); }
}

// ---------- step 5: cut, box and serve ----------
// Each cut runs through the middle, towards where you tapped.
function cutOnce(dx, dy) {
  if (P.step !== "cut" || busy || cutAnim || P.cuts.length >= 4) return;
  const k = cutFor(dx, dy, P.cuts);
  const base = k * Math.PI / 4;
  const a = Math.cos(Math.atan2(dy, dx) - base) < 0 ? base : base + Math.PI;
  sfx.slice();
  const done = () => {
    P.cuts.push(k);
    if (P.cuts.length >= 4) finishStep("box", 700);
    else say(`${cap(word(P.cuts.length * 2))} slices`);
  };
  if (reduce) return done();
  cutAnim = { a, p: 0, t0: performance.now(), ms: 420, done };
}
function pickUpPizza(x, y) {
  P.where = "hand";
  hold("pizza", null, x, y);
  sfx.pop();
}
function setDownPizza() {
  putAway(true);
  P.where = "counter";
  sfx.plop();
  updateTray();
}
function boxIt() {
  putAway(true);
  P.where = "box";
  P.lidTo = 1;
  sfx.plop();
  setTimeout(() => hiss(.15, 300, "lowpass", .4), reduce ? 0 : 450);
  finishStep("serve", 900);
}
function pickUpBox(x, y) {
  P.box = "hand";
  hold("box", null, x, y);
  sfx.pop();
}
function setDownBox() {
  putAway(true);
  P.box = "counter";
  sfx.plop();
  updateTray();
}
function serve() {
  putAway(true);
  P.box = "counter";
  P.lidTo = 0;
  eat();
}
function eat() {
  setStep("eat");
  busy = true;
  const order8 = [0, 4, 2, 6, 1, 5, 3, 7];
  let i = 0;
  const bite = () => {
    P.eaten[order8[i++]] = true;
    sfx.nom();
    renderCreature(i % 2 ? "chomp" : "happy");
    if (i < 8) setTimeout(bite, reduce ? 60 : 380);
    else setTimeout(served1, reduce ? 100 : 400);
  };
  renderCreature("chomp");
  say("Yum yum!");
  setTimeout(bite, reduce ? 0 : 700);
}
function served1() {
  served.push({ ...customer });
  renderCreature("happy");
  hop();
  renderShelf();
  sfx.yay();
  say(pick(["Yum! Thank you!", "Delicious! Thank you!", "Yummy yummy! Thank you!"]));
  confetti();
  setTimeout(() => (served.length % 5 === 0 ? party(nextCustomer) : nextCustomer()), reduce ? 400 : 2600);
}
function startPizza() {
  P = freshPizza();
  putAway(true);
  cutAnim = null; rollAnim = null; pinY = null; sparks = [];
  clearSauce(sauceCv);
  lastSig = null;
}
function nextCustomer(quiet) {
  customer = newCustomer(customer);
  order = mode === "orders" ? makeOrder(served.length) : null;
  startPizza();
  renderCreature();
  hop("arrive");
  renderTicket();
  setStep("roll");
  if (!quiet) greet();
}
function greet() {
  if (order) say(`Hello! Can I have a pizza with ${orderText(order)}, please? First, roll the dough!`);
  else say("Hello! Make me any pizza you like. First, roll the dough!");
}

// ---------- pizza party: every fifth monster ----------
function party(done) {
  const guests = served.slice(-5);
  const ov = document.createElement("div");
  ov.className = "party";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-label", "Pizza party");
  ov.innerHTML = `<div class="banner">Pizza Party!</div>
    <div class="guests">${guests.map((g, i) => `<div class="guest" style="--d:${i * .09}s">${monsterSVG(g.kind, g.colour, "happy")}</div>`).join("")}</div>
    <div class="table"><canvas aria-hidden="true"></canvas></div>
    <button class="end-party" aria-label="End the party"><svg viewBox="0 0 20 20" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M4 4l12 12M16 4L4 16"/></svg></button>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add("on"));
  // one giant pizza with a bit of everything
  const pc = ov.querySelector("canvas"), size = Math.min(innerWidth * .7, innerHeight * .36, 360);
  const pd = Math.min(devicePixelRatio || 1, 2);
  pc.width = pc.height = size * pd; pc.style.width = pc.style.height = size + "px";
  const px = pc.getContext("2d"); px.setTransform(pd, 0, 0, pd, 0, 0);
  const big = { roll: 1, sauceFill: "tomato", bake: 1, cuts: [0, 1, 2, 3], cheese: [], toppings: [] };
  for (let i = 0; i < 160; i++) { const a = Math.random() * 7, d = .95 * Math.sqrt(Math.random()); big.cheese.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, a, l: .08, spot: Math.random() < .14 }); }
  for (let i = 0; i < 16; i++) big.toppings.push({ id: TOPPINGS[i % TOPPINGS.length].id, ...spotFor(big.toppings), rot: Math.random() * 6 });
  drawPizza(px, size / 2, size / 2, size * .46, big);
  say("Pizza party!");
  const len = jingle();
  const bursts = setInterval(confetti, 1300); confetti();
  let over = false;
  const finish = () => {
    if (over) return; over = true;
    clearInterval(bursts); clearTimeout(timer); stopJingle?.();
    ov.classList.remove("on");
    setTimeout(() => { ov.remove(); done(); }, 600);
  };
  const timer = setTimeout(finish, len * 1000 + 1200);
  ov.querySelector(".end-party").onclick = finish;
}

// A bouncy tarantella-style tune, written for this game.
let stopJingle = null;
function jingle() {
  const a = audio(), e = 60 / 140 / 3 * 1.0; // eighth notes in 6/8
  const A = [69, 72, 76, 81, 76, 72, 71, 74, 76, 80, 76, 74, 69, 72, 76, 81, 83, 84, 83, 81, 80, 81, 81, 81];
  const B = [76, 76, 77, 79, 77, 76, 74, 74, 76, 77, 76, 74, 72, 72, 74, 76, 74, 72, 71, 76, 80, 81, 81, 81];
  const tune = [...A, ...B];
  const bass = [45, 52, 40, 52, 45, 52, 40, 45, 48, 52, 50, 50, 45, 52, 40, 45];
  if (!a || muted) return tune.length * e;
  const out = a.createGain(); out.gain.value = .9; out.connect(a.destination);
  const t0 = a.currentTime + .3;
  const play = (m, t, dur, type, peak) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = 440 * 2 ** ((m - 69) / 12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + .05);
  };
  tune.forEach((m, i) => {
    const held = (i % 24) >= 21;
    if (held && i % 24 > 21) return;
    play(m, t0 + i * e, held ? e * 2.8 : e * .85, "square", .05);
    play(m + 12, t0 + i * e, held ? e * 2.8 : e * .8, "sine", .04);
  });
  bass.forEach((m, i) => { play(m, t0 + i * e * 3, e * 1.4, "triangle", .3); play(m + 12, t0 + i * e * 3 + e * 1.5, e, "triangle", .12); });
  stopJingle = () => { out.gain.setTargetAtTime(0, a.currentTime, .05); setTimeout(() => out.disconnect(), 300); stopJingle = null; };
  return tune.length * e + .3;
}

// ---------- confetti ----------
const cc = $("confetti"), cx2 = cc.getContext("2d");
let bits = [], confettiOn = false;
function confetti() {
  if (reduce) return;
  cc.width = innerWidth; cc.height = innerHeight;
  const r = cv.getBoundingClientRect();
  const cols = ["#d8392b", "#ffc83d", "#5a9e35", customer.colour, "#7cc6ff"];
  for (let i = 0; i < 90; i++) {
    bits.push({
      x: r.left + r.width / 2, y: r.top + r.height / 2,
      vx: (Math.random() - .5) * 14, vy: -Math.random() * 14 - 4,
      s: 6 + Math.random() * 10, c: cols[i % cols.length], a: Math.random() * 6, va: (Math.random() - .5) * .3,
      round: Math.random() < .5,
    });
  }
  if (!confettiOn) { confettiOn = true; requestAnimationFrame(tickConfetti); }
}
function tickConfetti() {
  cx2.clearRect(0, 0, cc.width, cc.height);
  bits = bits.filter(b => b.y < cc.height + 40);
  for (const b of bits) {
    b.vy += .38; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.a += b.va;
    cx2.save(); cx2.translate(b.x, b.y); cx2.rotate(b.a); cx2.fillStyle = b.c;
    cx2.strokeStyle = INK; cx2.lineWidth = 2;
    if (b.round) { cx2.beginPath(); cx2.arc(0, 0, b.s / 2, 0, 7); cx2.fill(); cx2.stroke(); }
    else { cx2.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); cx2.strokeRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); }
    cx2.restore();
  }
  if (bits.length) requestAnimationFrame(tickConfetti); else { confettiOn = false; cx2.clearRect(0, 0, cc.width, cc.height); }
}


// ---------- wiring ----------
creatureEl.addEventListener("click", () => {
  audio();
  if (held?.kind === "box") return serve();
  hop("wiggle");
  greet();
});
function setMode(m) {
  if (m === mode) return;
  mode = m;
  $("mode-orders").setAttribute("aria-pressed", m === "orders");
  $("mode-free").setAttribute("aria-pressed", m === "free");
  nextCustomer();
}
$("mode-orders").onclick = () => setMode("orders");
$("mode-free").onclick = () => setMode("free");
$("restart").onclick = () => {
  if (P.step === "eat") return;
  audio();
  startPizza();
  updateTicket();
  setStep("roll");
  say("Let's start again. Roll the dough!");
};
$("mute").onclick = () => {
  muted = !muted;
  $("wave").style.display = muted ? "none" : "";
  $("mute").setAttribute("aria-label", muted ? "Sound off" : "Sound on");
  if (muted) { try { speechSynthesis.cancel(); } catch {} stopJingle?.(); }
};

fit();
renderCreature();
renderTicket();
renderShelf();
setStep("roll");
requestAnimationFrame(frame);
