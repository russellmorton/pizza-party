import {
  TOPPINGS, TOPPING, SAUCES, MAX_TOPPINGS, SAUCE_DONE, CHEESE_DONE, ROLL_DRAG,
  makeOrder, orderText, countToppings, orderStatus, spotFor, hitTopping,
  makeCoverage, dab, coverage, gaps, doughSize, bakeTick, coolTick, addLog, word, named,
} from "./pizza.js";
import { TOPPING_SIZE, drawBoard, drawPin, drawPizza, drawTopping, drawOven, OVEN_FLOOR, sizeSauce, paintDabs, clearSauce } from "./draw.js";
import { monsterSVG, MONSTER_COLOURS, KINDS, INK } from "./monster.js";

const $ = id => document.getElementById(id);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pick = a => a[Math.random() * a.length | 0];
const cap = s => s[0].toUpperCase() + s.slice(1);

// ---------- state ----------
// Steps: roll → sauce → cheese → top → bake → cut → eat. The step chips group them in five.
const CHIP = { roll: 0, sauce: 1, cheese: 1, top: 2, bake: 3, cut: 4, eat: 4 };
let mode = "orders", muted = false;
let served = [];
let customer = newCustomer(), order = makeOrder(0);
let P = freshPizza();
let busy = false;      // a step is finishing and will move on by itself
let inFlight = 0;      // toppings flying to the pizza

function freshPizza() {
  return { step: "roll", roll: 0, sauce: null, dabs: [], cov: makeCoverage(), cheese: [], toppings: [], bake: 0, heat: 0, cuts: 0, eaten: Array(8).fill(false), selected: null };
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
const rollSound = every(sfx.roll, 160), squishSound = every(sfx.squish, 110), sprinkleSound = every(sfx.sprinkle, 120);

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
  cutter: `<svg viewBox="0 0 64 64"><g stroke="${INK}" stroke-width="3" stroke-linecap="round"><path d="M30 34 L54 8" stroke-width="10"/><path d="M30 34 L54 8" stroke="#ff5a5f" stroke-width="5"/><circle cx="24" cy="40" r="18" fill="#dfe3ec"/><circle cx="24" cy="40" r="4" fill="${INK}"/></g></svg>`,
};

// Paints a topping into a small <canvas>, for the bins, the order ticket and flying pieces.
function toppingCanvas(cv, id, cssSize, scale = .38) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = cv.height = Math.round(cssSize * dpr);
  cv.style.width = cv.style.height = cssSize + "px";
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTopping(c, id, cssSize / 2, cssSize / 2, cssSize * scale, id === "basil" ? -.5 : 0);
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

