import type { FeedbackItem } from '../types/feedback';

const SEVERITY_COLOR: Record<string, string> = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44336',
};

export default function FeedbackCard({ item }: { item: FeedbackItem }) {
  const color = item.severity ? SEVERITY_COLOR[item.severity] : '#999';
  return (
    <div style={{ borderLeft: `4px solid ${color}`, padding: '0.5rem 0.75rem', marginBottom: '0.5rem', background: '#fafafa' }}>
      <p style={{ margin: 0 }}>{item.message}</p>
      <small style={{ color: '#888' }}>
        {item.category ?? 'general'}
        {item.notePosition !== undefined ? ` · nota #${item.notePosition}` : ''}
      </small>
    </div>
  );
}
