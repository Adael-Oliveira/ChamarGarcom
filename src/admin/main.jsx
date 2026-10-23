import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/fonts';
import '../shared/base.css';
import '../client/table-view.css';
import './admin.css';
import api, { isDemo } from '../lib/api';
import { BASE } from '../lib/env';
import { DemoBanner, FullScreen, Spinner, ToastProvider } from '../shared/ui/Feedback';
import PlatformMark from '../shared/ui/PlatformMark';
import { Icon } from '../shared/ui/Icon';
import AdminApp from './AdminApp';

// tema claro/escuro salvo neste navegador
try {
  document.documentElement.dataset.theme = JSON.parse(localStorage.getItem('cg:theme')) || 'system';
} catch {
  document.documentElement.dataset.theme = 'system';
}

function AuthCard({ children, wide }) {
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

function Login({ initialError }) {
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
      <h1>Central do restaurante</h1>
      <p className="muted">Acompanhe as chamadas das mesas em tempo real, gerencie QR Codes e personalize a página dos seus clientes.</p>
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Setup({ user, first, onDone }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Informe o nome do restaurante.');
    setBusy(true);
    setError('');
    try {
      await api.createRestaurant(user, { name: name.trim(), first });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <AuthCard>
      <h1>{first ? 'Vamos configurar a plataforma' : 'Cadastre seu restaurante'}</h1>
      <p className="muted">
        {first
          ? 'Esta é a primeira conta a entrar. Você será o dono da plataforma e do primeiro restaurante. Depois dá para convidar a equipe.'
          : 'Crie o seu restaurante. Logo, cores e mesas você ajusta em seguida.'}
      </p>
      <form onSubmit={submit} className="auth-form">
        <label className="field" htmlFor="setup-name">
          <span>Nome do restaurante</span>
          <input id="setup-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Cantina da Praça" autoFocus />
        </label>
        <button className="btn btn-dark btn-lg btn-block" disabled={busy}>
          {busy ? 'Criando…' : 'Criar restaurante'}
        </button>
        {error && <p className="field-error">{error}</p>}
      </form>
      <p className="auth-note">
        Conectado como {user.email}.{' '}
        <button className="link-btn" onClick={() => api.signOut()}>
          Trocar conta
        </button>
      </p>
    </AuthCard>
  );
}

function Invite({ user, invite, onDone }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const accept = async () => {
    setBusy(true);
    try {
      await api.acceptInvite(user, invite);
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <AuthCard>
      <h1>Você foi convidado</h1>
      <p className="muted">
        A equipe de <strong>{invite.restaurantName}</strong> convidou <strong>{user.email}</strong> para usar a central de chamadas.
      </p>
      <button className="btn btn-dark btn-lg btn-block" onClick={accept} disabled={busy}>
        {busy ? 'Entrando…' : 'Aceitar convite'}
      </button>
      {error && <p className="field-error">{error}</p>}
      <p className="auth-note">
        <button className="link-btn" onClick={() => api.signOut()}>
          Usar outra conta
        </button>
      </p>
    </AuthCard>
  );
}

function Denied({ user }) {
  const [copied, setCopied] = useState(false);
  return (
    <AuthCard>
      <h1>Esta conta ainda não tem acesso</h1>
      <p className="muted">
        Peça para o responsável pelo restaurante te convidar pela tela <strong>Equipe</strong>, usando o e-mail <strong>{user.email}</strong>. Depois é só entrar de novo.
      </p>
      <div className="uid-row">
        <span>Seu código</span>
        <code>{user.uid}</code>
        <button
          className="btn btn-sm"
          onClick={() =>
            navigator.clipboard?.writeText(user.uid).then(
              () => setCopied(true),
              () => {},
            )
          }
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <div className="auth-actions">
        <button className="btn btn-dark" onClick={() => window.location.reload()}>
          Tentar de novo
        </button>
        <button className="btn" onClick={() => api.signOut()}>
          Sair
        </button>
      </div>
    </AuthCard>
  );
}

function Gate() {
  const [state, setState] = useState({ status: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    return api.onAuth(async (user) => {
      if (!user) return setState({ status: 'signed-out' });
      setState({ status: 'loading' });
      try {
        const p = await api.loadProfile(user);
        setState({ ...p, user });
      } catch (e) {
        setState({ status: 'signed-out', error: e.message });
      }
    });
  }, [reload]);

  const again = () => setReload((n) => n + 1);

  switch (state.status) {
    case 'loading':
      return (
        <FullScreen>
          <Spinner label="Verificando acesso…" />
        </FullScreen>
      );
    case 'signed-out':
      return <Login initialError={state.error} />;
    case 'setup':
      return <Setup user={state.user} first={state.first} onDone={again} />;
    case 'invite':
      return <Invite user={state.user} invite={state.invite} onDone={again} />;
    case 'denied':
      return <Denied user={state.user} />;
    default:
      return <AdminApp user={state.user} admin={state.admin} />;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Gate />
    </ToastProvider>
  </StrictMode>,
);
