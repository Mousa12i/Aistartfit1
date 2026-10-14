import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { AI_CONSENT_EVENT } from './consent-events';
import { fetchConsents, setConsent, type ConsentKind, type ConsentState } from './privacy';

interface ConsentContextValue extends ConsentState {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  set: (kind: ConsentKind, granted: boolean) => Promise<void>;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<ConsentState>({ available: true, health: false, ai: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setState({ available: true, health: false, ai: false });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setState(await fetchConsents());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your privacy choices.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onMissing = () => void refresh();
    window.addEventListener(AI_CONSENT_EVENT, onMissing);
    return () => window.removeEventListener(AI_CONSENT_EVENT, onMissing);
  }, [refresh]);

  const set = useCallback(async (kind: ConsentKind, granted: boolean) => {
    await setConsent(kind, granted);
    setState((s) => ({ ...s, [kind === 'health_data' ? 'health' : 'ai']: granted }));
  }, []);

  return <ConsentContext.Provider value={{ ...state, loading, error, refresh, set }}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider');
  return ctx;
}
