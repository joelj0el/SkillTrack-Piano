// Overlay de landmarks de manos usando MediaPipe HandLandmarker (on-device).
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from '@mediapipe/tasks-vision';
import type { Landmark } from '../types';

const OVERLAY_FPS = 15;
const OVERLAY_INTERVAL_MS = 1000 / OVERLAY_FPS;

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

let handLandmarker: HandLandmarker | null = null;
let overlayRafId: number | null = null;
let lastFrameTime = 0;

export async function initHandLandmarker(): Promise<HandLandmarker> {
  if (handLandmarker) return handLandmarker;
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
  });
  return handLandmarker;
}

export function detectHands(videoElement: HTMLVideoElement, timestamp: number): HandLandmarkerResult | null {
  if (!handLandmarker) return null;
  return handLandmarker.detectForVideo(videoElement, timestamp);
}

export function drawLandmarksOnCanvas(landmarks: Landmark[][], canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const hand of landmarks) {
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 2;
    for (const [start, end] of HAND_CONNECTIONS) {
      const p1 = hand[start];
      const p2 = hand[end];
      if (!p1 || !p2) continue;
      ctx.beginPath();
      ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
      ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
      ctx.stroke();
    }
    ctx.fillStyle = '#ff5252';
    for (const point of hand) {
      ctx.beginPath();
      ctx.arc(point.x * canvas.width, point.y * canvas.height, 3, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

export async function startOverlay(videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement): Promise<void> {
  await initHandLandmarker();

  const loop = (time: number) => {
    if (time - lastFrameTime >= OVERLAY_INTERVAL_MS) {
      lastFrameTime = time;
      if (videoEl.videoWidth > 0) {
        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        const result = detectHands(videoEl, time);
        if (result) {
          drawLandmarksOnCanvas(result.landmarks as Landmark[][], canvasEl);
        }
      }
    }
    overlayRafId = requestAnimationFrame(loop);
  };
  overlayRafId = requestAnimationFrame(loop);
}

export function stopOverlay(): void {
  if (overlayRafId !== null) {
    cancelAnimationFrame(overlayRafId);
    overlayRafId = null;
  }
}
