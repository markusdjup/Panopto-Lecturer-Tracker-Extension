# Setup Guide: Panopto Lecturer Tracker

Full walkthrough from "I have a GitHub link" to "it's tracking a lecturer in
Chrome." Written for Windows; Mac/Linux steps are the same except where noted.

## What you need first

- **Google Chrome** (or another Chromium browser), version 116 or newer.
- **Node.js** (includes `npm`) — download from [nodejs.org](https://nodejs.org/)
  and run the installer if you don't already have it. Check by opening a
  terminal (PowerShell) and running:
  ```
  node -v
  npm -v
  ```
  If both print a version number, you're set.

You do **not** need Python, Git, or any browser extension development
experience.

## Step 1 — Get the code from GitHub

Pick one:

### Option A: Download the ZIP (easiest, no Git needed)

1. Go to the repository:
   https://github.com/markusdjup/Panopto-Lecturer-Tracker-Chrome-Extention
2. Click the green **Code** button → **Download ZIP**.
3. Find the downloaded `Panopto-Lecturer-Tracker-Chrome-Extention-main.zip`
   (usually in your `Downloads` folder), right-click it, and choose
   **Extract All...** → pick a destination (e.g. `Documents\Programmering`)
   → **Extract**.
4. You should now have a folder like
   `Panopto-Lecturer-Tracker-Chrome-Extention-main` containing `src/`,
   `public/`, `package.json`, etc.

### Option B: Clone with Git (if you already use Git)

```
git clone https://github.com/markusdjup/Panopto-Lecturer-Tracker-Chrome-Extention.git
```

## Step 2 — Install dependencies

Open a terminal in the project folder (in File Explorer, click the address
bar, type `powershell`, press Enter) and run:

```
npm install
```

This downloads the packages the build needs (esbuild, MediaPipe's vision
library) into a `node_modules` folder. Takes a few seconds to a minute.

## Step 3 — Build the extension

```
npm run build
```

This bundles the source into a ready-to-load `dist/` folder. You should see
output listing `content.js`, `background.js`, `offscreen.js`, `popup.js` and
"Build complete -> dist/". If it errors, re-run `npm install` first and make
sure you're in the project's root folder (the one with `package.json`).

## Step 4 — Load it into Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (toggle, top-right corner).
3. Click **Load unpacked**.
4. In the file picker, select the `dist` folder (not the project root, not
   a zip — the actual `dist` folder created in Step 3).
5. "Panopto Lecturer Tracker" should now appear in your extensions list with
   no errors. Pin it to the toolbar if you'd like (puzzle-piece icon →
   pin).

## Step 5 — Check it matches your Panopto site

Panopto is usually hosted per-institution, so open the Panopto video you
want to test and check the address bar. The extension already matches:

- any `*.panopto.com` or `*.panopto.eu` address
- any site with `/Panopto/Pages/...` or `/Panopto/Podcast/...` in the URL

If your school's Panopto URL doesn't look like either of those, open
`dist/manifest.json`, add your domain to both the `host_permissions` and
`content_scripts[0].matches` arrays (copy the existing pattern style), save,
then go back to `chrome://extensions` and click the reload icon on the
extension. (If you rebuild with `npm run build` afterwards, make that same
edit in `public/manifest.json` instead, so it isn't overwritten.)

## Step 6 — Use it

1. Open a Panopto lecture recording. A small pill-shaped button should
   appear in the top-right corner of the video.
2. Click it (or press **Alt+Shift+T**) to turn tracking on. The dot turns
   yellow ("searching") then green ("tracking") once the lecturer is found.
3. Click the extension's toolbar icon to open its settings popup:
   - **Max zoom** — how far in it's allowed to zoom.
   - **Smoothing** — higher = steadier/slower movement, lower = snappier
     but more jittery.
   - **Vertical focus** — drag this while tracking is on until the
     blackboard is framed the way you want; it only needs to be set once
     per camera setup.
4. If the lecturer walks out of frame, the view holds its last position
   (dot turns yellow) and resumes once they're back — it won't zoom out on
   its own. Hit the button/shortcut any time to snap back to full view.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm` / `node` not recognized | Node.js isn't installed (or you need to restart the terminal after installing it). |
| `npm run build` fails | Run `npm install` again; make sure your terminal's current folder is the project root (`ls` should show `package.json`). |
| "Load unpacked" is greyed out | Developer mode toggle isn't on. |
| No button appears on the video | The page's URL doesn't match the extension's patterns (see Step 5), or the page hasn't finished loading — wait a moment or reload the tab. |
| Button says "Unavailable" | Panopto is serving video from a CDN that blocks the extension from reading video frames (a browser security restriction) — not fixable from the extension side. |
| Tracking locks onto the wrong video | If the page has more than one video (e.g. podium cam + screen share), the extension guesses the largest one. See "Multiple camera feeds" in `README.md` for the heuristic to adjust. |

## Updating later

If you re-download or `git pull` a newer version of the code, repeat Steps
2–4 (`npm install`, `npm run build`, then click the reload icon on the
extension in `chrome://extensions` — no need to remove and re-add it).
