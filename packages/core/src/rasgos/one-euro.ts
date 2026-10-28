/**
 * Filtro One Euro (Casiez, Roussel y Vogel, 2012): suaviza con poco retardo. El corte se adapta a
 * la velocidad: quieto filtra mucho (menos temblor), rápido filtra poco (menos retardo).
 * El tiempo se inyecta (segundos): el núcleo no lee el reloj.
 */
export interface ParametrosOneEuro {
  /** Frecuencia de corte mínima (Hz). */
  corteMinimo: number;
  /** Cuánto sube el corte con la velocidad. */
  beta: number;
  /** Corte del filtro de la derivada (Hz). */
  corteDerivada: number;
}

export const ONE_EURO_POR_DEFECTO: ParametrosOneEuro = {
  corteMinimo: 1.0,
  beta: 0.007,
  corteDerivada: 1.0,
};

function alfa(corte: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * corte);
  return 1 / (1 + tau / dt);
}

export class FiltroOneEuro {
  private anterior: { t: number; x: number; dx: number } | null = null;

  constructor(private readonly p: ParametrosOneEuro = ONE_EURO_POR_DEFECTO) {}

  filtrar(t: number, x: number): number {
    if (this.anterior === null || t <= this.anterior.t) {
      this.anterior = { t, x, dx: 0 };
      return x;
    }
    const dt = t - this.anterior.t;
    const derivada = (x - this.anterior.x) / dt;
    const dx = this.anterior.dx + alfa(this.p.corteDerivada, dt) * (derivada - this.anterior.dx);
    const corte = this.p.corteMinimo + this.p.beta * Math.abs(dx);
    const filtrado = this.anterior.x + alfa(corte, dt) * (x - this.anterior.x);
    this.anterior = { t, x: filtrado, dx };
    return filtrado;
  }

  reiniciar(): void {
    this.anterior = null;
  }
}
