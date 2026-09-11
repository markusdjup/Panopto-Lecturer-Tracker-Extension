const DEFAULT_SETTINGS = { maxZoom: 2.2, smoothing: 0.15, verticalFocus: 0.5 };

const mainUi = document.getElementById('mainUi');
const noPanopto = document.getElementById('noPanopto');
const statusText = document.getElementById('statusText');
const toggleBtn = document.getElementById('toggleBtn');
const zoomSlider = document.getElementById('zoomSlider');
const zoomVal = document.getElementById('zoomVal');
const smoothSlider = document.getElementById('smoothSlider');
const vertSlider = document.getElementById('vertSlider');

let activeTabId = null;

function renderStatus(status, enabled) {
  const text = { off: 'OFF', searching: 'SEARCHING', tracking: 'ON', blocked: 'BLOCKED' }[status] || 'OFF';
  statusText.textContent = text;
  statusText.className = 'status ' + (enabled ? 'on' : 'off');
  toggleBtn.textContent = enabled ? 'Disable tracking' : 'Enable tracking';
  toggleBtn.classList.toggle('off', !enabled);
  toggleBtn.disabled = status === 'blocked' && !enabled;
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return showNotPanopto();
  activeTabId = tab.id;

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { target: 'content', type: 'get-state' });
  } catch {
    response = null;
  }

  if (!response || !response.found) return showNotPanopto();

  mainUi.style.display = '';
  noPanopto.style.display = 'none';
  renderStatus(response.status, response.enabled);

  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  zoomSlider.value = stored.maxZoom;
  zoomVal.textContent = Number(stored.maxZoom).toFixed(1);
  smoothSlider.value = stored.smoothing;
  vertSlider.value = stored.verticalFocus;
}

function showNotPanopto() {
  mainUi.style.display = 'none';
  noPanopto.style.display = '';
}

toggleBtn.addEventListener('click', async () => {
  if (!activeTabId) return;
  const enable = toggleBtn.classList.contains('off');
  const response = await chrome.tabs.sendMessage(activeTabId, {
    target: 'content',
    type: 'set-enabled',
    value: enable,
  });
  if (response) renderStatus(response.status, response.enabled);
});

zoomSlider.addEventListener('input', () => {
  zoomVal.textContent = Number(zoomSlider.value).toFixed(1);
  chrome.storage.local.set({ maxZoom: Number(zoomSlider.value) });
});

smoothSlider.addEventListener('input', () => {
  chrome.storage.local.set({ smoothing: Number(smoothSlider.value) });
});

vertSlider.addEventListener('input', () => {
  chrome.storage.local.set({ verticalFocus: Number(vertSlider.value) });
});

init();
