import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/fonts';
import '../shared/base.css';
import '../admin/admin.css';
import './platform.css';
import api from '../lib/api';
import { BASE } from '../lib/env';
import { FullScreen, Spinner, ToastProvider } from '../shared/ui/Feedback';
import { AuthCard, Login } from '../admin/auth';
import PlatformApp from './PlatformApp';

try {
  document.documentElement.dataset.theme = JSON.parse(localStorage.getItem('cg:theme')) || 'system';
} catch {
  document.documentElement.dataset.theme = 'system';
}

function Restricted({ user }) {
  return (
    <AuthCard>
      <h1>Área restrita</h1>
      <p className="muted">Esta é a administração da plataforma, só para o dono dela. Se você cuida de um restaurante, entre pela central.</p>
      <div className="auth-actions">
        <a className="btn btn-dark" href={`${BASE}admin/`}>
          Ir para a central
        </a>
        <button className="btn" onClick={() => api.signOut()}>
          Usar outra conta
        </button>
      </div>
      <p className="auth-note">Conectado como {user.email}.</p>
    </AuthCard>
  );
}

function Gate() {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(
    () =>
      api.onAuth(async (user) => {
        if (!user) return setState({ status: 'signed-out' });
        setState({ status: 'loading' });
        try {
          const p = await api.loadProfile(user);
          const owner = p.status === 'platform' || (p.status === 'ready' && p.admin.platformOwner);
          setState({ status: owner ? 'ready' : 'restricted', user, admin: p.admin });
        } catch (e) {
          setState({ status: 'signed-out', error: e.message });
        }
      }),
    [],
  );

  if (state.status === 'loading')
    return (
      <FullScreen>
        <Spinner label="Verificando acesso…" />
      </FullScreen>
    );
  if (state.status === 'signed-out')
    return <Login initialError={state.error} title="Administração da plataforma" text="Clientes, interessados e suporte a todos os restaurantes. Só o dono da plataforma entra aqui." />;
  if (state.status === 'restricted') return <Restricted user={state.user} />;
  return <PlatformApp user={state.user} admin={state.admin} />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Gate />
    </ToastProvider>
  </StrictMode>,
);
