// Canvas drawing: the board, rolling pin, pizza, toppings and the oven.
import { sauceLook, lumpiness } from "./pizza.js";

export const INK = "#26314a";
export const TOPPING_SIZE = .17; // topping radius, as a share of the sauce radius
const TAU = Math.PI * 2;

// Mixes two #rrggbb colours.
export function blend(a, b, t) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`;
}

// A small seeded random generator, so the flour and the lumps stay put between frames.
function seeded(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}

export function drawBoard(ctx, cx, cy, B) {
  ctx.save();
  ctx.fillStyle = "rgba(38,49,74,.16)";
  ctx.beginPath(); ctx.arc(cx, cy + B * .05, B, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - B * .3, cy - B * .3, B * .1, cx, cy, B);
  g.addColorStop(0, "#efc086"); g.addColorStop(1, "#d39858");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, B, 0, TAU); ctx.fill();
  ctx.lineWidth = Math.max(3, B * .025); ctx.strokeStyle = INK; ctx.stroke();
  // wood grain
  ctx.clip();
  ctx.strokeStyle = "rgba(140,80,30,.18)"; ctx.lineWidth = Math.max(1.5, B * .012);
  for (let i = -4; i <= 4; i++) {
    const y = cy + i * B * .21;
    ctx.beginPath(); ctx.moveTo(cx - B, y);
    ctx.bezierCurveTo(cx - B * .4, y + B * .06 * (i % 2 ? 1 : -1), cx + B * .3, y - B * .05, cx + B, y + B * .03);
    ctx.stroke();
  }
  // a dusting of flour
  const r = seeded(7);
  ctx.fillStyle = "rgba(255,255,255,.55)";
  for (let i = 0; i < 70; i++) {
    const a = r() * TAU, d = B * Math.sqrt(r()) * .95;
    ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, B * (.006 + r() * .012), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawPin(ctx, cx, y, len) {
  const t = len * .1, h = len * .05;
  ctx.save();
  ctx.lineWidth = Math.max(2.5, len * .012); ctx.strokeStyle = INK; ctx.lineJoin = "round";
  ctx.fillStyle = "rgba(38,49,74,.12)";
  rounded(ctx, cx - len / 2 + t * 1.2, y + t * .45, len - 2.4 * t, t * .45, t * .22); ctx.fill();
  // handles
  ctx.fillStyle = "#b8743c";
  rounded(ctx, cx - len / 2, y - h / 2, t * 1.2, h, h / 2); ctx.fill(); ctx.stroke();
  rounded(ctx, cx + len / 2 - t * 1.2, y - h / 2, t * 1.2, h, h / 2); ctx.fill(); ctx.stroke();
  // roller
  const g = ctx.createLinearGradient(0, y - t / 2, 0, y + t / 2);
  g.addColorStop(0, "#f6d29c"); g.addColorStop(.5, "#e8b06c"); g.addColorStop(1, "#c98a46");
  ctx.fillStyle = g;
  rounded(ctx, cx - len / 2 + t, y - t / 2, len - 2 * t, t, t * .35); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = t * .14; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(cx - len / 2 + t * 1.5, y - t * .22); ctx.lineTo(cx + len / 2 - t * 1.5, y - t * .22); ctx.stroke();
  ctx.restore();
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

// Sauce lives on its own canvas so each dab is painted once, not every frame.
// Its pixels cover the sauce circle, with the circle's radius at `px`.
export function sizeSauce(cv, px, dpr) {
  cv.width = cv.height = Math.max(2, Math.round(px * 2 * dpr));
}
// Each dab carries its own sauce (d.k), so tomato and pesto can share a pizza.
export function paintDabs(cv, dabs) {
  const c = cv.getContext("2d"), h = cv.width / 2;
  c.save();
  c.setTransform(h, 0, 0, h, h, h);
  c.beginPath(); c.arc(0, 0, .985, 0, TAU); c.clip();
  for (const d of dabs) {
    const s = sauceLook(d.k, spooky);
    c.fillStyle = s.css;
    c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU); c.fill();
    c.fillStyle = s.dark; c.globalAlpha = .45;
    for (const [dx, dy, r] of d.sp) { c.beginPath(); c.arc(d.x + dx, d.y + dy, r, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }
  c.restore();
}
export function clearSauce(cv) { cv.getContext("2d").clearRect(0, 0, cv.width, cv.height); }

// Toppings, centred on (x, y) with radius r. `bake` runs 0..1.
// At Halloween every ingredient dresses up: the pepperoni is carved like a jack-o'-lantern, the
// mushrooms are little ghosts, the olives are spiders, the pepper rings are googly eyeballs, the
// pineapple is striped like candy corn and the basil leaves are bats. The tomato sauce is pumpkin,
// the pesto is slime, the cheese is cobwebs and the box has an orange stamp.
let spooky = false;
export function setSpooky(on) { spooky = on; }

export function drawTopping(ctx, id, x, y, r, rot = 0, bake = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const lw = Math.max(1.2, r * .14);
  switch (id) {
    case "pepperoni": {
      ctx.fillStyle = blend("#d9432c", "#a52c1a", bake);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = blend("#8e2414", "#5c160b", bake); ctx.lineWidth = lw; ctx.stroke();
      ctx.fillStyle = "rgba(120,20,10,.55)";
      for (const [dx, dy] of [[.38, -.2], [-.3, .32], [-.08, -.48], [.24, .42], [-.48, -.08], [.05, .05]]) {
        ctx.beginPath(); ctx.arc(dx * r, dy * r, r * .11, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = r * .12;
      ctx.beginPath(); ctx.arc(0, 0, r * .66, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
      if (spooky) {   // a jack-o'-lantern face, cut into the pepperoni
        ctx.fillStyle = blend("#ffd36a", "#f2b632", bake);
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .12, -r * .08); ctx.lineTo(s * r * .52, -r * .08); ctx.lineTo(s * r * .32, -r * .45); ctx.closePath(); ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(-r * .58, r * .18); ctx.quadraticCurveTo(0, r * .78, r * .58, r * .18); ctx.quadraticCurveTo(0, r * .42, -r * .58, r * .18); ctx.fill();
      }
      break;
    }
    case "mushroom": {
      ctx.translate(0, r * .1);
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.bezierCurveTo(-r, -r * 1.25, r, -r * 1.25, r, 0);
      ctx.quadraticCurveTo(r * .55, r * .12, r * .34, r * .1);
      ctx.lineTo(r * .3, r * .78);
      ctx.quadraticCurveTo(0, r * .92, -r * .3, r * .78);
      ctx.lineTo(-r * .34, r * .1);
      ctx.quadraticCurveTo(-r * .55, r * .12, -r, 0);
      ctx.closePath();
      if (spooky) {   // a ghost mushroom: pale, with a surprised face on the cap
        ctx.fillStyle = blend("#f7f5ff", "#e4dccb", bake); ctx.fill();
        ctx.strokeStyle = "#8f88a8"; ctx.lineWidth = lw; ctx.stroke();
        ctx.fillStyle = "#26314a";
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * .3, -r * .48, r * .11, r * .16, 0, 0, TAU); ctx.fill(); }
        ctx.beginPath(); ctx.ellipse(0, -r * .16, r * .12, r * .1, 0, 0, TAU); ctx.fill();
        break;
      }
      ctx.fillStyle = blend("#f2e3c6", "#d8b98a", bake); ctx.fill();
      ctx.strokeStyle = "#86613f"; ctx.lineWidth = lw; ctx.stroke();
      ctx.strokeStyle = "rgba(134,97,63,.45)"; ctx.lineWidth = lw * .7;
      ctx.beginPath(); ctx.moveTo(-r * .72, -r * .08); ctx.bezierCurveTo(-r * .7, -r * .82, r * .7, -r * .82, r * .72, -r * .08); ctx.stroke();
      break;
    }
    case "olive": {
      if (spooky) {   // an olive spider: half an olive for the body, the other half cut into legs
        ctx.strokeStyle = "#1e1b24"; ctx.lineWidth = r * .16;
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
          const kx = s * r * .95, ky = (i - 1.5) * r * .42;
          ctx.beginPath(); ctx.moveTo(s * r * .3, ky * .3); ctx.quadraticCurveTo(kx, ky - r * .45, s * r * 1.15, ky + r * .1); ctx.stroke();
        }
        ctx.fillStyle = "#2b2733"; ctx.beginPath(); ctx.ellipse(0, r * .08, r * .5, r * .44, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(0, -r * .42, r * .26, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff";
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * .11, -r * .45, r * .08, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = "rgba(255,255,255,.4)"; ctx.lineWidth = r * .08;
        ctx.beginPath(); ctx.arc(0, r * .08, r * .32, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
        break;
      }
      ctx.strokeStyle = "#1e1b24"; ctx.lineWidth = r * .62;
      ctx.beginPath(); ctx.arc(0, 0, r * .66, 0, TAU); ctx.stroke();
      ctx.strokeStyle = "#3b3746"; ctx.lineWidth = r * .4;
      ctx.beginPath(); ctx.arc(0, 0, r * .66, 0, TAU); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.45)"; ctx.lineWidth = r * .1;
      ctx.beginPath(); ctx.arc(0, 0, r * .7, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
      break;
    }
    case "pepper": {
      const ring = () => {
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const a = i / 60 * TAU, rr = r * (.8 + .13 * Math.cos(a * 3));
          i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
      };
      if (spooky) {   // a googly eyeball looking out of the pepper ring
        ctx.fillStyle = "#fffdf4"; ctx.beginPath(); ctx.arc(0, 0, r * .72, 0, TAU); ctx.fill();
        ctx.fillStyle = "#26314a"; ctx.beginPath(); ctx.arc(r * .16, r * .12, r * .3, 0, TAU); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(r * .06, r * .02, r * .09, 0, TAU); ctx.fill();
      }
      ring(); ctx.strokeStyle = "#235f22"; ctx.lineWidth = r * .42; ctx.stroke();
      ring(); ctx.strokeStyle = blend("#46a83f", "#3a8a34", bake); ctx.lineWidth = r * .26; ctx.stroke();
      break;
    }
    case "pineapple": {
      ctx.beginPath();
      ctx.moveTo(-r * .95, -r * .55); ctx.lineTo(r * .95, -r * .55);
      ctx.lineTo(r * .42, r * .62); ctx.lineTo(-r * .42, r * .62); ctx.closePath();
      ctx.fillStyle = blend("#ffd84a", "#f2b632", bake); ctx.fill();
      if (spooky) {   // striped like candy corn: yellow, then orange, then a white tip
        ctx.save(); ctx.clip();
        ctx.fillStyle = blend("#ff8c1a", "#e0661a", bake); ctx.fillRect(-r, -r * .2, r * 2, r);
        ctx.fillStyle = blend("#fffdf4", "#f6e7c8", bake); ctx.fillRect(-r, r * .3, r * 2, r);
        ctx.restore();
        ctx.strokeStyle = "#b9851a"; ctx.lineWidth = lw; ctx.stroke();
        break;
      }
      ctx.strokeStyle = "#b9851a"; ctx.lineWidth = lw; ctx.stroke();
      ctx.strokeStyle = "rgba(185,133,26,.5)"; ctx.lineWidth = lw * .6;
      for (const t of [-.4, 0, .4]) { ctx.beginPath(); ctx.moveTo(t * r * 1.6, -r * .4); ctx.lineTo(t * r * .7, r * .48); ctx.stroke(); }
      break;
    }
    case "basil": {
      if (spooky) {   // a basil leaf cut into a little bat
        ctx.beginPath();
        ctx.moveTo(0, -r * .3);
        ctx.quadraticCurveTo(r * .5, -r * .62, r * 1.05, -r * .42);
        ctx.quadraticCurveTo(r * .86, -r * .1, r * .92, r * .2);
        ctx.quadraticCurveTo(r * .66, r * .06, r * .5, r * .28);
        ctx.quadraticCurveTo(r * .34, r * .12, r * .16, r * .4);
        ctx.lineTo(0, r * .3);
        ctx.lineTo(-r * .16, r * .4);
        ctx.quadraticCurveTo(-r * .34, r * .12, -r * .5, r * .28);
        ctx.quadraticCurveTo(-r * .66, r * .06, -r * .92, r * .2);
        ctx.quadraticCurveTo(-r * .86, -r * .1, -r * 1.05, -r * .42);
        ctx.quadraticCurveTo(-r * .5, -r * .62, 0, -r * .3);
        ctx.closePath();
        ctx.fillStyle = blend("#43a046", "#2f7432", bake); ctx.fill();
        ctx.strokeStyle = "#1f5a24"; ctx.lineWidth = lw; ctx.stroke();
        ctx.beginPath();   // the head, with pointy ears
        ctx.moveTo(-r * .22, -r * .52); ctx.lineTo(-r * .16, -r * .72); ctx.lineTo(-r * .04, -r * .56);
        ctx.lineTo(r * .04, -r * .56); ctx.lineTo(r * .16, -r * .72); ctx.lineTo(r * .22, -r * .52);
        ctx.quadraticCurveTo(r * .3, -r * .12, 0, -r * .08); ctx.quadraticCurveTo(-r * .3, -r * .12, -r * .22, -r * .52);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff";
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * .1, -r * .36, r * .07, 0, TAU); ctx.fill(); }
        break;
      }
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.quadraticCurveTo(-r * .1, -r * .95, r, 0);
      ctx.quadraticCurveTo(-r * .1, r * .95, -r, 0);
      ctx.closePath();
      ctx.fillStyle = blend("#43a046", "#2f7432", bake); ctx.fill();
      ctx.strokeStyle = "#1f5a24"; ctx.lineWidth = lw; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = lw * .7;
      ctx.beginPath(); ctx.moveTo(-r * .8, 0); ctx.lineTo(r * .75, 0); ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// The pizza at (cx, cy) with outer radius R. `p` is the pizza state from the game.
export function drawPizza(ctx, cx, cy, R, p) {
  const bake = p.bake || 0, Rs = R * .84;
  ctx.save();
  if (p.eaten?.some(Boolean)) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) if (!p.eaten[i]) { ctx.moveTo(cx, cy); ctx.arc(cx, cy, R * 1.3, i * TAU / 8, (i + 1) * TAU / 8); ctx.closePath(); }
    ctx.clip();
  }
  // shadow + dough
  const lump = lumpiness(p.roll ?? 1);
  const outline = (rad, dy = 0) => {
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * TAU;
      const k = 1 + lump * (.5 * Math.sin(3 * a + 1) + .3 * Math.sin(5 * a + 2) + .2 * Math.sin(2 * a + .5));
      const x = cx + Math.cos(a) * rad * k, y = cy + dy + Math.sin(a) * rad * k;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  outline(R, R * .05); ctx.fillStyle = "rgba(38,49,74,.18)"; ctx.fill();
  const g = ctx.createRadialGradient(cx - R * .25, cy - R * .3, R * .1, cx, cy, R);
  g.addColorStop(0, blend("#fbebc6", "#f2c675", bake));
  g.addColorStop(.8, blend("#f4d9a6", "#e2a052", bake));
  g.addColorStop(1, blend("#e9c68a", "#c2742f", bake));
  outline(R); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(2.5, R * .022); ctx.strokeStyle = INK; ctx.stroke();
  if ((p.roll ?? 1) >= 1) {
    // the puffy crust
    ctx.strokeStyle = `rgba(255,255,255,${.28 - bake * .15})`; ctx.lineWidth = R * .05;
    ctx.beginPath(); ctx.arc(cx, cy, R * .92, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
    ctx.strokeStyle = `rgba(150,90,30,${.15 + bake * .2})`; ctx.lineWidth = Math.max(1.5, R * .012);
    ctx.beginPath(); ctx.arc(cx, cy, R * .855, 0, TAU); ctx.stroke();
  }
  // sauce
  if (p.sauceImg && p.dabs?.length) {
    ctx.drawImage(p.sauceImg, cx - Rs, cy - Rs, Rs * 2, Rs * 2);
  } else if (p.sauceFill) {
    ctx.fillStyle = sauceLook(p.sauceFill, spooky).css;
    ctx.beginPath(); ctx.arc(cx, cy, Rs * .985, 0, TAU); ctx.fill();
  }
  if (bake > 0 && (p.dabs?.length || p.sauceFill)) {
    ctx.fillStyle = `rgba(110,40,0,${bake * .16})`;
    ctx.beginPath(); ctx.arc(cx, cy, Rs * .985, 0, TAU); ctx.fill();
  }
  // cheese: thin shreds that melt into blobs and brown in the oven
  if (p.cheese?.length) {
    const m = Math.min(1, bake * 1.4);
    const shred = (w, col, long = 1) => {
      ctx.strokeStyle = col; ctx.lineCap = "round";
      for (const c of p.cheese) {
        const l = c.l * long * (1 - m * .5) * Rs, x = cx + c.x * Rs, y = cy + c.y * Rs;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(x - Math.cos(c.a) * l / 2, y - Math.sin(c.a) * l / 2); ctx.lineTo(x + Math.cos(c.a) * l / 2, y + Math.sin(c.a) * l / 2); ctx.stroke();
      }
    };
    if (spooky) {   // cobweb cheese: long, thin white strands
      const w = Rs * (.016 + .02 * m);
      shred(w + Math.max(1.5, Rs * .008) * (1 - m), blend("#b9b3cc", "#d9cfb8", m), 1.6);
      shred(w, blend("#fbfaff", "#fff3d6", m), 1.6);
    } else {
      const w = Rs * (.032 + .04 * m);
      shred(w + Math.max(2, Rs * .012) * (1 - m), blend("#e1b93e", "#f0c64e", m));
      shred(w, blend("#ffe98f", "#ffdb63", m));
    }
    if (bake > .5) {
      ctx.fillStyle = `rgba(214,140,50,${Math.min(.6, (bake - .5) * 1.4)})`;
      for (const c of p.cheese) if (c.spot) { ctx.beginPath(); ctx.ellipse(cx + c.x * Rs, cy + c.y * Rs, Rs * .03, Rs * .02, c.a, 0, TAU); ctx.fill(); }
    }
  }
  if (p.guide) {
    // bare slices glow, with the same orange dashes as anywhere else a thing can go
    ctx.save();
    ctx.fillStyle = "rgba(255,240,170,.55)"; ctx.strokeStyle = "#ffb02e"; ctx.lineWidth = Math.max(3, R * .02); ctx.lineJoin = "round";
    ctx.setLineDash([R * .05, R * .035]);
    for (const i of p.guide.empty) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, Rs * .97, i * TAU / 8, (i + 1) * TAU / 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    ctx.save();
    ctx.setLineDash([R * .04, R * .04]); ctx.strokeStyle = "rgba(255,255,255,.6)"; ctx.lineWidth = Math.max(1.5, R * .012);
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { const a = k * TAU / 8; ctx.moveTo(cx - Math.cos(a) * Rs, cy - Math.sin(a) * Rs); ctx.lineTo(cx + Math.cos(a) * Rs, cy + Math.sin(a) * Rs); }
    ctx.stroke();
    ctx.restore();
  }
  for (const t of p.toppings || []) drawTopping(ctx, t.id, cx + t.x * Rs, cy + t.y * Rs, Rs * TOPPING_SIZE, t.rot, bake);
  // slices
  const cut = (a, from, to) => {
    const x0 = cx + Math.cos(a) * R * from, y0 = cy + Math.sin(a) * R * from;
    const x1 = cx + Math.cos(a) * R * to, y1 = cy + Math.sin(a) * R * to;
    ctx.strokeStyle = "rgba(60,25,10,.5)"; ctx.lineWidth = Math.max(2, R * .018); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    return [x1, y1];
  };
  for (const k of p.cuts || []) cut(k * Math.PI / 4, -1.02, 1.02);
  ctx.restore();
  if (p.cutAnim) {
    const [x, y] = cut(p.cutAnim.a, -1.05, -1.05 + 2.1 * p.cutAnim.p);
    drawCutter(ctx, x, y, R * .13);
  }
}

export function drawCutter(ctx, x, y, r) {
  ctx.save();
  ctx.lineWidth = Math.max(2, r * .16); ctx.strokeStyle = INK; ctx.lineCap = "round";
  ctx.fillStyle = "#ff5a5f";
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + r * 2.2, y - r * 2.4); ctx.lineWidth = r * .55; ctx.stroke();
  ctx.lineWidth = r * .35; ctx.strokeStyle = "#ff5a5f"; ctx.stroke();
  const g = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
  g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#b9c0cf");
  ctx.fillStyle = g; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, r * .16);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x, y, r * .2, 0, TAU); ctx.fill();
  ctx.restore();
}

// The brick oven. The mouth's floor, where the pizza sits, is OVEN_FLOOR.
export const OVEN_FLOOR = { y: .72, r: .19, squash: .38 };
export function drawOven(ctx, s, t, heat, sparks) {
  ctx.save();
  ctx.lineJoin = "round";
  // chimney and smoke
  ctx.fillStyle = "#a9472f"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, s * .01);
  ctx.beginPath(); ctx.rect(s * .6, s * .11, s * .1, s * .14); ctx.fill(); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const p = (t * .25 + i / 4) % 1;
    ctx.fillStyle = `rgba(255,255,255,${.5 * (1 - p)})`;
    ctx.beginPath(); ctx.arc(s * (.65 + Math.sin(p * 5 + i) * .03), s * (.09 - p * .08), s * (.015 + p * .02), 0, TAU); ctx.fill();
  }
  // dome
  const dome = () => {
    ctx.beginPath();
    ctx.moveTo(s * .07, s * .86);
    ctx.lineTo(s * .07, s * .5);
    ctx.bezierCurveTo(s * .07, s * .1, s * .93, s * .1, s * .93, s * .5);
    ctx.lineTo(s * .93, s * .86);
    ctx.closePath();
  };
  dome();
  const g = ctx.createLinearGradient(0, s * .15, 0, s * .86);
  g.addColorStop(0, "#d9694a"); g.addColorStop(1, "#b44a30");
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.strokeStyle = "rgba(90,25,10,.25)"; ctx.lineWidth = Math.max(1.5, s * .005);
  const bh = s * .055, bw = s * .12;
  for (let row = 0; row * bh < s; row++) {
    const y = s * .14 + row * bh;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    for (let x = (row % 2) * bw / 2; x < s; x += bw) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + bh); ctx.stroke(); }
  }
  ctx.restore();
  dome(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, s * .012); ctx.stroke();
  // mouth
  const mouth = () => {
    ctx.beginPath();
    ctx.moveTo(s * .2, s * .8);
    ctx.lineTo(s * .2, s * .6);
    ctx.bezierCurveTo(s * .2, s * .37, s * .8, s * .37, s * .8, s * .6);
    ctx.lineTo(s * .8, s * .8);
    ctx.closePath();
  };
  mouth();
  const mg = ctx.createLinearGradient(0, s * .42, 0, s * .8);
  mg.addColorStop(0, "#1c0d0a");
  mg.addColorStop(1, `rgb(${120 + 100 * heat | 0},${50 + 50 * heat | 0},20)`);
  ctx.fillStyle = mg; ctx.fill();
  ctx.save(); ctx.clip();
  // fire at the back
  const fx = s * .5, fy = s * .64;
  ctx.fillStyle = "#5a3220"; ctx.strokeStyle = "#2a160d"; ctx.lineWidth = Math.max(1.5, s * .005);
  for (const a of [-.18, .18]) {
    ctx.save(); ctx.translate(fx, fy + s * .01); ctx.rotate(a);
    rounded(ctx, -s * .09, -s * .015, s * .18, s * .03, s * .015); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, s * (.15 + .15 * heat));
  glow.addColorStop(0, `rgba(255,170,60,${.35 + .4 * heat})`); glow.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, s, s);
  for (const [col, k] of [["#ff6a1a", 1], ["#ffb02e", .7], ["#fff1a6", .4]]) {
    ctx.fillStyle = col;
    for (let i = -2; i <= 2; i++) {
      const h = s * (.06 + .11 * heat) * k * (1 + .22 * Math.sin(t * 9 + i * 1.9)) * (1 - Math.abs(i) * .18);
      const w = s * .035 * k + s * .01, x = fx + i * s * .04;
      ctx.beginPath();
      ctx.moveTo(x - w, fy);
      ctx.quadraticCurveTo(x - w, fy - h * .6, x + Math.sin(t * 7 + i) * w * .4, fy - h);
      ctx.quadraticCurveTo(x + w, fy - h * .6, x + w, fy);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalCompositeOperation = "lighter";
  for (const sp of sparks) {
    ctx.fillStyle = `rgba(255,${190 + 60 * sp.life | 0},90,${sp.life})`;
    ctx.beginPath(); ctx.arc(sp.x * s, sp.y * s, s * .008 * (.5 + sp.life), 0, TAU); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
  // stone arch
  mouth(); ctx.strokeStyle = "#e8d9c6"; ctx.lineWidth = s * .03; ctx.stroke();
  mouth(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2, s * .008); ctx.stroke();
  // hearth
  ctx.fillStyle = "#c9bcae"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, s * .01);
  rounded(ctx, s * .03, s * .84, s * .94, s * .07, s * .02); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// The oven drawn into a square of side o.s at (o.x, o.y).
export function drawOvenAt(ctx, o, t, heat, sparks) {
  ctx.save();
  ctx.translate(o.x, o.y);
  drawOven(ctx, o.s, t, heat, sparks);
  ctx.restore();
}
// Where a pizza sits on the oven floor.
export const ovenFloor = o => ({ x: o.x + o.s * .5, y: o.y + o.s * OVEN_FLOOR.y, R: o.s * OVEN_FLOOR.r, squash: OVEN_FLOOR.squash });

// A wooden pizza peel: a round paddle of radius r at (x, y), handle down to the right.
export function drawPeel(ctx, x, y, r) {
  ctx.save();
  ctx.lineJoin = "round"; ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, r * .05);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#b8743c";
  rounded(ctx, -r * .14, r * .7, r * .28, r * 1.3, r * .14); ctx.fill(); ctx.stroke();
  ctx.restore();
  const g = ctx.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r);
  g.addColorStop(0, "#f3d29f"); g.addColorStop(1, "#d9a462");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.restore();
}

// The worktop under the cutting board and the box.
export function drawCounter(ctx, c) {
  ctx.save();
  ctx.fillStyle = "rgba(38,49,74,.14)";
  rounded(ctx, c.x, c.y + c.h * .02, c.w, c.h, Math.min(c.w, c.h) * .08); ctx.fill();
  const g = ctx.createLinearGradient(0, c.y, 0, c.y + c.h);
  g.addColorStop(0, "#f7f4ef"); g.addColorStop(1, "#e6e0d6");
  ctx.fillStyle = g;
  rounded(ctx, c.x, c.y, c.w, c.h, Math.min(c.w, c.h) * .08); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, Math.min(c.w, c.h) * .012); ctx.stroke();
  // a few marble veins
  ctx.save(); ctx.clip();
  ctx.strokeStyle = "rgba(120,110,100,.12)"; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(c.x + c.w * (i * .3 - .1), c.y);
    ctx.bezierCurveTo(c.x + c.w * (i * .3 + .1), c.y + c.h * .4, c.x + c.w * (i * .3 - .05), c.y + c.h * .6, c.x + c.w * (i * .3 + .15), c.y + c.h);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

// A pizza box with its base's top-left at (b.x, b.y), side b.s. lid: 0 = open (lid up behind), 1 = shut.
// `inside` draws whatever is in the box (the pizza) before the lid goes over it.
export function drawBox(ctx, b, lid, inside, lidShare = .38) {
  const { x, y, s } = b, lw = Math.max(2, s * .02);
  ctx.save();
  ctx.lineJoin = "round"; ctx.strokeStyle = INK; ctx.lineWidth = lw;
  const k = Math.cos(Math.min(1, Math.max(0, lid)) * Math.PI);
  if (k > 0) { // the inside of the lid, standing up behind
    ctx.fillStyle = "#c98d4c";
    ctx.beginPath(); ctx.rect(x, y - s * lidShare * k, s, s * lidShare * k); ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = "rgba(38,49,74,.16)"; ctx.fillRect(x + s * .03, y + s * .05, s, s);
  ctx.fillStyle = "#dba465";
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#f3dcb3";
  ctx.beginPath(); ctx.rect(x + s * .06, y + s * .06, s * .88, s * .88); ctx.fill();
  inside?.();
  if (k < 0) { // the lid coming down over the top
    const h = s * -k;
    ctx.fillStyle = "#e5b073";
    ctx.beginPath(); ctx.rect(x, y, s, h); ctx.fill(); ctx.stroke();
    if (k < -.85) {
      ctx.fillStyle = spooky ? "#ff8c1a" : "#d8392b";
      ctx.beginPath(); ctx.arc(x + s / 2, y + h / 2, s * .3, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fff6c9"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `800 ${s * .17}px "Baloo 2", system-ui, sans-serif`;
      ctx.fillText("Pizza", x + s / 2, y + h / 2 + s * .02);
    }
  }
  ctx.restore();
}

// A dashed ring around where the thing in your hand can go.
export function drawTarget(ctx, shape) {
  ctx.save();
  ctx.setLineDash([10, 8]); ctx.lineWidth = 4; ctx.strokeStyle = "#ffb02e";
  ctx.beginPath();
  if (shape.r) ctx.arc(shape.x, shape.y, shape.r, 0, TAU);
  else ctx.roundRect ? ctx.roundRect(shape.x, shape.y, shape.w, shape.h, 14) : ctx.rect(shape.x, shape.y, shape.w, shape.h);
  ctx.stroke();
  ctx.restore();
}
