import { test, expect } from "@playwright/test";

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
});
test.afterEach(() => expect(errors).toEqual([]));

const tool = (page, name) => page.locator("#tray").getByRole("button", { name, exact: true });
const step = page => page.locator("#tray").getAttribute("data-step");
// Taps a tool while the step lasts. The last tap of a step can race the tray
// switching to the next step's tools, so a missing button just ends the loop.
async function tapWhile(page, name, during) {
  for (let i = 0; i < 40 && await step(page) === during; i++) await tool(page, name).click({ timeout: 1500 }).catch(() => {});
  await expect.poll(() => step(page)).not.toBe(during);
}

async function readOrder(page) {
  const sauce = await page.locator(".sauce-line").getAttribute("data-sauce");
  const toppings = {};
  for (const l of await page.locator(".ticket .line[data-id]").all()) toppings[await l.getAttribute("data-id")] = +(await l.getAttribute("data-count"));
  return { sauce, toppings };
}
// Picks a topping up from its box and puts it down on the pizza, at the i-th spot of a spiral.
async function decorate(page, id, i) {
  await tool(page, binName[id]).click();
  await putDown(page, i);
}
async function putDown(page, i) {
  const box = await page.locator("#work-canvas").boundingBox();
  const a = i * 2.4, r = box.width * (.1 + .025 * (i % 10));
  await page.locator("#work-canvas").click({ position: { x: box.width / 2 + Math.cos(a) * r, y: box.height / 2 + Math.sin(a) * r } });
}
const dotsOn = (page, id) => page.locator(`.line[data-id="${id}"] .dots i.on`);
const binName = { pepperoni: "Pepperonis", mushroom: "Mushrooms", olive: "Olives", pepper: "Green peppers", pineapple: "Pineapples", basil: "Basil leaves" };

async function rollSauceCheese(page, sauce = "tomato") {
  await tapWhile(page, "Roll", "roll");
  await tapWhile(page, sauce === "tomato" ? "Tomato sauce" : "Pesto sauce", "sauce");
  await tapWhile(page, "Cheese", "cheese");
  await expect.poll(() => step(page)).toBe("top");
}
async function bakeCutEat(page) {
  await tool(page, "Bake it!").click();
  await expect.poll(() => step(page)).toBe("bake");
  for (let i = 0; i < 4; i++) await tool(page, "Add wood").click();
  await expect.poll(() => step(page), { timeout: 20_000 }).toBe("cut");
  await tapWhile(page, "Cut", "cut");
}

test("opens with a hungry monster and a ball of dough", async ({ page }) => {
  await expect(page).toHaveTitle("Pizza Party");
  await expect(page.locator("#creature")).toHaveAttribute("aria-label", /hungry monster who wants/);
  await expect(page.locator("#steps li.now")).toContainText("Roll");
  await expect(tool(page, "Roll")).toBeVisible();
  await expect(page.locator("#work-canvas")).toBeVisible();
});

