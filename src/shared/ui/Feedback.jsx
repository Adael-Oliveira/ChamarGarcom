import { createContext, useCallback, useContext, useState } from 'react';
import { isDemo } from '../../lib/api';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = 'ok') => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), type === 'error' ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toast && <div className={`toast toast-${toast.type}`}>{toast.message}</div>}
      </div>
    </ToastCtx.Provider>
  );
}

export function Spinner({ label }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function FullScreen({ children }) {
  return <div className="fullscreen">{children}</div>;
}

/** Faixa que avisa que a plataforma está em modo demonstração. */
export function DemoBanner({ compact }) {
  if (!isDemo) return null;
  return (
    <div className={`demo-banner ${compact ? 'is-compact' : ''}`} role="note">
      <strong>Modo demonstração.</strong>{' '}
      {compact ? 'Dados só neste navegador.' : 'Os dados ficam só neste navegador. Configure o Firebase para usar de verdade (veja o README).'}
    </div>
  );
}
