const OFFSCREEN_URL = 'offscreen.html';
let creatingOffscreen = null;

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_URL)],
  });
  if (existing.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['WORKERS'],
    justification: 'Runs on-device ML person detection (MediaPipe/WASM) to track the lecturer in the video.',
  });
  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target === 'background' && message.type === 'ensure-offscreen') {
    ensureOffscreenDocument()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  return false;
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-tracking') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { target: 'content', type: 'toggle-tracking' }).catch(() => {});
});
