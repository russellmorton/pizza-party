import { test } from "node:test";
import assert from "node:assert/strict";
import { isHalloween, costume } from "../../src/halloween.js";
import { KINDS } from "../../src/monster.js";

test("Halloween is all of October, and the address can switch it on or off", () => {
  assert.equal(isHalloween(new Date(2026, 9, 1)), true);
  assert.equal(isHalloween(new Date(2026, 9, 31, 23, 59)), true);
  assert.equal(isHalloween(new Date(2026, 8, 30)), false);
  assert.equal(isHalloween(new Date(2026, 10, 1)), false);
  assert.equal(isHalloween(new Date(2026, 3, 2), "?halloween=1"), true);
  assert.equal(isHalloween(new Date(2026, 9, 20), "?halloween=0"), false);
});

test("the grown-ups' Halloween switch beats the date, and the address beats the switch", () => {
  assert.equal(isHalloween(new Date(2026, 4, 1), "", true), true);
  assert.equal(isHalloween(new Date(2026, 9, 20), "", false), false);
  assert.equal(isHalloween(new Date(2026, 4, 1), "?halloween=0", true), false);
});

test("every monster shape has a costume, whatever its mood", () => {
  for (let kind = 0; kind < KINDS; kind++) for (const mood of ["wait", "happy", "chomp"]) {
    const { behind, front } = costume(kind, mood);
    assert.match(behind + front, /class="costume"/, `kind ${kind} ${mood}`);
  }
});
