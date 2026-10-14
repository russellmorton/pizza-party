# Pizza Party

A pizza making game for a four-year-old. A hungry monster comes to the counter with an order, and you make its pizza from start to finish:

1. **Roll** the ball of dough flat. Drag the rolling pin back and forth, or tap the Roll button.
2. **Sauce:** pick tomato or pesto and spread it with your finger, or tap the ladle. Then sprinkle on the cheese.
3. **Toppings:** decorate the pizza by hand. Tap a box (pepperoni, mushrooms, olives, green peppers, pineapple or basil) to pick a topping up, then tap the pizza to put it down. The monster counts each one out loud. Tap a topping on the pizza to pick it up and move it, or tap its box to put it back.
4. **Bake:** the pizza slides into the brick oven. Add wood to make the fire hotter and the pizza bakes faster. The cheese melts and the crust turns golden. It never burns.
5. **Eat:** swipe across the pizza to cut it (each cut goes the way you swipe), or tap the cutter. Four cuts make eight slices, then the monster gobbles them up.

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
npm run test:unit  # orders, toppings, sauce coverage, baking (node:test)
npm run test:e2e   # plays the game in Chromium (Playwright)
npm test           # both
```

## Layout

- `index.html`: markup and styles
- `src/pizza.js`: the rules (orders, topping placement, sauce coverage, rolling and baking)
- `src/draw.js`: canvas drawing for the board, pizza, toppings and oven
- `src/monster.js`: the monster customers
- `src/game.js`: everything else, including steps, input, sound, voice and the party

## Deploying

Pushes to `main` deploy to production through Vercel's GitHub integration; pull requests get preview deployments. Vercel serves the repo root as a static site (`vercel.json`), and `.vercelignore` keeps tests and tooling out. GitHub Actions runs the tests on every push and pull request. Vercel Web Analytics (`src/analytics.js`) counts visits to the live site, without cookies.

The party tune is an original tarantella-style jingle written for the game.
