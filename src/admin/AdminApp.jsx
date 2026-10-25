import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { BASE } from '../lib/env';
import { applyBrand, sanitizeBrand } from '../lib/theme/brand';
import { DEFAULT_SETTINGS, CALL_STATUS } from '../shared/model';
import BrandMark from '../shared/ui/BrandMark';
import { Icon } from '../shared/ui/Icon';
import { DemoBanner, useToast } from '../shared/ui/Feedback';
import { ContactButtons, useContacts } from '../shared/ui/Contact';
import { AuthCard } from './auth';
import { alertStatus, enableAlerts, useHashRoute, useLocalPref, useNewCallAlert, useRecentCalls, useWatch } from './hooks';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import Menu from './pages/Menu';
import Brand from './pages/Brand';
import Reports from './pages/Reports';
import Team from './pages/Team';
import Settings from './pages/Settings';

const Ctx = createContext(null);
export const useAdmin = () => useContext(Ctx);

const NAV = [
  { id: 'painel', label: 'Painel', icon: 'grid', Page: Dashboard },
  { id: 'mesas', label: 'Mesas', icon: 'table', Page: Tables },
  { id: 'cardapio', label: 'Cardápio', icon: 'book', Page: Menu },
  { id: 'personalizar', label: 'Personalizar', icon: 'palette', Page: Brand, owner: true },
  { id: 'relatorios', label: 'Relatórios', icon: 'chart', Page: Reports },
  { id: 'equipe', label: 'Equipe', icon: 'users', Page: Team, owner: true },
  { id: 'configuracoes', label: 'Configurações', icon: 'gear', Page: Settings },
];

const THEMES = [
  { id: 'system', icon: 'gear', label: 'Automático' },
  { id: 'light', icon: 'sun', label: 'Claro' },
  { id: 'dark', icon: 'moon', label: 'Escuro' },
];