// ---------- step chips + tray ----------
const tray = $("tray");
function renderSteps() {
  document.querySelectorAll("#steps li").forEach((li, i) => {
    li.classList.toggle("now", i === CHIP[P.step]);
    li.classList.toggle("done", i < CHIP[P.step]);
    if (i === CHIP[P.step]) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
}
const tool = (id, label, icon, cls = "") => `<button class="tool ${cls}" id="tool-${id}" aria-label="${label}"><span class="ico">${icon}</span><span class="lbl">${label}</span></button>`;
function renderTray() {
  const st = P.step;
  let h = "";
  if (st === "roll") h = tool("roll", "Roll", ICON.pin, "pulse");
  else if (st === "sauce") h = Object.entries(SAUCES).map(([k, s]) => tool(`sauce-${k}`, `${cap(s.name)} sauce`, ICON.ladle(s.css), order?.sauce === k ? "pulse" : "")).join("");
  else if (st === "cheese") h = tool("cheese", "Cheese", ICON.cheese, "pulse");
  else if (st === "top") h = `<div class="bins">${TOPPINGS.map(t => `<button class="tool bin" data-id="${t.id}" aria-label="${cap(t.many)}"><span class="ico"><canvas aria-hidden="true"></canvas></span><span class="lbl">${cap(t.one)}</span></button>`).join("")}</div>`
    + `<div class="actions">${tool("undo", "Take one off", ICON.undo, "small")}${tool("bake", "Bake it!", ICON.oven, "go pulse")}</div>`;
  else if (st === "bake") h = tool("log", "Add wood", ICON.log, "pulse") + `<div class="meter" role="progressbar" aria-label="Baking" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="meter-fill"></div><span class="meter-pizza">${ICON.oven}</span></div>`;
  else if (st === "cut") h = tool("cut", "Cut", ICON.cutter, "pulse");
  tray.innerHTML = h;
  tray.dataset.step = st;
  tray.querySelectorAll(".bin").forEach(b => {
    toppingCanvas(b.querySelector("canvas"), b.dataset.id, 46);
    b.addEventListener("click", () => tapBin(b.dataset.id, b));
  });
  const on = (id, fn) => { const el = $(`tool-${id}`); if (el) el.addEventListener("click", () => { audio(); fn(el); }); };
  on("roll", rollButton);
  for (const k of Object.keys(SAUCES)) on(`sauce-${k}`, () => ladle(k));
  on("cheese", grate);
  on("undo", () => P.toppings.length && removeTopping(P.toppings.length - 1));
  on("bake", startBake);
  on("log", stoke);
  on("cut", () => cutOnce());
  updateTray();
}
function updateTray() {
  if (P.step === "sauce") for (const k of Object.keys(SAUCES)) $(`tool-sauce-${k}`)?.setAttribute("aria-pressed", P.sauce === k);
  if (P.step === "top") {
    $("tool-bake").hidden = !readyToBake();
    $("tool-undo").disabled = !P.toppings.length;
    tray.querySelectorAll(".bin").forEach(b => b.setAttribute("aria-pressed", P.selected === b.dataset.id));
  }
}
const readyToBake = () => !order || orderStatus(order, P.toppings).done;

const workLabel = {
  roll: "A ball of dough on the board. Roll it flat.",
  sauce: "Pizza dough. Spread the sauce.",
  cheese: "Pizza with sauce. Sprinkle the cheese.",
  top: "Pizza with cheese. Tap a topping, then tap the pizza.",
  bake: "The pizza is in the oven.",
  cut: "A baked pizza. Cut it into slices.",
  eat: "The monster is eating the pizza.",
};
function setStep(step) {
  P.step = step;
  busy = false;
  renderSteps();
  renderTray();
  cv.setAttribute("aria-label", workLabel[step]);
  if (step === "sauce") say("Nice and flat! Now spread the sauce.");
  if (step === "cheese") say("Now sprinkle on the cheese!");
  if (step === "top") say(order ? `Now the toppings! ${cap(orderText(order))}.` : "Now add your toppings! Tap the oven when it's ready.");
  if (step === "bake") say("Into the oven! Add wood to make the fire hot.");
  if (step === "cut") say("Ding! It's ready. Cut it into slices.");
}
function finishStep(next, delay = 800) {
  if (busy) return;
  busy = true;
  sfx.done();
  setTimeout(() => setStep(next), reduce ? 150 : delay);
}

// ---------- the work area ----------
const wrap = $("work"), cv = $("work-canvas"), ctx = cv.getContext("2d");
const sauceCv = document.createElement("canvas");
let s = 300, dpr = 1;
function fit() {
  const r = wrap.getBoundingClientRect();
  s = Math.max(120, Math.floor(Math.min(r.width, r.height)));
  dpr = Math.min(devicePixelRatio || 1, 2);
  cv.style.width = cv.style.height = s + "px";
  cv.width = cv.height = Math.round(s * dpr);
  sizeSauce(sauceCv, sauceR(), dpr);
  if (P.sauce) paintDabs(sauceCv, P.dabs, P.sauce);
}
new ResizeObserver(fit).observe(wrap);

const boardR = () => s * .47;
const pizzaR = () => boardR() * .92;              // fully rolled
const sauceR = () => pizzaR() * .84;
// Pointer position on the pizza, in sauce-radius units.
function toU(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left - s / 2) / sauceR(), y: (e.clientY - r.top - s / 2) / sauceR() };
}

// animation bits that aren't part of the pizza itself
let pinY = null, rollAnim = null, cutAnim = null, oven = null, sparks = [], puffs = [];

