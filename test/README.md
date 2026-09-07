# Contact Sheet drive scripts

Serve the app and run each one:

```sh
python3 -m http.server 8820 --directory web
node ../_shiptools/drive.js http://127.0.0.1:8820/index.html test/<script>.js --out test/shots
```

| script | what it proves |
|---|---|
| `01-happy.js` | first run, the covenant, the shelf, a stock, loading, shooting real frames through the app's own capture path, nothing developed on screen, handing in with a push, the lab, the sheet, a keeper, settings |
| `02-shell.js` | persistence across a reload and in a second tab, safe areas at `--sat: 48px` and `--sab: 34px` on every screen, `App.back()` on every nested screen and `false` at the root, modal back, `onPause` / `onResume`, the notification schedule |
| `03-upgrade.js` | a device seeded exactly as the shipped 1.0.0 wrote it, in `localStorage` and in IndexedDB, then loaded under this build: settings, rolls, frames, keepers, push, share marks, sequence, blobs, and an old roll developing under the new code |
| `04-edges.js` | double taps on every primary button, the finished roll, backing out of the rewind sheet, an unexposed roll, the 20:00 lab cut-off, ninety rolls against the 64 notification cap, both export paths, deleting a roll |
| `05-motion.js` | the whole path again with `--reduced-motion`: the wind-on still shows real progress, the grease pencil, the safelight and the counter all keep their shape |
| `06-light.js` | a light system theme does not bleach a control on a dark-only app |
| `07-look.js` | every screen and state on one populated device, for looking at |

`test/shots/` is gitignored. A clean run exits 0 and prints no page errors.

## Review pass

The `review-*` scripts are the independent second pass, written without trusting the first.
They write into `test/review-shots/`, which is also gitignored.

| script | what it proves |
|---|---|
| `review-01-happy.js` | first run through every screen and every stock, real captures, a reload mid roll, developing, the loupe, a keeper, the archive, settings, and a second tab |
| `review-02-shell.js` | `App.back()` from every screen and from a modal, false only at the root, no growth after wandering, `onPause` / `onResume`, the notification schedule under 90 rolls at the lab, and `--sat: 48px` / `--sab: 34px` on every screen and modal at rest and scrolled to the end |
| `review-03-upgrade.js` | a device seeded by hand in the exact shape the 1.0.0 store wrote, `localStorage` and IndexedDB together, opened under this build: settings, sequence, rolls, frames, keepers, push, discreet, the shared mark, the blobs, and an overdue roll developing |
| `review-04-contrast.js` | WCAG AA measured off the rendered pixels: each screen is shot twice, once with every glyph transparent, so gradients, film boxes and the accent button are judged as drawn |
| `review-05-edges.js` | triple taps on every button that costs something, the wind-on showing real progress, backing out of the rewind sheet, handing in twice, and the drawn empty states surviving reduced motion |

```sh
node ../_shiptools/drive.js http://127.0.0.1:8920/index.html test/review-05-edges.js --out test/review-shots --reduced-motion
```
