/* Определение формы лица в браузере: MediaPipe Face Landmarker, без ключей и сервера */

import { FaceLandmarker, FilesetResolver } from "./vision/vision_bundle.mjs";

let landmarkerPromise = null;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("./vision");
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "./vision/face_landmarker.task", delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
      });
    })();
  }
  return landmarkerPromise;
}

async function cpuLandmarker() {
  landmarkerPromise = null;
  return getLandmarker();
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function dist(a, b, w, h) {
  const dx = (a.x - b.x) * w;
  const dy = (a.y - b.y) * h;
  return Math.hypot(dx, dy);
}

async function analyze(dataUrl) {
  const img = await loadImage(dataUrl);
  let result;
  try {
    result = (await getLandmarker()).detect(img);
  } catch (err) {
    landmarkerPromise = cpuLandmarker();
    result = (await landmarkerPromise).detect(img);
  }
  const faces = result.faceLandmarks || [];
  if (!faces.length) return { ok: false, error: "Лицо не найдено на фото" };

  const p = faces[0];
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;
  const P = (i) => p[i];

  const height = dist(P(10), P(152), W, H);
  const width = dist(P(234), P(454), W, H);
  const jaw = dist(P(172), P(397), W, H);
  const forehead = dist(P(127), P(356), W, H);

  const ratio = height / width;
  const jawRatio = jaw / width;
  const foreheadRatio = forehead / width;

  let face;
  if (ratio >= 1.45) face = "long";
  else if (jawRatio >= 0.92 && foreheadRatio >= 0.86) face = "square";
  else if (foreheadRatio >= jawRatio + 0.06) face = "heart";
  else if (ratio <= 1.2) face = "round";
  else face = "oval";

  const clarity = Math.min(1, Math.abs(ratio - 1.3) * 0.5 + 0.55);
  return {
    ok: true,
    model: "face-landmarks",
    data: {
      face,
      hair: null,
      density: null,
      length: null,
      notes: `Форма лица определена по 478 точкам разметки: отношение высоты к ширине ${ratio.toFixed(2)}, `
        + `линия челюсти ${Math.round(jawRatio * 100)}%, лоб ${Math.round(foreheadRatio * 100)}%. `
        + "Тип и густоту волос мастер уточнит по фото.",
    },
    confidence: Math.round(clarity * 100) / 100,
    metrics: { ratio, jawRatio, foreheadRatio },
  };
}

window.LocalFace = { analyze, getLandmarker };