let last = performance.now();
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, s, s);
  const c = s / 2;

  if (rollAnim) {
    const p = Math.min(1, (now - rollAnim.t0) / rollAnim.ms);
    const R = pizzaR() * doughSize(P.roll);
    pinY = c - R * .9 + R * 1.8 * p;
    P.roll = rollAnim.from + (rollAnim.to - rollAnim.from) * p;
    if (p >= 1) { rollAnim = null; pinY = null; afterRoll(); }
  }
  if (cutAnim) {
    cutAnim.p = Math.min(1, (now - cutAnim.t0) / cutAnim.ms);
    if (cutAnim.p >= 1) { const done = cutAnim.done; cutAnim = null; done(); }
  }

  if (P.step === "bake" && oven) {
    bakeFrame(now, dt);
  } else {
    drawBoard(ctx, c, c, boardR());
    const R = pizzaR() * doughSize(P.roll);
    drawPizza(ctx, c, c, R, { ...P, sauceImg: sauceCv, cutAnim });
    if (P.step === "roll") drawPin(ctx, c, pinY ?? c + R * .55, boardR() * 1.5);
  }
  // little puffs where toppings were taken off
  puffs = puffs.filter(p => now - p.t < 400);
  for (const p of puffs) {
    const k = (now - p.t) / 400;
    ctx.strokeStyle = `rgba(255,255,255,${1 - k})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(c + p.x * sauceR(), c + p.y * sauceR(), sauceR() * (.1 + .15 * k), 0, Math.PI * 2); ctx.stroke();
  }
  requestAnimationFrame(frame);
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
  updateTray(); updateTicket();
}
function addDab(x, y, r = .2) {
  if (Math.hypot(x, y) > 1.15) return;
  if (!P.sauce) chooseSauce(order?.sauce || "tomato");
  const sp = Array.from({ length: 2 }, () => [(Math.random() - .5) * r, (Math.random() - .5) * r, r * (.06 + Math.random() * .06)]);
  const d = { x, y, r, sp };
  P.dabs.push(d);
  paintDabs(sauceCv, [d], P.sauce);
  dab(P.cov, x, y, r);
}
function ladle(k) {
  if (P.step !== "sauce" || busy) return;
  chooseSauce(k);
  const open = gaps(P.cov);
  const at = P.dabs.length ? pick(open.length ? open : P.cov.cells) : { x: 0, y: 0 };
  sfx.squish();
  // a swirl of sauce around where the ladle lands
  const pts = [[0, 0], ...Array.from({ length: 7 }, (_, i) => [Math.cos(i * .9) * .08 * (i + 1), Math.sin(i * .9) * .08 * (i + 1)])];
  pts.forEach(([dx, dy], i) => setTimeout(() => { addDab(at.x + dx, at.y + dy, .22); if (i === pts.length - 1) checkSauce(); }, reduce ? 0 : i * 35));
}
function checkSauce() {
  updateTicket();
  if (P.step !== "sauce" || busy || coverage(P.cov) < SAUCE_DONE) return;
  if (order && P.sauce !== order.sauce) {
    if (P.wrongSaid !== P.sauce) {
      P.wrongSaid = P.sauce;
      const want = SAUCES[order.sauce];
      say(`Hmm, this monster wants ${want.name} sauce. Tap the ${want.colour} sauce.`);
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
function grate() {
  if (P.step !== "cheese" || busy) return;
  for (let i = 0; i < 10; i++) setTimeout(() => { if (P.step === "cheese") { sprinkle(0, 0, 6, 1); sfx.sprinkle(); } }, reduce ? 0 : i * 40);
}

// ---------- step 3: toppings ----------
function tapBin(id, bin) {
  audio();
  if (P.step !== "top" || busy) return;
  P.selected = id;
  updateTray();
  placeTopping(id, spotFor(P.toppings), bin);
}
function placeTopping(id, spot, fromEl) {
  if (P.toppings.length + inFlight >= MAX_TOPPINGS) {
    sfx.full();
    say("The pizza is full!");
    return;
  }
  const t = { id, x: spot.x, y: spot.y, rot: Math.random() * Math.PI * 2 };
  if (reduce || !fromEl) return landTopping(t);
  inFlight++;
  const r = sauceR() * TOPPING_SIZE, size = Math.ceil(r * 2.6);
  const el = document.createElement("canvas");
  el.className = "flyer";
  toppingCanvas(el, id, size, .38);
  el.style.margin = `${-size / 2}px 0 0 ${-size / 2}px`;
  document.body.appendChild(el);
  const a = fromEl.getBoundingClientRect(), b = cv.getBoundingClientRect();
  const x0 = a.left + a.width / 2, y0 = a.top + a.height / 2;
  const x1 = b.left + s / 2 + t.x * sauceR(), y1 = b.top + s / 2 + t.y * sauceR();
  const xm = (x0 + x1) / 2, ym = Math.min(y0, y1) - 70;
  el.animate([
    { transform: `translate(${x0}px,${y0}px) scale(.7) rotate(0)` },
    { transform: `translate(${xm}px,${ym}px) scale(1.25) rotate(${t.rot / 2}rad)`, offset: .45 },
    { transform: `translate(${x1}px,${y1}px) scale(1) rotate(${t.rot}rad)` },
  ], { duration: 480, easing: "cubic-bezier(.3,.1,.6,1)" }).onfinish = () => { el.remove(); inFlight--; landTopping(t); };
}
function landTopping(t) {
  if (P.step !== "top") return;
  P.toppings.push(t);
  sfx.plop();
  const n = countToppings(P.toppings)[t.id];
  if (!order) say(`${word(n)} ${named(t.id, n)}`);
  else {
    const st = orderStatus(order, P.toppings), want = order.toppings[t.id];
    if (!want) say(`Oh no, no ${named(t.id, 2)} for this monster! Tap it to take it off.`);
    else if (n > want) say(`Oops, too many ${named(t.id, 2)}! Tap one to take it off.`);
    else if (st.done) { say(`${cap(word(n))}! That's just right. Into the oven!`); hop(); }
    else if (n === want) { const id = st.missing.find(i => !st.extra.includes(i)) ?? st.missing[0]; say(id ? `${cap(word(n))}! Now ${word(order.toppings[id])} ${named(id, order.toppings[id])}.` : cap(word(n))); }
    else say(cap(word(n)));
  }
  updateTicket(); updateTray();
}
function removeTopping(i) {
  const [t] = P.toppings.splice(i, 1);
  puffs.push({ x: t.x, y: t.y, t: performance.now() });
  sfx.pop();
  if (order && orderStatus(order, P.toppings).done) say("That's just right. Into the oven!");
  updateTicket(); updateTray();
}

