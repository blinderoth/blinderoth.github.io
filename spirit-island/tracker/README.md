# Spirit Island Memoir (campaign tracker) v1.0

A static web page that replaces the Google Sheets tracker. No build step and no server code. Open `index.html` through any static host (GitHub Pages works) or run `python -m http.server` in this folder.

## Where your data lives
- Matches, players and ownership are saved in the browser (localStorage key `spirit_island_campaign_v2`). Clearing site data erases them.
- Settings > Download JSON backup after each game night. Import the same file on another device.
- `data/campaign_data.json` and `js/default_data.js` hold the same seed data (reference data plus the matches as of the 2026-11-15 save). A new browser starts from this seed.
- Ownership follows the expansion: switch an expansion on in Settings and its spirits, adversaries and scenarios follow.

## Folder map
- `index.html`: markup for all six tabs
- `css/`: `styles.css` (base), `botanical_zen.css` (the three themes), `spirit_animations.css`, `tracker_polish.css` (layout fixes, phone layout, achievement cards, print)
- `js/analytics.js`: all calculations (score, difficulty, achievements, stats)
- `js/core/`: shared state, loading/saving/merging, navigation and themes
- `js/views/`: one file per tab (`dashboard`, `spirit_dossier`, `adversaries`, `matches`, `achievements` + `achievements_cards`, `codex`, `settings`) and `print.js`
- `js/main.js`: starts the app. The files in `js/core` and `js/views` are plain scripts that share globals, so keep the load order in `index.html`.
- `assets/`: spirit, aspect, adversary, scenario and element images (all local)
- `tests/`: run `node tests/run.js`, or open `tests/index.html` in the browser
- `mockups/`, `build_seed_data.py`: old design studies and the old seed script. Kept on request. Do not run `build_seed_data.py`: it still points to the old image links and would overwrite the local image paths.

## When the seed data changes
Edit `data/campaign_data.json`, then write the same content into `js/default_data.js` (`window.DEFAULT_CAMPAIGN_DATA = {...};`). `node tests/run.js` fails if the two files differ.

## Achievement effects
Cards show a one-time reveal when they scroll into view. New milestones are compared with what you last saw (`si_ach_seen` in localStorage), so a win logged on the Games tab plays its effect when you next open the Achievements tab. The first visit never replays history. Effects respect "reduce motion".

## Print
Settings > Print summary (A4), or Ctrl+P anywhere. It prints one to two pages and follows the Player Stats filter.

## After uploading to GitHub
Hard refresh (Ctrl+Shift+R). Asset links carry `?v=` numbers; bump them in `index.html` when you change a file.

## Tabs (round 2)

- **Overview**: totals, awakened spirits, adversary clearance, council of spirits.
- **Adversaries**: Invader Threat Matrix only.
- **Games**: collapsed expedition generator, the log, and a collapsed "Why we lose: loss autopsy" panel.
- **Achievements**: "Mastery" (one card per spirit, with a Breakdown drop-down for general milestones, adversary levels, scenarios and aspects) and "Spirit Synergy" (a spirit-by-spirit grid).
- **Spirits**: compact spirit cards, Pantheon Dossier, adversaries and scenarios codex.
- **Settings**: backup, artwork refit, print summary.

The session count is always computed from the saved matches. Old browser data is migrated on load.
