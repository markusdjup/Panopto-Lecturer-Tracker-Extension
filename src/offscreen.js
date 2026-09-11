import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision';

let detectorPromise = null;

function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(chrome.runtime.getURL('wasm'));
      return ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: chrome.runtime.getURL('models/efficientdet_lite0.tflite'),
          delegate: 'CPU',
        },
        scoreThreshold: 0.3,
        maxResults: 5,
        runningMode: 'IMAGE',
        categoryAllowlist: ['person'],
      });
    })();
  }
  return detectorPromise;
}

async function detectPersonBbox(dataUrl) {
  const detector = await getDetector();
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const result = detector.detect(bitmap);
    const people = (result.detections || [])
      .filter((d) => d.categories?.[0]?.categoryName === 'person')
      .sort((a, b) => (b.categories[0].score ?? 0) - (a.categories[0].score ?? 0));

    if (people.length === 0) return null;

    const box = people[0].boundingBox;
    return {
      x: box.originX,
      y: box.originY,
      width: box.width,
      height: box.height,
      imageWidth: bitmap.width,
      imageHeight: bitmap.height,
      score: people[0].categories[0].score,
    };
  } finally {
    bitmap.close();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'offscreen' || message.type !== 'infer') return false;

  detectPersonBbox(message.dataUrl)
    .then((bbox) => sendResponse({ ok: true, bbox }))
    .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));

  return true;
});
