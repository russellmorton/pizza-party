# Pizza Party

A pizza making game for a four-year-old. A hungry monster comes to the counter with an order, and you make its pizza from start to finish in a little kitchen with three stations: the prep board, a brick oven and the counter. The station you're working at gets the most room. Everything works by tapping: tap a tool or ingredient to pick it up, then tap where it should go.

1. **Roll** the ball of dough flat by moving the rolling pin over it. No clicking needed; on a touch screen, rub it with a finger.
2. **Sauce:** pick up the tomato or pesto ladle and tap the pizza to pour sauce where you tap. Then pick up the cheese and tap to sprinkle it.
3. **Toppings:** decorate by hand. Tap a box (pepperoni, mushrooms, olives, green peppers, pineapple or basil) to pick a topping up, then tap the pizza to put it down. The monster counts each one out loud. Tap a topping on the pizza to pick it up and move it, or tap its box to put it back.
4. **Bake:** pick up the peel, tap the pizza to slide the peel under it, then tap the oven to slide it in. Pick up wood and tap the oven to make the fire hotter, so it bakes faster. The cheese melts and the crust turns golden; it never burns. At the "Ding!", use the peel to take it out and put it on the cutting board.
5. **Cut:** pick up the cutter and tap the edge of the pizza; each cut runs through the middle from where you tap. Four cuts make eight slices.
6. **Serve:** tap the pizza to pick it up and tap the box to put it in. Then pick up the box and give it to the monster, who opens it and gobbles up every slice.

Tools stay in your hand until you put them back (tap their button again); a topping or a log is one at a time. With a keyboard, Enter on a tool picks it up and Enter on the kitchen uses it.

- **Orders:** each monster wants a sauce and a number of toppings, shown on its order ticket as pictures and dots. Orders start with one kind of topping and grow to three. Every fifth monster throws a pizza party.
- **Free play:** make any pizza you like.

Live at https://pizza-party-wheat.vercel.app

## Running it

No build step. It's a static page with plain ES modules.

```sh
npm install
npm start          # http://localhost:4173
```

## Tests

```sh
npm run test:unit  # orders, toppings, sauce coverage, baking, kitchen layout (node:test)
npm run test:e2e   # plays the game in Chromium (Playwright)
npm test           # both
```

## Layout

- `index.html`: markup and styles
- `src/pizza.js`: the rules (orders, topping placement, sauce coverage, rolling and baking)
- `src/kitchen.js`: where the board, oven and counter go, and which one a tap lands on
- `src/draw.js`: canvas drawing for the board, pizza, toppings, oven, peel, counter and box
- `src/monster.js`: the monster customers
- `src/game.js`: everything else, including steps, your hand, input, sound, voice and the party

## Deploying

Pushes to `main` deploy to production through Vercel's GitHub integration; pull requests get preview deployments. Vercel serves the repo root as a static site (`vercel.json`), and `.vercelignore` keeps tests and tooling out. GitHub Actions runs the tests on every push and pull request. Vercel Web Analytics (`src/analytics.js`) counts visits to the live site, without cookies.

The party tune is an original tarantella-style jingle written for the game.
