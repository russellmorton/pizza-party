import { test, expect } from "@playwright/test";
import { layout } from "../../src/kitchen.js";

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
});
test.afterEach(() => expect(errors).toEqual([]));

const tool = (page, name) => page.locator("#tray").getByRole("button", { name, exact: true });
const step = page => page.locator("#tray").getAttribute("data-step");
const canvas = page => page.locator("#work-canvas");
const chip = (page, name) => page.locator("#steps").getByRole("button", { name, exact: true });
const binName = { pepperoni: "Pepperonis", mushroom: "Mushrooms", olive: "Olives", pepper: "Green peppers", pineapple: "Pineapples", basil: "Basil leaves" };
const dotsOn = (page, id) => page.locator(`.line[data-id="${id}"] .dots i.on`);

async function readOrder(page) {
  const sauce = await page.locator(".sauce-line").getAttribute("data-sauce");
  const toppings = {};
  for (const l of await page.locator(".ticket .line[data-id]").all()) toppings[await l.getAttribute("data-id")] = +(await l.getAttribute("data-count"));
  return { sauce, toppings };
}

// The kitchen as the game lays it out, with the given station in focus, in page coordinates.
async function kitchen(page, focus) {
  const b = await canvas(page).boundingBox();
  const L = layout(Math.floor(b.width), Math.floor(b.height), focus);
  const move = (x, y) => ({ x: b.x + x, y: b.y + y });
  const o = L.oven, c = L.counter;
  return {
    board: (fx = 0, fy = 0) => move(L.board.x + fx * L.board.r, L.board.y + fy * L.board.r),
    oven: () => move(o.x + o.s / 2, o.y + o.s * .62),
    cut: (fx = 0, fy = 0) => move(c.cut.x + fx * c.cut.r, c.cut.y + fy * c.cut.r),
    box: () => move(c.box.x + c.box.s / 2, c.box.y + c.box.s / 2),
    r: L.board.r,
  };
}
const tap = (page, p) => page.mouse.click(p.x, p.y);
// The i-th spot of a spiral over the pizza on the board.
const spot = i => [Math.cos(i * 2.4) * (.12 + .05 * (i % 9)), Math.sin(i * 2.4) * (.12 + .05 * (i % 9))];

async function roll(page) {
  const k = await kitchen(page, "board");
  for (let i = 0; i < 40 && await step(page) === "roll"; i++) {
    await page.mouse.move(k.board(0, -.6).x, k.board(0, -.6).y, { steps: 5 });
    await page.mouse.move(k.board(0, .6).x, k.board(0, .6).y, { steps: 5 });
  }
  await expect.poll(() => step(page)).toBe("sauce");
}
// Taps n spots on the board pizza with what's in your hand.
async function tapSpots(page, n, from = 0) {
  const k = await kitchen(page, "board");
  for (let i = from; i < from + n; i++) await tap(page, k.board(...spot(i)));
}
// As much sauce and cheese as we like, then on to the toppings by tapping the stage chips.
async function sauceAndCheese(page, sauce = "tomato") {
  await tool(page, sauce === "tomato" ? "Tomato sauce" : "Pesto sauce").click();
  await tapSpots(page, 4);
  await chip(page, "Cheese").click();
  await tool(page, "Cheese").click();
  await tapSpots(page, 3);
  await chip(page, "Toppings").click();
  await expect.poll(() => step(page)).toBe("top");
}
async function decorate(page, id, i) {
  const k = await kitchen(page, "board");
  await tool(page, binName[id]).click();
  await tap(page, k.board(...spot(i)));
}
async function bake(page) {
  await tool(page, "Peel").click();
  await tap(page, (await kitchen(page, "board")).board());
  await expect.poll(() => step(page)).toBe("bake");
  const k = await kitchen(page, "oven");
  await tap(page, k.oven());
  for (let i = 0; i < 4; i++) { await tool(page, "Wood").click(); await tap(page, k.oven()); }
  await expect(page.locator("#tool-peel.pulse")).toBeVisible({ timeout: 20_000 });
  await tool(page, "Peel").click();
  await tap(page, k.oven());
  await tap(page, (await kitchen(page, "counter")).cut());
  await expect.poll(() => step(page)).toBe("cut");
}
async function cutBoxServe(page) {
  const k = await kitchen(page, "counter");
  await tool(page, "Cutter").click();
  for (const [x, y] of [[.8, 0], [0, .8], [.6, .6], [-.6, .6]]) await tap(page, k.cut(x, y));
  await expect.poll(() => step(page)).toBe("serve");
  await tap(page, k.cut());
  await tap(page, k.box());
  await tap(page, k.box());
  await page.locator("#creature").click({ force: true });
}