// ---------- step 4: bake ----------
const OVEN_IN = 1000, OVEN_OUT = 900;
function startBake() {
  if (P.step !== "top" || busy || !readyToBake() || inFlight) return;
  P.selected = null;
  oven = { phase: "in", t0: performance.now() };
  sfx.whoosh();
  setStep("bake");
}
function stoke() {
  if (P.step !== "bake" || !oven || oven.phase === "out" || oven.phase === "ding") return;
  P.heat = addLog(P.heat);
  sfx.crackle();
  for (let i = 0; i < 26; i++) sparks.push({ x: .5 + (Math.random() - .5) * .16, y: .63, vx: (Math.random() - .5) * .25, vy: -.2 - Math.random() * .45, life: 1 });
}
function bakeFrame(now, dt) {
  const t = now / 1000, el = now - oven.t0, c = s / 2;
  let k = 1; // 0 = on the board, 1 = in the oven
  if (oven.phase === "in") { k = reduce ? 1 : Math.min(1, el / OVEN_IN); if (k >= 1) oven = { phase: "bake", t0: now }; }
  if (oven.phase === "bake") {
    P.bake = bakeTick(P.bake, P.heat, dt);
    P.heat = coolTick(P.heat, dt);
    const m = tray.querySelector(".meter");
    if (m) { m.querySelector(".meter-fill").style.width = P.bake * 100 + "%"; m.setAttribute("aria-valuenow", Math.round(P.bake * 100)); }
    if (P.bake >= 1) { oven = { phase: "ding", t0: now }; sfx.ding(); hop("wiggle"); }
  }
  if (oven.phase === "ding" && el > (reduce ? 200 : 900)) { oven = { phase: "out", t0: now }; sfx.whoosh(); }
  if (oven.phase === "out") {
    k = reduce ? 0 : 1 - Math.min(1, el / OVEN_OUT);
    if (k <= 0) { oven = null; setStep("cut"); }
  }
  sparks = sparks.filter(sp => (sp.life -= dt * 1.4) > 0);
  for (const sp of sparks) { sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.vy += .3 * dt; }
  // the oven fades in over the board as the pizza slides in
  const ease = k * k * (3 - 2 * k);
  if (ease < 1) { ctx.globalAlpha = 1 - ease; drawBoard(ctx, c, c, boardR()); }
  ctx.globalAlpha = Math.min(1, ease * 1.6);
  drawOven(ctx, s, t, P.heat, sparks);
  ctx.globalAlpha = 1;
  const y = c + (s * OVEN_FLOOR.y - c) * ease;
  const R = pizzaR() + (s * OVEN_FLOOR.r - pizzaR()) * ease;
  const sq = 1 + (OVEN_FLOOR.squash - 1) * ease;
  ctx.save();
  ctx.translate(c, y); ctx.scale(1, sq); ctx.translate(-c, -y);
  drawPizza(ctx, c, y, R, { ...P, sauceImg: sauceCv });
  ctx.restore();
  if (oven?.phase === "ding") {
    ctx.fillStyle = "#fff6c9"; ctx.strokeStyle = INK; ctx.lineWidth = 4;
    ctx.font = `800 ${s * .12}px "Baloo 2", system-ui, sans-serif`; ctx.textAlign = "center";
    ctx.strokeText("Ding!", c, s * .32); ctx.fillText("Ding!", c, s * .32);
  }
}

