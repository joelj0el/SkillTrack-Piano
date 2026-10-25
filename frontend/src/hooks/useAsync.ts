import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';
import { apiErrorMessage } from '../api/client';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (updater: (prev: T | null) => T | null) => void;
}

/**
 * Ejecuta `fn` al montar y cada vez que cambian `deps`. Ignora respuestas de
 * llamadas obsoletas para que una respuesta lenta no pise a una más reciente.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setDataState] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const callId = useRef(0);

  useEffect(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (id === callId.current) setDataState(result);
      })
      .catch((err) => {
        if (id === callId.current) setError(apiErrorMessage(err, 'No se pudo cargar la información.'));
      })
      .finally(() => {
        if (id === callId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((updater: (prev: T | null) => T | null) => setDataState(updater), []);

  return { data, loading, error, reload, setData };
}
