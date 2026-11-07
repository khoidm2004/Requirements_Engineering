import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { errorText } from '../lib/api';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" /> {label}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <p className="alert alert--error" role="alert">
      {typeof error === 'string' ? error : errorText(error)}
    </p>
  );
}

/** Loads data on mount (and when deps change); `reload` fetches again. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(fn, deps);
  const reload = useCallback(() => {
    setError(null);
    return load().then(setData, setError);
  }, [load]);
  useEffect(() => {
    let live = true;
    setData(null);
    setError(null);
    load().then((d) => live && setData(d), (e) => live && setError(e));
    return () => {
      live = false;
    };
  }, [load]);
  return { data, error, reload, setData };
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card__head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z')).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export const fmtDateTime = (s: string | null | undefined) =>
  s
    ? new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z')).toLocaleString(undefined, {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '—';

export const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60 ? `${s % 60} s` : ''}`.trim();
};
