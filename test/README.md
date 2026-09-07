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
