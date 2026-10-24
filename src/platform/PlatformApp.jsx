import { createContext, useCallback, useContext, useEffect } from 'react';
import api from '../lib/api';
import { BASE } from '../lib/env';
import PlatformMark from '../shared/ui/PlatformMark';
import { Icon } from '../shared/ui/Icon';
import { DemoBanner, useToast } from '../shared/ui/Feedback';
import { useHashRoute, useLocalPref, useWatch } from '../admin/hooks';
import Clients from './pages/Clients';
import Leads from './pages/Leads';
import Contacts from './pages/Contacts';

const Ctx = createContext(null);
export const usePlatform = () => useContext(Ctx);

const NAV = [
  { id: 'clientes', label: 'Clientes', icon: 'store', Page: Clients },
  { id: 'interessados', label: 'Interessados', icon: 'inbox', Page: Leads },
  { id: 'contatos', label: 'Contatos e cadastros', icon: 'phone', Page: Contacts },
];

const THEMES = [
  { id: 'system', icon: 'gear', label: 'Automático' },
  { id: 'light', icon: 'sun', label: 'Claro' },
  { id: 'dark', icon: 'moon', label: 'Escuro' },
];

export default function PlatformApp({ user, admin }) {
  const toast = useToast();
  const [route, navigate] = useHashRoute('clientes');
  const [theme, setTheme] = useLocalPref('cg:theme', 'system');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const clients = useWatch((ok, err) => api.watchClients(ok, err), [], []);
  const leads = useWatch((ok, err) => api.watchLeads(ok, err), [], []);

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

  const current = NAV.find((n) => n.id === route) || NAV[0];
  const { Page } = current;
  const newLeads = leads.data.filter((l) => l.status === 'new').length;
  const err = clients.error || leads.error;

  const ctx = { user, admin, clients, leads, run, toast, navigate };

  return (
    <Ctx.Provider value={ctx}>
      <div className="shell is-platform">
        <aside className="side">
          <a className="side-brand" href="#/clientes">
            <span className="platform-badge">
              <PlatformMark size={26} />
            </span>
            <span>
              <strong>Chamar Garçom</strong>
              <small>Administração da plataforma</small>
            </span>
          </a>
          <nav className="side-nav" aria-label="Seções">
            {NAV.map((n) => (
              <a key={n.id} href={`#/${n.id}`} className={n === current ? 'is-active' : ''} aria-current={n === current ? 'page' : undefined}>
                <Icon name={n.icon} />
                <span className="side-label">{n.label}</span>
                {n.id === 'interessados' && newLeads > 0 && <em className="side-badge">{newLeads}</em>}
              </a>
            ))}
            {clients.data.some((r) => r.members.some((m) => m.uid === user.uid)) && (
              <a href={`${BASE}admin/`} className="side-platform">
                <Icon name="grid" />
                <span className="side-label">Minha central</span>
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
                <strong>{user.name || user.email}</strong>
                <small>Dono da plataforma</small>
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
