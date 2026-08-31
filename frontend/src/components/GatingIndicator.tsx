interface GatingIndicatorProps {
  lighting: 'good' | 'low' | 'unknown';
  framing: 'ok' | 'missing' | 'unknown';
  stability: 'stable' | 'unstable' | 'unknown';
}

const LABELS: Record<string, string> = {
  good: '✅ Buena',
  low: '⚠️ Baja',
  ok: '✅ Correcto',
  missing: '⚠️ Manos no detectadas',
  stable: '✅ Estable',
  unstable: '⚠️ Inestable',
  unknown: '⏳ Evaluando…',
};

export default function GatingIndicator({ lighting, framing, stability }: GatingIndicatorProps) {
  return (
    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', marginTop: '0.5rem' }}>
      <span>Iluminación: {LABELS[lighting]}</span>
      <span>Encuadre: {LABELS[framing]}</span>
      <span>Estabilidad: {LABELS[stability]}</span>
    </div>
  );
}