// ---------- step 5: cut and eat ----------
function cutOnce() {
  if (P.step !== "cut" || busy || cutAnim || P.cuts >= 4) return;
  sfx.slice();
  const done = () => {
    P.cuts++;
    if (P.cuts >= 4) { busy = true; say("Eight slices! Yum!"); setTimeout(eat, reduce ? 200 : 700); }
    else say(`${cap(word(P.cuts * 2))} slices`);
  };
  if (reduce) return done();
  cutAnim = { k: P.cuts, p: 0, t0: performance.now(), ms: 420, done };
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
  setTimeout(bite, reduce ? 0 : 500);
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
function nextCustomer(quiet) {
  customer = newCustomer(customer);
  order = mode === "orders" ? makeOrder(served.length) : null;
  P = freshPizza();
  oven = null; cutAnim = null; rollAnim = null; pinY = null; sparks = [];
  clearSauce(sauceCv);
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

// ---------- pointer play on the pizza ----------
let drag = null;
cv.addEventListener("pointerdown", e => {
  audio();
  cv.setPointerCapture(e.pointerId);
  const r = cv.getBoundingClientRect();
  drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, u: toU(e), moved: 0 };
  if (P.step === "roll") pinY = e.clientY - r.top;
  if (P.step === "sauce" && !busy) { addDab(drag.u.x, drag.u.y); squishSound(); checkSauce(); }
  if (P.step === "cheese" && !busy) { sprinkle(drag.u.x, drag.u.y, 8, .2); sprinkleSound(); }
});
cv.addEventListener("pointermove", e => {
  if (!drag) return;
  const r = cv.getBoundingClientRect();
  const d = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
  drag.moved += d; drag.x = e.clientX; drag.y = e.clientY;
  const u = toU(e);
  if (P.step === "roll" && !rollAnim) {
    pinY = Math.max(s * .1, Math.min(s * .9, e.clientY - r.top));
    if (d > 0) { rollBy(d / (s * ROLL_DRAG)); rollSound(); }
  }
  if (P.step === "sauce" && !busy) {
    // fill in along the stroke so fast swipes still leave a trail
    const steps = Math.ceil(Math.hypot(u.x - drag.u.x, u.y - drag.u.y) / .08);
    for (let i = 1; i <= steps; i++) addDab(drag.u.x + (u.x - drag.u.x) * i / steps, drag.u.y + (u.y - drag.u.y) * i / steps);
    if (steps) { squishSound(); checkSauce(); }
  }
  if (P.step === "cheese" && !busy && d > 4) { sprinkle(u.x, u.y, 3, .18); sprinkleSound(); }
  drag.u = u;
});
const endDrag = e => {
  if (!drag) return;
  const u = toU(e), tap = drag.moved < 10;
  if (P.step === "roll") pinY = null;
  if (P.step === "top" && tap && !busy) {
    const i = hitTopping(P.toppings, u.x, u.y);
    if (i >= 0) removeTopping(i);
    else if (Math.hypot(u.x, u.y) < .92) {
      if (P.selected) placeTopping(P.selected, u, null);
      else say("Tap a topping down below first!");
    }
  }
  // a swipe right across the pizza cuts it
  if (P.step === "cut" && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > pizzaR()) cutOnce();
  drag = null;
};
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", () => { drag = null; pinY = null; });

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
  const big = { roll: 1, sauceFill: "tomato", bake: 1, cuts: 4, cheese: [], toppings: [] };
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
creatureEl.addEventListener("click", () => { audio(); hop("wiggle"); greet(); });
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
  P = freshPizza();
  oven = null; cutAnim = null; rollAnim = null; pinY = null; busy = false;
  clearSauce(sauceCv);
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
