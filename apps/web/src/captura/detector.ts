import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

/** Punto normalizado de MediaPipe: x, y en [0, 1] de la imagen; z relativa a la muñeca. */
export interface PuntoNormalizado {
  x: number;
  y: number;
  z: number;
}

export interface DeteccionManos {
  manos: PuntoNormalizado[][];
  t: number;
}

export interface Detector {
  detectar(video: HTMLVideoElement, tMs: number): DeteccionManos;
  /** Versión registrada en cada intento (T-27): paquete + modelo. */
  version: string;
  delegado: "GPU" | "CPU";
  cerrar(): void;
}

const BASE = "/mediapipe";

/** Detector autoalojado (ADR-002): WASM y modelo del mismo origen; GPU con repliegue a CPU. */
export async function crearDetector(): Promise<Detector> {
  const registro = (await (await fetch(`${BASE}/version.json`)).json()) as {
    tasksVision: string;
    modelo: string;
  };
  const archivos = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
  const opciones = (delegate: "GPU" | "CPU") => ({
    baseOptions: { modelAssetPath: `${BASE}/hand_landmarker.task`, delegate },
    runningMode: "VIDEO" as const,
    numHands: 2,
  });
  let delegado: "GPU" | "CPU" = "GPU";
  let detector: HandLandmarker;
  try {
    detector = await HandLandmarker.createFromOptions(archivos, opciones("GPU"));
  } catch {
    delegado = "CPU";
    detector = await HandLandmarker.createFromOptions(archivos, opciones("CPU"));
  }
  return {
    version: `${registro.modelo}@tasks-vision-${registro.tasksVision}`,
    delegado,
    detectar(video, tMs) {
      const r = detector.detectForVideo(video, tMs);
      return {
        manos: r.landmarks.map((m) => m.map(({ x, y, z }) => ({ x, y, z }))),
        t: tMs / 1000,
      };
    },
    cerrar: () => detector.close(),
  };
}

/** Conexiones de la mano para dibujar el esqueleto (convención de MediaPipe). */
export const CONEXIONES: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];
