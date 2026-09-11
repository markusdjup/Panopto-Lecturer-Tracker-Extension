const DEFAULT_SETTINGS = { maxZoom: 2.2, smoothing: 0.15, verticalFocus: 0.5 };
const CAPTURE_WIDTH = 320;
const INFER_INTERVAL_MS = 350;
const MISS_LIMIT = 4;
const PADDING_FACTOR = 3.0; // how much wider than the person's bbox the visible crop should be
const MIN_CX_DELTA = 0.015; // ignore horizontal jitter smaller than this (normalized frame width)

let settings = { ...DEFAULT_SETTINGS };

const state = {
  video: null,
  wrap: null,
  button: null,
  dot: null,
  label: null,
  enabled: false,
  status: 'off', // off | searching | tracking | blocked
  timer: null,
  missCount: 0,
  captureCanvas: null,
  captureCtx: null,
  smoothed: null, // {cx, cy, s}
  ensuredOffscreen: false,
  inflight: false,
};

function loadSettings() {
  chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
    settings = { ...DEFAULT_SETTINGS, ...stored };
  });
}
loadSettings();

chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.maxZoom) settings.maxZoom = changes.maxZoom.newValue;
  if (changes.smoothing) settings.smoothing = changes.smoothing.newValue;
  if (changes.verticalFocus) settings.verticalFocus = changes.verticalFocus.newValue;
});

function findPanoptoVideo() {
  const videos = Array.from(document.querySelectorAll('video')).filter(
    (v) => v.offsetWidth > 80 && v.offsetHeight > 80
  );
  if (videos.length === 0) return null;

  const primary = videos.find((v) => /primary/i.test(v.id) || /primary/i.test(v.className));
  if (primary) return primary;

  return videos.sort((a, b) => b.offsetWidth * b.offsetHeight - a.offsetWidth * a.offsetHeight)[0];
}

function setStatus(status) {
  state.status = status;
  if (!state.button) return;
  state.button.classList.toggle('plt-active', status === 'tracking');
  state.button.classList.toggle('plt-searching', status === 'searching');
  const labelText = {
    off: 'Track lecturer',
    searching: 'Searching…',
    tracking: 'Tracking',
    blocked: 'Unavailable',
  }[status];
  state.label.textContent = labelText;
  state.button.title =
    status === 'blocked'
      ? "Can't read video frames from this player (cross-origin). Tracking disabled."
      : 'Toggle lecturer tracking (Alt+Shift+T)';
}

function resetTransform() {
  if (state.video) state.video.style.transform = '';
  state.smoothed = null;
}

function applyTransform(cx, cy, s) {
  const video = state.video;
  const dispW = video.clientWidth;
  const dispH = video.clientHeight;
  if (!dispW || !dispH) return;

  let tx = dispW * (0.5 - s * cx);
  let ty = dispH * (0.5 - s * cy);
  tx = Math.min(0, Math.max(dispW * (1 - s), tx));
  ty = Math.min(0, Math.max(dispH * (1 - s), ty));

  video.style.transform = `matrix(${s},0,0,${s},${tx},${ty})`;
}

function ensureOffscreen() {
  if (state.ensuredOffscreen) return Promise.resolve();
  return chrome.runtime.sendMessage({ target: 'background', type: 'ensure-offscreen' }).then(() => {
    state.ensuredOffscreen = true;
  });
}

function captureFrame() {
  const video = state.video;
  const vw = video.videoWidth || video.clientWidth;
  const vh = video.videoHeight || video.clientHeight;
  if (!vw || !vh) return null;

  if (!state.captureCanvas) {
    state.captureCanvas = document.createElement('canvas');
    state.captureCtx = state.captureCanvas.getContext('2d', { willReadFrequently: true });
  }
  const scale = CAPTURE_WIDTH / vw;
  const cw = CAPTURE_WIDTH;
  const ch = Math.round(vh * scale);
  state.captureCanvas.width = cw;
  state.captureCanvas.height = ch;
  state.captureCtx.drawImage(video, 0, 0, cw, ch);
  return state.captureCanvas.toDataURL('image/jpeg', 0.6);
}

