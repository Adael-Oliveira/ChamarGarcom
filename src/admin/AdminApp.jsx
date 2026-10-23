import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { applyBrand, sanitizeBrand } from '../lib/theme/brand';
import { DEFAULT_SETTINGS, CALL_STATUS } from '../shared/model';
import BrandMark from '../shared/ui/BrandMark';
import { Icon } from '../shared/ui/Icon';
import { DemoBanner, useToast } from '../shared/ui/Feedback';
import { useHashRoute, useLocalPref, useNewCallAlert, useRecentCalls, useWatch } from './hooks';
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

  const brand = useMemo(() => sanitizeBrand(brandState.data || {}), [brandState.data]);
  useEffect(() => applyBrand(brand), [brand]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useNewCallAlert(calls.data, calls.loading, soundOn, brand.name);

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
                <small>{isOwner ? 'Responsável' : 'Equipe'}</small>
              </span>
              <button className="btn btn-icon btn-ghost" onClick={() => api.signOut()} title="Sair" aria-label="Sair">
                <Icon name="logout" size={18} />
              </button>
            </div>
          </div>
        </aside>

        <main className="main" id="conteudo">
          <DemoBanner />
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