test("opens with a hungry monster and a ball of dough", async ({ page }) => {
  await expect(page).toHaveTitle("Pizza Party");
  await expect(page.locator("#creature")).toHaveAttribute("aria-label", /hungry monster who wants/);
  await expect(page.locator("#steps li")).toHaveCount(7);
  await expect(page.locator("#steps li.now")).toContainText("Roll");
  await expect(page.locator("#hint")).toHaveText("Move the rolling pin over the dough");
  await expect(canvas(page)).toBeVisible();
});

test("rolling needs no click: just move over the dough", async ({ page }) => {
  await roll(page);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("making the pizza on the order, baking, cutting, boxing and serving it", async ({ page }) => {
    const order = await readOrder(page);
    await roll(page);
    await sauceAndCheese(page, order.sauce);
    let n = 0;
    for (const [id, count] of Object.entries(order.toppings)) for (let i = 0; i < count; i++) await decorate(page, id, n++);
    await expect(page.locator(".ticket .line.full")).toHaveCount(1 + Object.keys(order.toppings).length);
    await bake(page);
    await cutBoxServe(page);
    await expect(page.locator("#shelf > div")).toHaveCount(1, { timeout: 10_000 });
    await expect.poll(() => step(page), { timeout: 10_000 }).toBe("roll");
  });

  test("the wrong sauce has to be swapped before the peel will take the pizza", async ({ page }) => {
    const order = await readOrder(page);
    const [wrong, right] = order.sauce === "tomato" ? ["pesto", "tomato"] : ["tomato", "pesto"];
    await roll(page);
    await tool(page, wrong === "tomato" ? "Tomato sauce" : "Pesto sauce").click();
    await tapSpots(page, 1);
    await expect(page.locator("#announce")).toContainText("this monster wants");
    await sauceAndCheese(page, wrong);
    let n = 0;
    for (const [id, count] of Object.entries(order.toppings)) for (let i = 0; i < count; i++) await decorate(page, id, n++);
    await tool(page, "Peel").click();
    await tap(page, (await kitchen(page, "board")).board());
    await expect(page.locator("#announce")).toContainText("sauce");
    await expect(page.locator("#hint")).toContainText("sauce");   // shown, not only spoken
    expect(await step(page)).toBe("top");
    await chip(page, "Sauce").click();                       // back to the sauce, toppings and all
    await tool(page, right === "tomato" ? "Tomato sauce" : "Pesto sauce").click();
    await tapSpots(page, 1);
    await expect(page.locator(".sauce-line.full")).toBeVisible();
    await chip(page, "Toppings").click();
    await tool(page, "Peel").click();
    await tap(page, (await kitchen(page, "board")).board());
    await expect.poll(() => step(page)).toBe("bake");
  });

  test("sauce and cheese can be any amount, and you can go back for more", async ({ page }) => {
    await page.getByRole("button", { name: "Free play" }).click();
    await roll(page);
    await expect(tool(page, "Take some off")).toBeDisabled();
    await tool(page, "Tomato sauce").click();
    await tapSpots(page, 1);                                  // just one ladle
    await tool(page, "Take some off").click();               // puts the ladle back
    await tool(page, "Take some off").click();               // takes the sauce off again
    await expect(tool(page, "Take some off")).toBeDisabled();
    await tool(page, "Tomato sauce").click();
    await tapSpots(page, 2);
    await chip(page, "Toppings").click();                    // skip the cheese for now
    await expect(page.locator("#steps li.done")).toHaveCount(2); // rolled and sauced
    await decorate(page, "olive", 5);
    await chip(page, "Cheese").click();                      // and come back for it
    await tool(page, "Cheese").click();
    await tapSpots(page, 1);
    await chip(page, "Toppings").click();
    await expect(page.locator("#steps li.done")).toHaveCount(3);
    await tool(page, "Peel").click();
    await tap(page, (await kitchen(page, "board")).board());
    await expect.poll(() => step(page)).toBe("bake");
  });

  test("toppings are picked up and put down by hand, and can be moved", async ({ page }) => {
    const order = await readOrder(page);
    await roll(page);
    await sauceAndCheese(page, order.sauce);
    const [id] = Object.keys(order.toppings);
    const k = await kitchen(page, "board");
    await tool(page, binName[id]).click();
    await expect(tool(page, binName[id])).toHaveAttribute("aria-pressed", "true");
    await expect(dotsOn(page, id)).toHaveCount(0);   // still in the hand
    await tap(page, k.board(.3, .2));
    await expect(dotsOn(page, id)).toHaveCount(1);
    await tap(page, k.board(.3, .2));                // pick it back up off the pizza...
    await expect(dotsOn(page, id)).toHaveCount(0);
    await tap(page, k.board(-.3, -.3));              // ...and put it somewhere else
    await expect(dotsOn(page, id)).toHaveCount(1);
    await tool(page, binName[id]).click();           // tapping the box again puts it back
    await tool(page, binName[id]).click();
    await expect(tool(page, binName[id])).toHaveAttribute("aria-pressed", "false");
    await expect(dotsOn(page, id)).toHaveCount(1);
  });

  test("too many toppings must come off before the peel will take the pizza", async ({ page }) => {
    const order = await readOrder(page);
    await roll(page);
    await sauceAndCheese(page, order.sauce);
    const [id] = Object.keys(order.toppings);
    let n = 0;
    for (const [k, m] of Object.entries(order.toppings)) for (let i = 0; i < m; i++) await decorate(page, k, n++);
    await decorate(page, id, n++);
    await expect(page.locator(`.line[data-id="${id}"] .extra`)).toHaveText("+1");
    await tool(page, "Peel").click();
    await tap(page, (await kitchen(page, "board")).board());
    await expect(page.locator("#announce")).toContainText("Not yet");
    expect(await step(page)).toBe("top");
    await tool(page, "Take one off").click();          // puts the peel back
    await tool(page, "Take one off").click();          // takes the extra topping off
    await expect(page.locator(`.line[data-id="${id}"] .extra`)).toBeHidden();
    await expect(page.locator("#tool-peel.pulse")).toBeVisible();
  });

  test("free play, all by keyboard, and five pizzas make a party", async ({ page }) => {
    test.setTimeout(240_000);
    await page.getByRole("button", { name: "Free play" }).click();
    await expect(page.locator(".ticket .any")).toHaveText("Any pizza you like!");
    const enter = () => canvas(page).press("Enter");
    const pickUp = name => tool(page, name).press("Enter");
    const enterWhile = async during => { for (let i = 0; i < 40 && await step(page) === during; i++) await enter(); await expect.poll(() => step(page)).not.toBe(during); };
    for (let n = 1; n <= 5; n++) {
      await enterWhile("roll");
      await pickUp("Tomato sauce"); await enter(); await enter();
      await chip(page, "Cheese").press("Enter");
      await pickUp("Cheese"); await enter(); await enter();
      await chip(page, "Toppings").press("Enter");
      await pickUp("Olives"); await enter();
      await pickUp("Peel"); await enter(); await enter();               // onto the peel, into the oven
      for (let i = 0; i < 4; i++) { await pickUp("Wood"); await enter(); }
      await expect(page.locator("#tool-peel.pulse")).toBeVisible({ timeout: 20_000 });
      await pickUp("Peel"); await enter(); await enter();               // out of the oven, onto the counter
      await expect.poll(() => step(page)).toBe("cut");
      await pickUp("Cutter"); await enterWhile("cut");
      await expect.poll(() => step(page)).toBe("serve");
      await enter(); await enter();                                     // pick up the pizza, into the box
      await enter();                                                    // pick up the box
      await page.locator("#creature").press("Enter");
      if (n < 5) {
        await expect(page.locator("#shelf > div")).toHaveCount(n, { timeout: 10_000 });
        await expect.poll(() => step(page), { timeout: 10_000 }).toBe("roll");
      }
    }
    const party = page.getByRole("dialog", { name: "Pizza party" });
    await expect(party).toBeVisible({ timeout: 10_000 });
    await expect(party.locator(".guest")).toHaveCount(5);
    await party.getByRole("button", { name: "End the party" }).click();
    await expect(party).toHaveCount(0);
    await expect.poll(() => step(page)).toBe("roll");
  });
});
