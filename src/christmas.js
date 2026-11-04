// Christmas dress-up, on from 12 November to 6 January: a red and green tablecloth, monsters in Santa
// hats, antlers and elf hats, star pepperoni and holly basil. The grown-ups' Christmas tree switch in
// the top bar (choice, remembered) beats the date, and ?christmas=1 or ?christmas=0 beats both.
import { isHalloween } from "./halloween.js";

export function isChristmas(date = new Date(), search = "", choice = null) {
  const ask = new URLSearchParams(search).get("christmas");
  if (ask === "1" || ask === "0") return ask === "1";
  if (typeof choice === "boolean") return choice;
  return (date.getMonth() === 10 && date.getDate() >= 12) || date.getMonth() === 11 || (date.getMonth() === 0 && date.getDate() <= 6);
}

// Halloween and Christmas are never on together. One that was asked for (in the address, or with
// its switch) beats one that's only on because of the date; if both were asked for, Christmas wins.
export function seasons(date = new Date(), search = "", choice = {}) {
  let halloween = isHalloween(date, search, choice.halloween ?? null);
  let christmas = isChristmas(date, search, choice.christmas ?? null);
  if (halloween && christmas) {
    const asked = key => new URLSearchParams(search).get(key) === "1" || choice[key] === true;
    if (asked("christmas") || !asked("halloween")) halloween = false; else christmas = false;
  }
  return { halloween, christmas };
}

const INK = `stroke="#26314a" stroke-width="3.5" stroke-linejoin="round"`;

// One Christmas outfit per monster shape, in the same 120×120 box as the Halloween costumes.
export function christmasCostume(kind) {
  if (kind === 0) {   // a Santa hat, the tip flopping over to one side
    return { behind: "", front: `<g class="costume" ${INK}>
      <path d="M34 24 Q40 -8 70 -6 Q92 -4 98 16 Q88 6 78 8 Q84 16 86 24Z" fill="#e8312f"/>
      <rect x="28" y="16" width="64" height="14" rx="7" fill="#fff"/>
      <circle cx="98" cy="18" r="8" fill="#fff"/></g>` };
  }
  if (kind === 1) {   // reindeer antlers between the ears, and a shiny red nose
    return { behind: `<g class="costume" stroke="#26314a" stroke-width="9" stroke-linecap="round" fill="none">
      <path d="M50 30 L44 4 M46 14 L34 6 M44 4 L50 -6 M70 30 L76 4 M74 14 L86 6 M76 4 L70 -6"/>
      <path d="M50 30 L44 4 M46 14 L34 6 M44 4 L50 -6 M70 30 L76 4 M74 14 L86 6 M76 4 L70 -6" stroke="#b07a46" stroke-width="5"/></g>`,
      front: `<g class="costume"><circle cx="60" cy="71" r="6" fill="#ff3b3b" stroke="#26314a" stroke-width="2.5"/><circle cx="58" cy="69" r="1.8" fill="#fff"/></g>` };
  }
  if (kind === 2) {   // a Christmas star on the antenna
    return { behind: "", front: `<g class="costume" stroke="#26314a" stroke-width="2.5" stroke-linejoin="round">
      <path d="M71 -8 L74.5 0.5 L83.5 1 L76.5 7 L79 16 L71 11 L63 16 L65.5 7 L58.5 1 L67.5 0.5Z" fill="#ffd84a"/></g>` };
  }
  // an elf hat with a bell on the tip
  return { behind: "", front: `<g class="costume" ${INK}>
    <path d="M36 40 Q44 6 74 -2 Q100 -6 108 14 Q96 8 86 14 Q86 30 86 40Z" fill="#3fae4f"/>
    <rect x="30" y="32" width="62" height="13" rx="6.5" fill="#e8312f"/>
    <circle cx="108" cy="16" r="6.5" fill="#ffd84a"/></g>` };
}