test("rolling by dragging across the dough", async ({ page }) => {
  const box = await page.locator("#work-canvas").boundingBox();
  const cx = box.x + box.width / 2;
  await page.mouse.move(cx, box.y + box.height * .2);
  await page.mouse.down();
  for (let i = 0; i < 8 && await step(page) === "roll"; i++) {
    await page.mouse.move(cx, box.y + box.height * .8, { steps: 8 });
    await page.mouse.move(cx, box.y + box.height * .2, { steps: 8 });
  }
  await page.mouse.up();
  await expect.poll(() => step(page)).toBe("sauce");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("making the pizza on the order and serving it", async ({ page }) => {
    const order = await readOrder(page);
    await rollSauceCheese(page, order.sauce);
    await expect(tool(page, "Bake it!")).toBeHidden();
    let spot = 0;
    for (const [id, n] of Object.entries(order.toppings)) for (let i = 0; i < n; i++) await decorate(page, id, spot++);
    await expect(page.locator(".ticket .line.full")).toHaveCount(1 + Object.keys(order.toppings).length);
    await bakeCutEat(page);
    await expect(page.locator("#shelf > div")).toHaveCount(1, { timeout: 10_000 });
    await expect.poll(() => step(page), { timeout: 10_000 }).toBe("roll");
  });

  test("the wrong sauce has to be swapped for the one on the order", async ({ page }) => {
    const order = await readOrder(page);
    const wrong = order.sauce === "tomato" ? "Pesto sauce" : "Tomato sauce";
    const right = order.sauce === "tomato" ? "Tomato sauce" : "Pesto sauce";
    await tapWhile(page, "Roll", "roll");
    for (let i = 0; i < 25; i++) await tool(page, wrong).click();
    await expect(page.locator("#announce")).toContainText("this monster wants");
    expect(await step(page)).toBe("sauce");
    await tool(page, right).click();
    await expect.poll(() => step(page)).toBe("cheese");
  });

  test("too many toppings must come off before baking", async ({ page }) => {
    const order = await readOrder(page);
    await rollSauceCheese(page, order.sauce);
    const [id, n] = Object.entries(order.toppings)[0];
    let spot = 0;
    for (const [k, m] of Object.entries(order.toppings)) for (let i = 0; i < m; i++) await decorate(page, k, spot++);
    await expect(tool(page, "Bake it!")).toBeVisible();
    await decorate(page, id, spot++);
    await expect(page.locator(`.line[data-id="${id}"] .extra`)).toHaveText("+1");
    await expect(tool(page, "Bake it!")).toBeHidden();
    await tool(page, "Take one off").click();
    await expect(page.locator(`.line[data-id="${id}"] .extra`)).toBeHidden();
    await expect(tool(page, "Bake it!")).toBeVisible();
    expect(n).toBeGreaterThan(0);
  });

  test("toppings are picked up and put down by hand, and can be moved", async ({ page }) => {
    const order = await readOrder(page);
    await rollSauceCheese(page, order.sauce);
    const [id] = Object.keys(order.toppings);
    await tool(page, binName[id]).click();
    await expect(tool(page, binName[id])).toHaveAttribute("aria-pressed", "true");
    await expect(dotsOn(page, id)).toHaveCount(0);   // still in the hand
    await putDown(page, 3);
    await expect(dotsOn(page, id)).toHaveCount(1);
    await expect(tool(page, binName[id])).toHaveAttribute("aria-pressed", "false");
    await putDown(page, 3);                           // pick it back up off the pizza...
    await expect(dotsOn(page, id)).toHaveCount(0);
    await putDown(page, 7);                           // ...and put it somewhere else
    await expect(dotsOn(page, id)).toHaveCount(1);
    await tool(page, binName[id]).click();            // tapping the box again puts it back
    await tool(page, binName[id]).click();
    await expect(tool(page, binName[id])).toHaveAttribute("aria-pressed", "false");
    await expect(dotsOn(page, id)).toHaveCount(1);
  });

  test("swiping across the pizza cuts it", async ({ page }) => {
    await page.getByRole("button", { name: "Free play" }).click();
    await rollSauceCheese(page);
    await tool(page, "Bake it!").click();
    for (let i = 0; i < 4; i++) await tool(page, "Add wood").click();
    await expect.poll(() => step(page), { timeout: 20_000 }).toBe("cut");
    const box = await page.locator("#work-canvas").boundingBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2, d = box.width * .45;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      await page.mouse.move(cx - dx * d, cy - dy * d);
      await page.mouse.down();
      await page.mouse.move(cx + dx * d, cy + dy * d, { steps: 6 });
      await page.mouse.up();
    }
    await expect(page.locator("#shelf > div")).toHaveCount(1, { timeout: 10_000 });
  });

  test("free play bakes any pizza, and five pizzas make a party", async ({ page }) => {
    test.setTimeout(240_000);
    await page.getByRole("button", { name: "Free play" }).click();
    await expect(page.locator(".ticket .any")).toHaveText("Any pizza you like!");
    for (let n = 1; n <= 5; n++) {
      await rollSauceCheese(page);
      await decorate(page, "olive", 0);
      await bakeCutEat(page);
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
