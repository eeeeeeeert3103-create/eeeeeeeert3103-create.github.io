/* Определение формы лица в браузере: MediaPipe Face Landmarker, без ключей и сервера */

import { FaceLandmarker, ImageSegmenter, FilesetResolver } from "./vision/vision_bundle.mjs";

let landmarkerPromise = null;
let segmenterPromise = null;

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

async function getSegmenter() {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks("./vision");
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "./vision/selfie_multiclass.tflite", delegate: "CPU" },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    })();
  }
  return segmenterPromise;
}

function hairTexture(img, mask) {
  const W = mask.width, H = mask.height;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, W, H);
  const px = ctx.getImageData(0, 0, W, H).data;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
  }
  let sum = 0, count = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (mask.data[y * W + x] !== 1) continue;
      const gx = Math.abs(lum[y * W + x + 1] - lum[y * W + x - 1]);
      const gy = Math.abs(lum[(y + 1) * W + x] - lum[(y - 1) * W + x]);
      sum += gx + gy; count++;
    }
  }
  return count ? sum / count : 0;
}

function hairMetrics(mask, fw, fh, landmarks) {
  const { width, height, data } = mask;
  const W = width, H = height;
  let count = 0, perimeter = 0, minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[y * W + x] === 1) {
        count++;
        const nb = [[1,0],[-1,0],[0,1],[0,-1]];
        for (const [dx, dy] of nb) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H || data[ny * W + nx] !== 1) { perimeter++; break; }
        }
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!count) return null;

  const xs = landmarks.map((p) => p.x * W), ys = landmarks.map((p) => p.y * H);
  const faceW = Math.max(...xs) - Math.min(...xs);
  const faceH = Math.max(...ys) - Math.min(...ys);
  const chinY = ys[152];
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;

  let below = 0;
  for (let y = Math.ceil(chinY); y < H; y++) {
    for (let x = Math.max(0, Math.floor(cx - 0.7 * faceW)); x < Math.min(W, Math.ceil(cx + 0.7 * faceW)); x++) {
      if (data[y * W + x] === 1) below++;
    }
  }

  const cols = [];
  for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
    for (let y = 0; y < H; y++) {
      if (data[y * W + x] === 1) { cols.push(y); break; }
    }
  }
  let rough = 0;
  if (cols.length > 8) {
    const smooth = cols.map((v, i) => {
      const a = cols[Math.max(0, i - 2)], b = cols[Math.min(cols.length - 1, i + 2)];
      return (a + b) / 2;
    });
    const diffs = cols.map((v, i) => Math.abs(v - smooth[i]));
    const mean = diffs.reduce((s2, v) => s2 + v, 0) / diffs.length;
    rough = mean / faceH;
  }

  const circularity = (perimeter * perimeter) / (4 * Math.PI * count);
  return {
    circularity,
    areaRatio: count / (faceW * faceH),
    belowRatio: below / (faceW * faceH),
    rough,
    hairWidth: (maxX - minX) / faceW,
    hairHeight: (maxY - minY) / faceH,
  };
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
  let hair = null;
  if (faces.length) {
    try {
      const seg = await getSegmenter();
      const out = seg.segment(img);
      if (out && out.categoryMask) {
        const m = out.categoryMask;
        const maskObj = { width: m.width, height: m.height, data: m.getAsUint8Array() };
        hair = hairMetrics(maskObj, img.naturalWidth, img.naturalHeight, faces[0]);
        hair.texture = hairTexture(img, maskObj);
        m.close && m.close();
      }
    } catch (err) { hair = null; window.__hairErr = String(err && err.message || err); }
  }
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
  else if (jawRatio >= 0.9 && ratio <= 1.38) face = "square";
  else if (foreheadRatio - jawRatio >= 0.3 && jawRatio <= 0.78) face = "heart";
  else if (ratio <= 1.24 && jawRatio >= 0.78) face = "round";
  else face = "oval";

  const clarity = Math.min(1, Math.abs(ratio - 1.3) * 0.5 + 0.55);
  let hairType = null, density = null, length = null, hairNote = "";
  if (hair) {
    const wh = hair.hairWidth / Math.max(0.01, hair.hairHeight);
    length = hair.belowRatio > 0.30 ? "long" : hair.belowRatio > 0.06 ? "medium" : "short";
    density = hair.areaRatio > 2.2 ? "thick" : hair.areaRatio > 0.8 ? "medium" : "thin";
    hairType = length === "short" ? "straight"
      : (wh >= 1.25 && hair.areaRatio >= 2.2) ? "curly"
      : wh >= 1.0 ? "wavy" : "straight";
    hairNote = ` Волосы: площадь ${hair.areaRatio.toFixed(1)} от лица, ниже подбородка ${hair.belowRatio.toFixed(2)}, `
      + `ширина/высота волос ${ (hair.hairWidth / Math.max(0.01, hair.hairHeight)).toFixed(2) }.`;
  }

  return {
    ok: true,
    model: "face-landmarks + hair-segmentation",
    data: {
      face,
      hair: hairType,
      density,
      length,
      notes: `Форма лица по 478 точкам: высота/ширина ${ratio.toFixed(2)}, челюсть ${Math.round(jawRatio * 100)}%, `
        + `лоб ${Math.round(foreheadRatio * 100)}%.` + hairNote,
    },
    confidence: Math.round(clarity * 100) / 100,
    metrics: { ratio, jawRatio, foreheadRatio, hair },
  };
}

window.LocalFace = { analyze, getLandmarker, getSegmenter };
