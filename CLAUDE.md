# Pizza Party

A pizza making game for little ones.

**Live at https://pizza-party-wheat.vercel.app**

## Running it

Run it locally with `npm install` then `npm start` (http://localhost:4173). Tests: `npm test` (unit tests with node:test, then Playwright at desktop and phone sizes).

## Deploying

The Vercel project is connected to this repo, so every push to `main` deploys to production. Pull requests get a preview deployment (preview links need a Vercel login).

## Rules

- Make changes on a branch and open a pull request with the preview link. Don't merge into `main` until the owner says so: merging publishes the game.
- No attribution, anywhere: no `Co-Authored-By`, `Claude-Session` or "Generated with Claude" lines in commits, pull requests, comments or code. `.claude/settings.json` turns off the automatic ones.
- All art is drawn in code and all sound is synthesised in the browser. Don't add stock images, sounds, fonts other than Google Fonts, or anything copied from another game or brand.
- pizza-party.vercel.app (no suffix) belongs to someone else. Never link or test against it.