async function trackingTick() {
  if (!state.enabled || state.inflight) return;
  state.inflight = true;
  try {
    const dataUrl = captureFrame();
    if (!dataUrl) return;

    await ensureOffscreen();
    const response = await chrome.runtime.sendMessage({ target: 'offscreen', type: 'infer', dataUrl });

    if (!response?.ok) {
      setStatus('blocked');
      stopTracking(false);
      return;
    }

    const bbox = response.bbox;
    if (!bbox) {
      state.missCount += 1;
      if (state.missCount >= MISS_LIMIT) {
        // Hold the last zoomed-in view (don't zoom out) - just wait for the
        // lecturer to reappear in roughly the same spot.
        setStatus('searching');
      }
      return;
    }

    state.missCount = 0;
    setStatus('tracking');

    const nx = bbox.x / bbox.imageWidth;
    const nw = bbox.width / bbox.imageWidth;

    const cx = nx + nw / 2;

    const visibleFrac = Math.min(1, Math.max(1 / settings.maxZoom, nw * PADDING_FACTOR));
    const targetS = 1 / visibleFrac;

    if (!state.smoothed) {
      state.smoothed = { cx, s: targetS };
    } else {
      const a = settings.smoothing;
      if (Math.abs(cx - state.smoothed.cx) >= MIN_CX_DELTA) {
        state.smoothed.cx += a * (cx - state.smoothed.cx);
      }
      state.smoothed.s += a * (targetS - state.smoothed.s);
    }

    applyTransform(state.smoothed.cx, settings.verticalFocus, state.smoothed.s);
  } catch (err) {
    console.warn('[Panopto Lecturer Tracker] tracking tick failed', err);
  } finally {
    state.inflight = false;
  }
}

function startTracking() {
  if (state.timer) return;
  state.enabled = true;
  state.missCount = 0;
  setStatus('searching');
  state.timer = setInterval(trackingTick, INFER_INTERVAL_MS);
  trackingTick();
}

function stopTracking(resetView = true) {
  state.enabled = false;
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  if (resetView) {
    resetTransform();
    setStatus('off');
  }
}

function toggleTracking() {
  if (state.status === 'blocked') return;
  if (state.enabled) stopTracking(true);
  else startTracking();
}

function setupUI(video) {
  if (state.video === video && video.isConnected) return;

  cleanup();
  state.video = video;

  const wrap = document.createElement('div');
  wrap.className = 'plt-video-wrap';
  video.parentNode.insertBefore(wrap, video);
  wrap.appendChild(video);
  state.wrap = wrap;

  const button = document.createElement('button');
  button.className = 'plt-toggle-btn';
  button.type = 'button';
  const dot = document.createElement('span');
  dot.className = 'plt-dot';
  const label = document.createElement('span');
  label.className = 'plt-label';
  button.appendChild(dot);
  button.appendChild(label);
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTracking();
  });
  wrap.appendChild(button);

  state.button = button;
  state.dot = dot;
  state.label = label;
  setStatus('off');
}

function cleanup() {
  stopTracking(false);
  if (state.button) state.button.remove();
  if (state.wrap && state.video && state.wrap.parentNode) {
    resetTransform();
    state.wrap.parentNode.insertBefore(state.video, state.wrap);
    state.wrap.remove();
  }
  state.video = null;
  state.wrap = null;
  state.button = null;
}

function tryInit() {
  const video = findPanoptoVideo();
  if (video) setupUI(video);
}

tryInit();
const observer = new MutationObserver(() => tryInit());
observer.observe(document.body, { childList: true, subtree: true });
setInterval(tryInit, 2000);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'content') return false;

  if (message.type === 'toggle-tracking') {
    toggleTracking();
    sendResponse({ ok: true, enabled: state.enabled, status: state.status });
    return false;
  }

  if (message.type === 'get-state') {
    sendResponse({
      found: !!state.video,
      enabled: state.enabled,
      status: state.status,
      settings,
    });
    return false;
  }

  if (message.type === 'set-enabled') {
    if (message.value) startTracking();
    else stopTracking(true);
    sendResponse({ ok: true, enabled: state.enabled, status: state.status });
    return false;
  }

  return false;
});
