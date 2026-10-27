import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/fonts';
import '../shared/base.css';
import '../client/table-view.css';
import './admin.css';
import api from '../lib/api';
import { BASE } from '../lib/env';
import { FullScreen, Spinner, ToastProvider } from '../shared/ui/Feedback';
import { Icon } from '../shared/ui/Icon';
import { ContactButtons, LeadForm, useContacts } from '../shared/ui/Contact';
import { AuthCard, Login } from './auth';
import AdminApp from './AdminApp';
import { PERMS, permsOf } from '../shared/model';

// tema claro/escuro salvo neste navegador
try {
  document.documentElement.dataset.theme = JSON.parse(localStorage.getItem('cg:theme')) || 'system';
} catch {
  document.documentElement.dataset.theme = 'system';
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
        <strong>{invite.restaurantName}</strong> convidou <strong>{user.email}</strong> para a central de chamadas como{' '}
        <strong>{invite.role === 'owner' ? 'Responsável (controle total do restaurante)' : 'Equipe'}</strong>
        {invite.displayName ? (
          <>
            , com o nome <strong>{invite.displayName}</strong>
          </>
        ) : null}
        .
      </p>
      {invite.role !== 'owner' && (
        <p className="muted small">
          Você vai atender as mesas
          {permsOf(invite).length ? ` e também cuidar de: ${PERMS.filter((p) => permsOf(invite).includes(p.id)).map((p) => p.label.toLowerCase()).join(', ')}` : ''}. Quando clicar em Visualizado, o
          atendimento fica registrado no seu nome.
        </p>
      )}
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
  const contacts = useContacts();
  return (
    <AuthCard wide>
      <span className="pitch-kicker">
        <Icon name="store" size={16} /> Acenai para o seu restaurante
      </span>
      <h1>Quer o Acenai no seu restaurante?</h1>
      <p className="muted">
        QR Code em cada mesa, chamadas em tempo real no caixa e a página dos clientes com o logo e as cores da sua casa. Deixe seu contato ou chame no WhatsApp para liberarmos a sua central.
      </p>
      <ul className="pitch-list">
        <li>
          <Icon name="qr" size={18} /> QR Code pronto para imprimir em cada mesa
        </li>
        <li>
          <Icon name="bell" size={18} /> Chamadas e pedidos de conta com som na central
        </li>
        <li>
          <Icon name="palette" size={18} /> Sua marca: logo, nome e cores
        </li>
      </ul>
      <ContactButtons contacts={contacts} />
      <div className="pitch-form">
        <h2>Deixe seu contato</h2>
        <LeadForm initial={{ name: user.name, email: user.email }} />
      </div>
      <p className="auth-note">
        Conectado como {user.email}.{' '}
        <button className="link-btn" onClick={() => api.signOut()}>
          Usar outra conta
        </button>
        {' · '}
        <a className="link-btn" href={BASE}>
          Conhecer a plataforma
        </a>
      </p>
    </AuthCard>
  );
}

function Suspended({ user, restaurantName }) {
  const contacts = useContacts();
  return (
    <AuthCard>
      <h1>Acesso pausado</h1>
      <p className="muted">
        A central do <strong>{restaurantName}</strong> está temporariamente pausada e as mesas não recebem chamadas. Fale com o suporte para reativar.
      </p>
      <ContactButtons contacts={contacts} text={`Olá! Preciso de ajuda com a central do ${restaurantName}.`} />
      <p className="auth-note">
        Conectado como {user.email}.{' '}
        <button className="link-btn" onClick={() => api.signOut()}>
          Sair
        </button>
      </p>
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
        const supportRid = new URLSearchParams(location.search).get('r') || undefined;
        const p = await api.loadProfile(user, { supportRid });
        if (p.status === 'platform') return location.replace(`${BASE}plataforma/`);
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
    case 'suspended':
      return <Suspended user={state.user} restaurantName={state.restaurantName} />;
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
