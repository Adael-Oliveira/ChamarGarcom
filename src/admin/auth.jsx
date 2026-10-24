import { useState } from 'react';
import api, { isDemo } from '../lib/api';
import { BASE } from '../lib/env';
import { DemoBanner, FullScreen } from '../shared/ui/Feedback';
import PlatformMark from '../shared/ui/PlatformMark';
import { Icon } from '../shared/ui/Icon';

// Telas de entrada usadas pela central do restaurante e pela administração da plataforma.
export function AuthCard({ children, wide }) {
  return (
    <>
    <DemoBanner />
    <FullScreen>
      <div className={`auth-card ${wide ? 'is-wide' : ''}`}>
        <a className="auth-platform" href={BASE}>
          <PlatformMark size={28} /> Chamar Garçom
        </a>
        {children}
      </div>
    </FullScreen>
    </>
  );
}

export function Login({ initialError, title = 'Central do restaurante', text = 'Acompanhe as chamadas das mesas em tempo real, gerencie QR Codes e personalize a página dos seus clientes.' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || '');
  const go = async () => {
    setBusy(true);
    setError('');
    try {
      await api.signIn();
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  return (
    <AuthCard>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
      <button className="btn btn-dark btn-lg btn-block" onClick={go} disabled={busy}>
        {isDemo ? (
          <>
            <Icon name="arrowRight" /> {busy ? 'Entrando…' : 'Entrar na demonstração'}
          </>
        ) : (
          <>
            <GoogleIcon /> {busy ? 'Entrando…' : 'Entrar com Google'}
          </>
        )}
      </button>
      {error && <p className="field-error">{error}</p>}
      {isDemo && <p className="auth-note">Modo demonstração: nenhum login real é feito e os dados ficam só neste navegador.</p>}
    </AuthCard>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

