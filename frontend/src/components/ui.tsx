// Componentes base de la guía de estilo v0. Toda pantalla usa Loading/ErrorState/
// EmptyState para cumplir la regla "toda pantalla tiene estado de error y vacío".
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { IconAlert, IconChevronLeft, IconInbox } from './icons';
import { initials } from '../lib/format';

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <Link to={back.to} className="back-link">
            <IconChevronLeft width={16} height={16} /> {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </header>
  );
}

export function Loading({ rows = 3, label }: { rows?: number; label?: string }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only" style={{ position: 'absolute', left: -9999 }}>
        {label ?? 'Cargando…'}
      </span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <div className="state-icon">
        <IconAlert />
      </div>
      <h3>No pudimos cargar esto</h3>
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
  icon,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="state">
      <div className="state-icon">{icon ?? <IconInbox />}</div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

/** Envuelve el patrón carga → error → vacío → contenido. */
export function AsyncContent<T>({
  state,
  isEmpty,
  empty,
  children,
  rows,
}: {
  state: { data: T | null; loading: boolean; error: string | null; reload: () => void };
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  children: (data: T) => ReactNode;
  rows?: number;
}) {
  if (state.loading && state.data === null) return <Loading rows={rows} />;
  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (state.data === null) return null;
  if (isEmpty?.(state.data)) return <>{empty}</>;
  return <>{children(state.data)}</>;
}

export function Badge({
  tone = 'neutral',
  plain,
  children,
}: {
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brass';
  plain?: boolean;
  children: ReactNode;
}) {
  return <span className={`badge ${tone === 'neutral' ? '' : tone} ${plain ? 'plain' : ''}`}>{children}</span>;
}

export function Avatar({ name, size }: { name: string | null | undefined; size?: 'lg' }) {
  return (
    <span className={`avatar ${size ?? ''}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: K; label: string; count?: number }[];
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={tab.key === value}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
