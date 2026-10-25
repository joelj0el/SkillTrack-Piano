import { Badge } from './ui';

interface GatingIndicatorProps {
  lighting: 'good' | 'low' | 'unknown';
  framing: 'ok' | 'missing' | 'unknown';
  stability: 'stable' | 'unstable' | 'unknown';
}

const STATE: Record<string, { text: string; tone: 'success' | 'warning' | 'neutral' }> = {
  good: { text: 'Buena', tone: 'success' },
  low: { text: 'Baja', tone: 'warning' },
  ok: { text: 'Correcto', tone: 'success' },
  missing: { text: 'Manos no detectadas', tone: 'warning' },
  stable: { text: 'Estable', tone: 'success' },
  unstable: { text: 'Inestable', tone: 'warning' },
  unknown: { text: 'Evaluando…', tone: 'neutral' },
};

export default function GatingIndicator({ lighting, framing, stability }: GatingIndicatorProps) {
  const items = [
    ['Iluminación', lighting],
    ['Encuadre', framing],
    ['Estabilidad', stability],
  ] as const;
  return (
    <div className="gating" aria-live="polite">
      {items.map(([name, value]) => (
        <Badge key={name} tone={STATE[value].tone}>
          {name}: {STATE[value].text}
        </Badge>
      ))}
    </div>
  );
}
