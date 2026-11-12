/**
 * Intento completo con cámara y micrófono simulados (datos SINTÉTICOS).
 *
 * La cámara simulada de Chromium no muestra manos y, por diseño, la práctica no arranca sin
 * ellas. Esta ayuda reemplaza, solo en la página de la prueba:
 * - la cámara por un teclado dibujado (Do3 a Do6);
 * - el micrófono por una escala de Do a manos juntas que suena cuando empieza la ejecución;
 * - el detector de la mano por uno simulado: cada índice baja sobre la tecla de su nota.
 * Todo lo demás es la app real: calibración, conteo, análisis en el teléfono y envío del intento.
 */
import { expect, type Page } from "@playwright/test";

const ANCHO = 640;
const ALTO = 360;
const IZQUIERDA = 40;
const DERECHA = 600;
const FRENTE = 300;
const NEGRAS = 200;
const PASOS_MAYOR = [2, 2, 1, 2, 2, 2, 1];

/** Escala de Do mayor de 2 octavas, subida y bajada, desde `inicio` (MIDI). */
function escala(inicio: number): number[] {
  const subida = [inicio];
  for (let i = 0; i < 14; i++) subida.push(subida.at(-1)! + PASOS_MAYOR[i % 7]!);
  return [...subida, ...subida.slice(0, -1).reverse()];
}

/** Teclas blancas de Do3 (48) a Do6 (84): su centro en píxeles del video. */
const BLANCAS = Array.from({ length: 37 }, (_, i) => 48 + i).filter((m) =>
  [0, 2, 4, 5, 7, 9, 11].includes(m % 12),
);
const ANCHO_BLANCA = (DERECHA - IZQUIERDA) / BLANCAS.length;
const centroDe = (midi: number) => IZQUIERDA + (BLANCAS.indexOf(midi) + 0.5) * ANCHO_BLANCA;

export interface Escena {
  intervalo: number;
  instantes: { t: number; midis: [number, number]; x: [number, number] }[];
}

/** Escala a manos juntas en octava, con la mano izquierda una octava abajo, a `bpm`. */
export function escena(bpm: number): Escena {
  const intervalo = 60 / (bpm * 4);
  const izquierda = escala(48);
  const derecha = escala(60);
  return {
    intervalo,
    instantes: derecha.map((md, k) => ({
      t: k * intervalo,
      midis: [izquierda[k]!, md],
      x: [centroDe(izquierda[k]!) / ANCHO, centroDe(md) / ANCHO],
    })),
  };
}

