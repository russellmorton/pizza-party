// Halloween dress-up, on for all of October: a spooky tablecloth, monsters in costumes, jack-o'-lantern
// pepperoni and spider olives. The grown-ups' switch in the top bar (choice, remembered) beats the date,
// and ?halloween=1 or ?halloween=0 in the address beats both.
export function isHalloween(date = new Date(), search = "", choice = null) {
  const ask = new URLSearchParams(search).get("halloween");
  if (ask === "1" || ask === "0") return ask === "1";
  if (typeof choice === "boolean") return choice;
  return date.getMonth() === 9;
}

const INK = `stroke="#26314a" stroke-width="3.5" stroke-linejoin="round"`;
// Where the top of the mouth is for each mood (see monsterSVG), for the vampire fangs.
const MOUTH_TOP = { wait: 84, happy: 80, chomp: 77 };

// One costume per monster shape (the same family as Paint Pots), in the same 120×120 box.
// behind goes under the monster, front on top of it.
export function costume(kind, mood = "wait") {
  if (kind === 0) {   // a witch's hat with a floppy tip
    return { behind: "", front: `<g class="costume" ${INK}>
      <ellipse cx="60" cy="22" rx="36" ry="7" fill="#4a2f7a"/>
      <path d="M38 21 L56 -22 Q62 -30 74 -22 Q64 -18 62 -8 L82 21Z" fill="#4a2f7a"/>
      <path d="M42.6 10 L74.4 10 L79.9 18 L39.3 18Z" fill="#ff8c1a"/>
      <rect x="55" y="9.5" width="9" height="9" fill="#ffd84a" stroke-width="2.5"/></g>` };
  }
  if (kind === 1) {   // bat wings
    return { front: "", behind: `<g class="costume" ${INK} fill="#5b3a8c">
      <path d="M24 52 L4 30 L-14 44 Q-6 52 -8 62 Q0 56 4 66 Q10 58 20 70Z"/>
      <path d="M96 52 L116 30 L134 44 Q126 52 128 62 Q120 56 116 66 Q110 58 100 70Z"/></g>` };
  }
  if (kind === 2) {   // a jack-o'-lantern bobble on the antenna
    return { behind: "", front: `<g class="costume" stroke="#26314a" stroke-width="2.5" stroke-linejoin="round">
      <path d="M70 -5 L71 -11 L75 -10 L74 -4Z" fill="#6d8f2e"/>
      <ellipse cx="66" cy="4" rx="6" ry="8" fill="#ff8c1a"/><ellipse cx="76" cy="4" rx="6" ry="8" fill="#ff8c1a"/>
      <ellipse cx="71" cy="4" rx="5" ry="8.5" fill="#ffa040"/>
      <path d="M66 2 L69 2 L67.5 -1Z M73 2 L76 2 L74.5 -1Z M66 6 Q71 10 76 6" fill="#26314a" stroke-width="1.5"/></g>` };
  }
  // vampire fangs
  const y = MOUTH_TOP[mood] ?? 84;
  return { behind: "", front: `<g class="costume" fill="#fff" stroke="#26314a" stroke-width="2" stroke-linejoin="round">
    <path d="M51 ${y} L55 ${y} L53 ${y + 7}Z"/><path d="M65 ${y} L69 ${y} L67 ${y + 7}Z"/></g>` };
}