export default function AdminApp({ user, admin }) {
  const rid = admin.restaurantId;
  const isOwner = admin.role === 'owner';
  const toast = useToast();
  const [route, navigate] = useHashRoute('painel');
  const [soundOn, setSoundOn] = useLocalPref('cg:sound', true);
  const [theme, setTheme] = useLocalPref('cg:theme', 'system');

  const settings = useWatch((ok, err) => api.watchSettings(rid, ok, err), [rid], DEFAULT_SETTINGS);
  const brandState = useWatch((ok, err) => api.watchBrand(rid, ok, err), [rid], null);
  const tables = useWatch((ok, err) => api.watchTables(rid, ok, err), [rid], []);
  const calls = useRecentCalls(rid);
  const access = useWatch((ok) => api.watchMyAccess(user.uid, ok), [user.uid], undefined);

  const brand = useMemo(() => sanitizeBrand(brandState.data || {}), [brandState.data]);
  useEffect(() => applyBrand(brand), [brand]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useNewCallAlert(calls.data, calls.loading, soundOn && !admin.support, brand.name);

  /** Executa uma ação; mostra o erro de forma amigável. */
  const run = useCallback(
    async (fn, okMsg) => {
      try {
        const r = await fn();
        if (okMsg) toast(okMsg);
        return r;
      } catch (e) {
        console.error(e);
        toast(e.message || 'Algo deu errado.', 'error');
        throw e;
      }
    },
    [toast],
  );

  const nav = NAV.filter((n) => !n.owner || isOwner);
  const current = nav.find((n) => n.id === route) || nav[0];
  const { Page } = current;
  const pending = calls.data.filter((c) => c.status === CALL_STATUS.PENDING).length;
  const err = settings.error || tables.error || calls.error || brandState.error;

  // removido da equipe ou restaurante pausado com a central aberta
  if (!admin.support && !admin.platformOwner) {
    const removed = !access.loading && (!access.data || access.data.restaurantId !== rid);
    if (settings.data.suspended) return <AccessLost user={user} brandName={brand.name} paused />;
    if (removed || err?.code === 'permission-denied') return <AccessLost user={user} brandName={brand.name} />;
  }

  const ctx = {
    rid,
    user,
    admin,
    isOwner,
    brand,
    brandLoading: brandState.loading,
    settings: settings.data,
    tables,
    calls,
    run,
    toast,
    navigate,
    soundOn,
    setSoundOn,
    theme,
    setTheme,
  };

  return (
    <Ctx.Provider value={ctx}>
      <div className="shell">
        <aside className="side">
          <a className="side-brand" href="#/painel">
            <BrandMark brand={brand} size={38} />
            <span>
              <strong>{brand.name}</strong>
              <small>Central de chamadas</small>
            </span>
          </a>
          <nav className="side-nav" aria-label="Seções">
            {nav.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={n === current ? 'is-active' : ''} aria-current={n === current ? 'page' : undefined}>
                <Icon name={n.icon} />
                <span className="side-label">{n.label}</span>
                {n.id === 'painel' && pending > 0 && <em className="side-badge">{pending}</em>}
              </a>
            ))}
            {admin.platformOwner && (
              <a href={`${BASE}plataforma/`} className="side-platform">
                <Icon name="store" />
                <span className="side-label">Plataforma</span>
              </a>
            )}
          </nav>
          <div className="side-foot">
            <div className="theme-toggle" role="radiogroup" aria-label="Aparência">
              {THEMES.map((t) => (
                <button key={t.id} role="radio" aria-checked={theme === t.id} className={theme === t.id ? 'is-on' : ''} onClick={() => setTheme(t.id)} title={t.label}>
                  <Icon name={t.icon} size={16} />
                  <span className="visually-hidden">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="side-user">
              {user.photo ? <img src={user.photo} alt="" referrerPolicy="no-referrer" /> : <span className="avatar">{(user.name || user.email || '?')[0]}</span>}
              <span>
                <strong>{user.name || 'Administrador'}</strong>
                <small>{admin.support ? 'Suporte da plataforma' : isOwner ? 'Responsável' : 'Equipe'}</small>
              </span>
              <button className="btn btn-icon btn-ghost" onClick={() => api.signOut()} title="Sair" aria-label="Sair">
                <Icon name="logout" size={18} />
              </button>
            </div>
          </div>
        </aside>

        <main className="main" id="conteudo">
          <DemoBanner />
          {admin.support && (
            <div className="banner banner-support" role="note">
              <span>
                <Icon name="lifebuoy" size={18} />
                <span>
                  Modo suporte: você está na central do <strong>{brand.name}</strong>. Tudo que mudar aqui vale para o restaurante.
                </span>
              </span>
              <a href={`${BASE}plataforma/`}>Voltar para a plataforma</a>
            </div>
          )}
          {!admin.support && <AlertBanner soundOn={soundOn} />}
          {err && (
            <div className="banner banner-error" role="alert">
              <Icon name="alert" size={18} /> {err.message || 'Erro de conexão.'}
            </div>
          )}
          <Page key={current.id} />
        </main>
      </div>
    </Ctx.Provider>
  );
}

/** O acesso mudou enquanto a central estava aberta (removido da equipe ou restaurante pausado). */
function AccessLost({ user, brandName, paused }) {
  const contacts = useContacts();
  return (
    <AuthCard>
      <h1>{paused ? 'Acesso pausado' : 'Seu acesso mudou'}</h1>
      <p className="muted">
        {paused ? (
          <>
            A central{brandName ? ` do ${brandName}` : ''} está temporariamente pausada e as mesas não recebem chamadas. Fale com o suporte da plataforma para reativar.
          </>
        ) : (
          <>
            A conta <strong>{user.email}</strong> não tem mais acesso à central{brandName ? ` do ${brandName}` : ''}. Fale com o suporte da plataforma para entender o que aconteceu.
          </>
        )}
      </p>
      <ContactButtons contacts={contacts} text={`Olá! Perdi o acesso à central${brandName ? ` do ${brandName}` : ''} (${user.email}).`} />
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

/** Pede para liberar o som e as notificações do computador (o navegador exige um clique). */
function AlertBanner({ soundOn }) {
  const [st, setSt] = useState(alertStatus);
  useEffect(() => {
    const t = setInterval(() => setSt(alertStatus()), 1500);
    return () => clearInterval(t);
  }, []);
  const needNotif = st.notif === 'default';
  const needSound = soundOn && st.sound !== 'running';
  if (!needNotif && !needSound) return null;
  return (
    <div className="banner banner-alert" role="note">
      <span>
        <Icon name="bell" size={18} />
        <span>
          <strong>Não perca nenhuma chamada.</strong> Ative o som{needNotif ? ' e as notificações no computador' : ''}: elas aparecem mesmo com a central minimizada.
        </span>
      </span>
      <button className="btn btn-sm btn-dark" onClick={() => enableAlerts().then(setSt)}>
        Ativar
      </button>
    </div>
  );
}
