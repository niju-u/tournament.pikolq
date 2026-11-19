# Pickleball Tournaments (sponsored by Pickle sa Balay)

Standalone tournament manager for singles & doubles with **Single Elimination**, **Double Elimination** and
**Round Robin** (pools, optionally followed by a single- or double-elimination playoff).
Plain HTML, CSS and vanilla JavaScript — no build step, no frameworks, no dependencies.
Independent of the court booking system; the colour palette, brand mark and "Sponsored by" badge match the
Pickleball Open Play (queueing) app. The layout and motion follow the JestinPortfolio site: Manrope + Plus Jakarta Sans,
pill buttons that lift, dark hero bands with floating orbs, scroll-reveal sections, count-up stats, a hamburger menu
on tablets/phones and a dark footer (`js/motion.js` handles reveal and count-up; all motion respects reduced-motion).

## Run

Open `index.html` through any static web server (e.g. Laragon, or `python -m http.server` in this folder).
Data is saved in the browser's LocalStorage (`psb-tournaments`). Use **Tournaments → Export backup** to save a JSON copy
and **Import** to restore it or move it to another browser.

## Deploy (GitHub Pages → tournament.pikolq.run.place)

Live at **https://tournament.pikolq.run.place**, served by GitHub Pages like the sister site (pikolq.run.place).

- `CNAME` (repo root) holds the custom domain `tournament.pikolq.run.place` — keep it in the repo.
- GitHub repo → **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`.
  Custom domain = `tournament.pikolq.run.place`, then tick **Enforce HTTPS** once the certificate is issued.
- DNS (DNSExit, zone `pikolq.run.place`): a **CNAME** record, host `tournament` → `<github-user>.github.io`.
- To publish changes: commit and push to `main`; Pages redeploys in about a minute. Bump the `?v=` numbers in
  `index.html` when CSS/JS changes so browsers fetch the new files.
- Each domain keeps its own browser storage: tournaments made on localhost don't appear on the live site.
  Move them with **Export backup** → **Import**.

## Structure

```
index.html                 App shell (header, nav, sponsor badge, script order)
css/style.css              Tokens, layout, shared components, responsive rules
css/bracket.css            Bracket grid + connectors, match cards, double-elim layout, score modal, champion overlay
css/fx.css                 Pixel-wipe page transition, highlighter sweep, stepped counters, marching "next match" lines
css/pixel.css              Pixel theme for the whole app (class "px-ui" on <html>): square corners, hard shadows,
                           Pixelify Sans, pixel-grid heroes; home-only court and scoreboard under .home-px
js/utils.js                Helpers (escaping, dates, FLIP animation, prefs)
js/icons.js                Inline SVG icons + trophy illustration
js/bracket-engine.js       Single elimination: seeding, BYEs, results, cascades, swaps
js/engines/double-elim.js  Double elimination: Winners/Losers brackets, Grand Final + optional reset
js/engines/round-robin.js  Round robin: pools, schedule, standings + tiebreaks, playoff built from the standings
js/engines/registry.js     Format → engine lookup (PSB.engineFor)
js/model.js                Names, validation, derived tournament status, format list
js/store.js                LocalStorage persistence (copy-on-write updates), backup import/export
js/ui.js                   Modals, confirm dialogs, toasts
js/components.js           Shared HTML: tournament cards, match cards, champion card
js/champion.js             Champion presentation + confetti
js/match-modal.js          Score entry / edit / reset / swap participants
js/views/*.js              Dashboard, list, create form, participants, bracket, settings, tournament shell
js/app.js                  Hash router
```

## How the brackets work

- Bracket size is the next power of two; standard seeding keeps seeds 1 and 2 apart until the final.
- BYEs go to the top seeds and advance automatically.
- Later slots are always derived from earlier results (`sync()` in each engine). Changing or resetting a result
  previews which later results it invalidates and asks for confirmation before clearing them.

### Double elimination

- A first loss drops a player into the Losers bracket; a second loss eliminates them.
- Losers-bracket rounds alternate: Losers-bracket players play each other, then newly dropped players join.
  Dropped players are spread in reverse order to avoid instant rematches.
- BYEs carry through: a Winners-bracket BYE has no loser, so the matching Losers-bracket side is a BYE too.
- Grand Final: Winners champion vs Losers champion. With **bracket reset** on (default), if the Losers-bracket side wins,
  a deciding second match is played. Matches: 2n−2, or 2n−1 when the reset is played. Minimum 4 entrants.

### Round robin

- Options (Create / Settings): number of **pools** (1–8), how many **advance** from each pool (none, or top 1–4),
  and the **playoff format** (single or double elimination; double needs 4+ qualifiers, otherwise single is used).
- Entrants are split into pools in snake order by seed (1→A, 2→B, …, then back), so pools are balanced.
  Everyone plays everyone in their pool once; with an odd pool size one entrant sits out each round.
- Standings: wins, then head-to-head among the tied entrants, then point difference, then points scored, then seed.
- With no playoff (one pool), the best record is champion. Several pools always need a playoff.
- The playoff is drawn automatically when the last pool match is scored: pool winners are seeded first (best record
  first), then runners-up, and so on, with same-pool first-round meetings avoided. Playoff match numbers continue
  after the pool matches.
- Changing a pool result after the playoff exists rebuilds the playoff if the qualifiers or their order change; the
  score dialog lists any playoff results that would be cleared and asks first.

## Adding another format

Write an engine with the same interface as `js/engines/double-elim.js` (generate, setResult, clearResult, preview,
stages, destinations, champion, …), register it in `js/engines/registry.js`, and add it to `PSB.model.FORMATS`.