/** Lo que corre dentro de la página antes de la app (no puede usar nada de fuera). */
function instalar(e: Escena & { ancho: number; alto: number; frente: number; negras: number }) {
  const lienzo = document.createElement("canvas");
  lienzo.width = e.ancho;
  lienzo.height = e.alto;
  const ctx = lienzo.getContext("2d")!;
  const blancas = 22;
  const ancho = (600 - 40) / blancas;
  let cuadro = 0;
  const pintar = () => {
    ctx.fillStyle = "#6b6b6b";
    ctx.fillRect(0, 0, e.ancho, e.alto);
    ctx.fillStyle = "#f4f1ea";
    ctx.fillRect(40, 120, 560, e.frente - 120);
    ctx.fillStyle = "#111";
    for (let i = 0; i <= blancas; i++) ctx.fillRect(40 + i * ancho - 1, 120, 2, e.frente - 120);
    for (let i = 0; i < blancas; i++) {
      if ([2, 6].includes(i % 7)) continue;
      ctx.fillRect(40 + (i + 0.7) * ancho, 120, ancho * 0.6, e.negras - 120);
    }
    // Un punto que cambia: el flujo del lienzo solo emite fotogramas si algo se repinta.
    ctx.fillStyle = cuadro++ % 2 ? "#6b6b6b" : "#6c6c6c";
    ctx.fillRect(0, 0, 1, 1);
  };
  pintar();
  setInterval(pintar, 33);

  let audio: AudioContext | null = null;
  let destino: MediaStreamAudioDestinationNode | null = null;
  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (r) => {
    if (r?.video) return lienzo.captureStream(30);
    if (r?.audio) {
      audio = new AudioContext();
      destino = audio.createMediaStreamDestination();
      await audio.resume();
      return destino.stream;
    }
    return original(r);
  };

  let inicio: number | null = null;
  const w = window as unknown as { __tocarEscala: () => void };
  w.__tocarEscala = () => {
    if (!audio || !destino) throw new Error("El micrófono simulado no está activo");
    const base = audio.currentTime + 0.05;
    inicio = performance.now() + 50;
    for (const { t, midis } of e.instantes) {
      for (const midi of midis) {
        const f = 440 * 2 ** ((midi - 69) / 12);
        for (const [armonico, peso] of [
          [1, 0.3],
          [2, 0.15],
          [3, 0.075],
        ] as const) {
          const osc = audio.createOscillator();
          const g = audio.createGain();
          osc.frequency.value = f * armonico;
          g.gain.setValueAtTime(peso, base + t);
          // Caída de una cuerda de piano, como la síntesis del núcleo: e^(−6t).
          g.gain.setTargetAtTime(0, base + t, 1 / 6);
          osc.connect(g).connect(destino);
          osc.start(base + t);
          osc.stop(base + t + 1);
        }
      }
    }
  };

  // Una mano: la muñeca abajo, la palma y las puntas sobre el teclado; el índice en `x`.
  const mano = (x: number, z: number) => {
    const p = Array.from({ length: 21 }, () => ({ x, y: 0.86, z: 0 }));
    p[0] = { x, y: 0.95, z: 0 };
    p[5] = { x: x - 0.04, y: 0.84, z: 0 };
    p[17] = { x: x + 0.04, y: 0.84, z: 0 };
    p[4] = { x: x - 0.05, y: 0.8, z: 0 };
    p[8] = { x, y: 0.78, z };
    p[12] = { x: x + 0.02, y: 0.8, z: 0 };
    p[16] = { x: x + 0.035, y: 0.8, z: 0 };
    p[20] = { x: x + 0.05, y: 0.81, z: 0 };
    return p;
  };
  (
    globalThis as unknown as { __skilltrackDetectorSimulado: unknown }
  ).__skilltrackDetectorSimulado = {
    version: "simulado@e2e",
    detectar(tMs: number) {
      const primero = e.instantes[0]!;
      if (inicio === null) return [mano(primero.x[0], 0), mano(primero.x[1], 0)];
      const s = (tMs - inicio) / 1000;
      const k = Math.max(0, Math.min(e.instantes.length - 1, Math.round(s / e.intervalo)));
      const n = e.instantes[k]!;
      // El índice baja sobre la tecla en el instante de la nota.
      const baja = 0.03 * Math.exp(-(((s - n.t) / 0.04) ** 2));
      return [mano(n.x[0], baja), mano(n.x[1], baja)];
    },
  };
}

export async function simularDispositivos(page: Page, e: Escena): Promise<void> {
  await page.addInitScript(instalar, {
    ...e,
    ancho: ANCHO,
    alto: ALTO,
    frente: FRENTE,
    negras: NEGRAS,
  });
}

/** Toca el video en un punto dado en píxeles del video (object-fit: contain). */
async function tocar(page: Page, x: number, y: number): Promise<void> {
  const caja = (await page.locator(".capa-video").boundingBox())!;
  const escala = Math.min(caja.width / ANCHO, caja.height / ALTO);
  const ox = caja.x + (caja.width - ANCHO * escala) / 2;
  const oy = caja.y + (caja.height - ALTO * escala) / 2;
  await page.mouse.click(ox + x * escala, oy + y * escala);
}

/**
 * Recorre la práctica real: encuadre, micrófono, calibración, conteo, ejecución y resultado.
 * Devuelve el cuerpo del intento enviado al servidor.
 */
export async function intentoCompleto(
  page: Page,
  tareaId: number,
): Promise<Record<string, unknown>> {
  await page.goto(`/practicar/${tareaId}`);
  await expect(page.getByRole("heading", { name: "2. Prueba de micrófono" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Probar el micrófono" }).click();
  const continuar = page.getByRole("button", { name: "Continuar", exact: true });
  await expect(continuar).toBeEnabled({ timeout: 15_000 });
  await continuar.click();

  await expect(page.getByRole("heading", { name: "2. Calibra el teclado" })).toBeVisible();
  await tocar(page, IZQUIERDA, FRENTE);
  await tocar(page, DERECHA, FRENTE);
  await tocar(page, IZQUIERDA, NEGRAS);
  await tocar(page, DERECHA, NEGRAS);
  await page.getByRole("button", { name: "Confirmar" }).click();

  const envio = page.waitForRequest(
    (r) => r.url().endsWith("/api/intentos") && r.method() === "POST",
    { timeout: 90_000 },
  );
  await expect(page.locator("[data-fase=tocando]")).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => (window as unknown as { __tocarEscala: () => void }).__tocarEscala());
  await expect(page.locator("[data-fase=resultado]")).toBeVisible({ timeout: 40_000 });
  const cuerpo = (await envio).postDataJSON() as Record<string, unknown>;
  await expect(page.locator("[data-guardado]")).toHaveAttribute("data-guardado", "Guardado", {
    timeout: 30_000,
  });
  return cuerpo;
}
