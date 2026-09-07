# Contact Sheet

Thirty-six chances, no take-backs. A camera for Android with a roll in it: thirty-six exposures, no
preview, no deleting and no gallery. A finished roll goes to the lab and comes back the next morning at
eight, developed, as a contact sheet you read with a loupe and mark with a grease pencil.

- **Site:** https://shayanmohd.github.io/contact-sheet/
- **Try it in a browser:** https://shayanmohd.github.io/contact-sheet/play/
- **Privacy policy:** https://shayanmohd.github.io/contact-sheet/privacy-policy.html

## How it is built

`web/` is the whole app: plain HTML, CSS and JavaScript, no build step, no framework, no dependencies and
no network calls. The font is self-hosted.

| file | what it holds |
| --- | --- |
| `js/mark.js` | the film edge in real 135 geometry, and the inline SVG icon set the app draws with |
| `js/stocks.js` | the six film stocks as numbers: per channel response curves, grain, halation, quirks |
| `js/film.js` | development. Curve lookup, synthesised grain, halation bloom, falloff, light leaks |
| `js/camera.js` | getUserMedia, the 2:3 crop of a 135 frame, torch, capture |
| `js/db.js` | IndexedDB blob store for negatives, developed frames and contact-sheet copies |
| `js/store.js` | the ledger: rolls, frames, settings, lab times. One `localStorage` key |
| `js/sound.js` | the shutter, the wind-on ratchet and the motor rewind, synthesised in WebAudio |
| `js/sheet.js` | the 6 by 6 grid, the loupe, the hand-drawn keeper circle |
| `js/export.js` | the contact sheet composite and the single frame card with its colophon |
| `js/app.js` | screens, navigation, the lab, settings, and `window.App` for the shell |

Frame images are far too large for `localStorage`, so they live in IndexedDB and `store.js` holds only the
record that points at them. Undeveloped frames are deleted the moment their roll finishes developing.

`android/` is a thin Kotlin WebView shell that serves `web/` from an app-private https origin via
`WebViewAssetLoader`, adds amplitude haptics, file export through the media store, the share sheet, and
the develop notification scheduler. It declares CAMERA, VIBRATE and POST_NOTIFICATIONS, and no INTERNET.
The web core is copied into the app's assets by the `syncWebAssets` Gradle task on every build.

`docs/` is the GitHub Pages site: landing page, privacy policy, and a playable copy of the app.

`store/` holds `icon.svg` and `feature.html`, which are the hand-written sources for the launcher icon and
the feature graphic, plus the screenshot spec and the listing copy. Render the graphics with
`node ../_shiptools/render-brand.js contact-sheet`. `store/scenes.js` and `store/build-shots.py` exist only
to give the store screenshots something photographic in the frames; they are not part of the app and never
ship inside it.

`test/` holds the drive scripts that were used to find and prove the bugs in this build. See
`test/README.md`.

## Build

```sh
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" ./gradlew bundleRelease
```

Signing reads `android/keystore.properties`, which is not in this repository.

## Screenshots

```sh
python3 store/build-shots.py
python3 -m http.server 8820 --directory web &
node ../_shiptools/shots.js store/shots.json
```
