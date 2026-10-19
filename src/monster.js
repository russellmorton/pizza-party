// The hungry monster customers, drawn as SVG (the same family as Paint Pots).
import { costume } from "./halloween.js";

// At Halloween every monster comes in costume.
let dressedUp = false;
export function dressUp(on) { dressedUp = on; }

export const INK = "#26314a";
export const MONSTER_COLOURS = ["#ff8a5c", "#7cc6ff", "#b58cff", "#7ad67a", "#ffc83d", "#ff7ab8", "#5fd3c4"];

const BODIES = [
  // round blob
  `<path class="body" d="M18 98 C8 60 26 18 60 18 C94 18 112 60 102 98 C96 108 24 108 18 98Z"/>`,
  // cat-ish with ears
  `<path class="body" d="M22 100 C14 70 20 44 30 34 L26 8 L48 26 C56 24 64 24 72 26 L94 8 L90 34 C100 44 106 70 98 100 C90 110 30 110 22 100Z"/>`,
  // tall with antenna
  `<g><path d="M60 22 C60 14 64 8 70 6" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle class="body" cx="71" cy="6" r="6"/></g><path class="body" d="M30 104 C24 80 26 30 60 22 C94 30 96 80 90 104 C80 112 40 112 30 104Z"/>`,
  // wide bug with spots
  `<path class="body" d="M8 92 C4 58 30 34 60 34 C90 34 116 58 112 92 C104 106 16 106 8 92Z"/><circle cx="26" cy="80" r="5" fill="${INK}" opacity=".18"/><circle cx="94" cy="80" r="5" fill="${INK}" opacity=".18"/>`,
];
export const KINDS = BODIES.length;
const EYES = [
  [[46, 58], [74, 58]],
  [[46, 60], [74, 60]],
  [[60, 52]],
  [[42, 62], [60, 56], [78, 62]],
];

// mood: "wait" (hungry little smile), "happy" (big grin) or "chomp" (mouth wide open)
export function monsterSVG(kind, fill, mood = "wait") {
  const eyes = EYES[kind].map(([x, y]) =>
    `<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${INK}" stroke-width="3"/><circle cx="${x + 1.5}" cy="${y + 1.5}" r="4.2" fill="${INK}"/><circle cx="${x + 3}" cy="${y - 1}" r="1.4" fill="#fff"/>`).join("");
  const my = 80;
  const mouth = {
    wait: `<path d="M50 ${my + 2} Q60 ${my + 8} 70 ${my + 2}" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M66 ${my + 4} q3 6 0 9" fill="#7cc6ff" stroke="${INK}" stroke-width="2"/>`,
    happy: `<path d="M46 ${my} Q60 ${my + 16} 74 ${my}Z" fill="${INK}"/><path d="M53 ${my + 6} Q60 ${my + 12} 67 ${my + 6}" fill="#ff7a8a"/>`,
    chomp: `<ellipse cx="60" cy="${my + 6}" rx="11" ry="10" fill="${INK}"/><ellipse cx="60" cy="${my + 11}" rx="7" ry="4" fill="#ff7a8a"/>`,
  }[mood];
  const feet = `<ellipse cx="42" cy="106" rx="11" ry="6" class="body"/><ellipse cx="78" cy="106" rx="11" ry="6" class="body"/>`;
  const blush = `<circle cx="34" cy="76" r="6" fill="#ff8aa0" opacity=".35"/><circle cx="86" cy="76" r="6" fill="#ff8aa0" opacity=".35"/>`;
  const dress = dressedUp ? costume(kind, mood) : { behind: "", front: "" };
  return `<svg viewBox="0 0 120 120" aria-hidden="true">${dress.behind}<g fill="${fill}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round">${feet}${BODIES[kind]}</g>${blush}${eyes}${mouth}${dress.front}</svg>`;
}
