# Panopto Lecturer Tracker

(100% vibe-coded)

A Chrome extension that watches a Panopto lecture video, detects the lecturer
with an on-device ML model, and automatically zooms/pans the video to keep
them (and the board around them) in frame. A floating button on the video —
and the `Alt+Shift+T` shortcut — lets you instantly drop back to the full,
un-zoomed view (e.g. when the lecturer points somewhere off-screen) and
re-enable tracking again.

Everything runs locally in the browser. No video frames or data are sent
anywhere — detection uses [MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/object_detector)
(WASM) with a bundled EfficientDet-Lite0 model, run inside an extension
offscreen document.

## How it works

- **`content.js`** finds the Panopto `<video>` element, draws it into a small
  hidden canvas ~3x/sec, and asks the offscreen document where the lecturer
  is. It smooths the result and applies a CSS `matrix()` transform to the
  video element to zoom/pan.
- **`offscreen.js`** runs in a hidden extension page (not the Panopto page)
  so it isn't subject to Panopto's Content-Security-Policy — this is required
  for MediaPipe's WASM to run under Manifest V3. It runs the person detector
  on each frame it's sent and returns a bounding box.
- **`background.js`** is a small service worker that creates the offscreen
  document on demand and relays the keyboard shortcut.
- **`popup.js`** shows tracking status for the current tab and lets you tune
  max zoom / smoothing.

## Build

Requires Node.js (already installed here: check with `node -v`).

```
npm install   # already done
npm run build # bundles everything into dist/
```

Use `npm run watch` while developing — it rebuilds on save (reload the
extension in `chrome://extensions` after each change).

## Load it in Chrome

1. Go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `dist/` folder in this project.
4. Open a Panopto lecture video. You should see a small pill button appear
   in the top-right corner of the video.

## Matching your Panopto site

Panopto is usually self-hosted per institution (e.g.
`https://myschool.hosted.panopto.com/...` or `https://panopto.myschool.edu/Panopto/Pages/Viewer.aspx`).
The extension is pre-configured to match:

- `*.panopto.com`, `*.panopto.eu`
- any host at path `/Panopto/Pages/*` or `/Panopto/Podcast/*`

If your institution's viewer URL doesn't match one of these (check the
address bar on the Panopto viewer page), add another pattern to
`host_permissions` and `content_scripts[0].matches` in
`public/manifest.json`, then `npm run build` and reload the extension.

## Usage

- Click the floating button on the video, or press **Alt+Shift+T**, to turn
  tracking on/off.
- The button's dot is grey (off), yellow/pulsing (searching for the
  lecturer), or green (actively tracking).
- Use the extension's toolbar popup to adjust:
  - **max zoom** - how far in it's allowed to zoom.
  - **smoothing** - higher = slower, steadier movement; lower = snappier but
    more jittery.
  - **vertical focus** - the extension only tracks the lecturer
    *horizontally* (panning along the board); vertical framing is a fixed
    point you set once with this slider to match your camera's framing, since
    every room's camera angle/height is different. Open a tracked video,
    drag this slider until the blackboard is centered the way you want, and
    it'll stay there.
- If the lecturer walks off-screen or points somewhere outside the current
  zoomed crop, tracking will keep searching and zoom back out automatically
  after ~1.4s without a detection — or just hit the button/shortcut to bail
  out to full view immediately.

## Known limitations

- **Cross-origin video**: if Panopto serves video from a CDN without CORS
  headers permitting canvas access, the browser blocks reading video frames
  ("tainted canvas"). The button will show "Unavailable" in that case — this
  is a browser security restriction the extension can't work around.
- **Multiple camera feeds**: if a Panopto session has more than one video
  (e.g. podium cam + screen share), the extension picks the largest visible
  `<video>` element (or one whose id/class contains "primary"). If it picks
  the wrong one, that's the heuristic to adjust in `findPanoptoVideo()` in
  `src/content.js`.
- **First run latency**: the ~4.5MB model + WASM runtime load on first use
  per browser session (once the offscreen document is created), so the
  first "Enable tracking" click can take a second or two before status
  flips to "tracking".
- Tested against Manifest V3 / `chrome.offscreen` (Chrome 116+). Older Chrome
  versions aren't supported.
