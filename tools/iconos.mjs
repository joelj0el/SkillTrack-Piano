// Genera los íconos PNG provisionales de la PWA (192 y 512 px) sin dependencias externas.
// Uso: node tools/iconos.mjs   → apps/web/public/iconos/icono-{192,512}.png
import { mkdirSync, writeFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { URL } from "node:url";
import { deflateSync } from "node:zlib";

const FONDO = [0x2f, 0x4f, 0xa8, 0xff];
const TECLA = [0xff, 0xff, 0xff, 0xff];

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo, datos) {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([longitud, cuerpo, crc]);
}

/** Fondo de color con tres teclas blancas; margen de seguridad para íconos "maskable". */
function pixel(x, y, lado) {
  const u = lado / 16;
  const enFranja = y >= 4 * u && y < 12 * u;
  const teclas = [
    [3.5, 5.5],
    [7, 9],
    [10.5, 12.5],
  ];
  return enFranja && teclas.some(([a, b]) => x >= a * u && x < b * u) ? TECLA : FONDO;
}

function png(lado) {
  const filas = [];
  for (let y = 0; y < lado; y++) {
    const fila = [0];
    for (let x = 0; x < lado; x++) fila.push(...pixel(x, y, lado));
    filas.push(Buffer.from(fila));
  }
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(lado, 0);
  cabecera.writeUInt32BE(lado, 4);
  cabecera.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque("IHDR", cabecera),
    bloque("IDAT", deflateSync(Buffer.concat(filas), { level: 9 })),
    bloque("IEND", Buffer.alloc(0)),
  ]);
}

const destino = new URL("../apps/web/public/iconos/", import.meta.url);
mkdirSync(destino, { recursive: true });
for (const lado of [192, 512]) writeFileSync(new URL(`icono-${lado}.png`, destino), png(lado));
