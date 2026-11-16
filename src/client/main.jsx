import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/fonts';
import '../shared/base.css';
import './table-view.css';
import './client.css';
import './order-flow.css';
import api from '../lib/api';
import { applyBrand, sanitizeBrand } from '../lib/theme/brand';
import { DemoBanner } from '../shared/ui/Feedback';
import TableView from './TableView';
import { phaseOf, useTableSession } from './useTableSession';
import OrderFlow from './OrderFlow';
import { useOrdering } from './useOrdering';

// O link do QR Code traz o código da mesa (?id=...). Guardamos o código nesta
// aba e limpamos o endereço: o cliente não vê nem compartilha o código.
const KEY = 'cg:mesa';
function readToken() {
  const fromUrl = new URLSearchParams(window.location.search).get('id');
  const inFrame = window.top !== window; // simulador da central: deixa como está
  if (fromUrl) {
    if (!inFrame) {
      try {
        sessionStorage.setItem(KEY, fromUrl);
        history.replaceState(null, '', window.location.pathname);
      } catch {
        /* sem armazenamento: mantém o endereço */
      }
    }
    return fromUrl;
  }
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
const token = readToken();

function setThemeColor(color) {
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) {
    m = document.createElement('meta');
    m.name = 'theme-color';
    document.head.appendChild(m);
  }
  m.content = color;
}

function Message({ title, text }) {
  return (
    <div className="c-msg">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}

function useNow(ms = 500) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function MenuSheet({ url, onClose }) {
  return (
    <div className="c-sheet" role="dialog" aria-modal="true" aria-label="Cardápio">
      <div className="c-sheet-bar">
        <strong>Cardápio</strong>
        <a href={url} target="_blank" rel="noopener noreferrer">
          Abrir em nova aba
        </a>
        <button type="button" onClick={onClose}>
          Fechar
        </button>
      </div>
      <iframe src={url} title="Cardápio" />
    </div>
  );
}

function Page() {
  const s = useTableSession(token);
  const now = useNow();
  const [menuUrl, setMenuUrl] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const ordering = useOrdering(token, s.link.data, s.settings);
  const [screen, setScreenState] = useState(null);
  // o botão "voltar" do celular fecha o cardápio em vez de sair da página
  const setScreen = (next) => {
    if (next && !screen) history.pushState({ cardapio: 1 }, '');
    if (!next && screen && history.state?.cardapio) return history.back();
    setScreenState(next);
  };
  useEffect(() => {
    const on = () => setScreenState(null);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  const brand = s.brand ? sanitizeBrand(s.brand) : null;
  useEffect(() => {
    if (!brand) return;
    applyBrand(brand);
    setThemeColor(brand.primary);
    document.title = `${brand.name} · Mesa ${s.link.data?.number ?? ''}`;
  }, [brand?.primary, brand?.accent, brand?.style, brand?.name, s.link.data?.number]); // eslint-disable-line

  useEffect(() => {
    if (!s.settings) return;
    let alive = true;
    api.resolveMenuUrl(s.settings, s.link.data?.restaurantId).then((u) => alive && setMenuUrl(u));
    return () => {
      alive = false;
    };
  }, [s.settings?.menuUrl, s.settings?.menuUpdatedAt]); // eslint-disable-line

  if (s.link.loading || (s.link.data && (!s.settings || !s.brand)))
    return (
      <div className="c-msg">
        <span className="spinner" />
      </div>
    );
  if (s.link.error === 'missing') return <Message title="Link incompleto" text="Escaneie de novo o QR Code que está na sua mesa." />;
  if (s.link.error === 'not-found') return <Message title="Mesa não encontrada" text="Este QR Code não vale mais. Peça ajuda a um atendente." />;
  if (s.link.error) return <Message title="Sem conexão" text="Verifique a internet do celular e tente de novo." />;

  const cooldownMs = s.state?.lastCallAt ? s.state.lastCallAt.getTime() + s.settings.cooldownMinutes * 60000 - (now + s.offset) : 0;
  const phase = phaseOf({ sending: s.sending, call: s.call, now: now + s.offset });

  const openMenu = () => {
    if (!menuUrl) return;
    // PDF dentro da página no computador; no celular abre direto (leitor de PDF nativo)
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) window.open(menuUrl, '_blank', 'noopener');
    else setMenuOpen(true);
  };

  return (
    <>
      <DemoBanner compact />
      <TableView
        brand={brand}
        table={s.link.data}
        settings={s.settings}
        phase={phase}
        reason={s.sending ? s.lastReason : s.call?.reason}
        cooldownMs={cooldownMs}
        error={s.error}
        menuAvailable={!!menuUrl}
        onCall={s.callWaiter}
        onMenu={openMenu}
        ordering={ordering.enabled}
        liveOrder={ordering.live}
        ordersCount={ordering.orders.length}
        onOrder={() => setScreen('menu')}
        onOrders={() => setScreen('orders')}
      />
      {menuOpen && <MenuSheet url={menuUrl} onClose={() => setMenuOpen(false)} />}
      {ordering.enabled && screen && (
        <OrderFlow
          brand={brand}
          table={s.link.data}
          menu={ordering.menu}
          getImage={(id) => api.getMenuImage(s.link.data.restaurantId, id)}
          cart={ordering.cart}
          setCart={ordering.setCart}
          orders={ordering.orders}
          approval={!!s.settings.ordersApproval}
          screen={screen}
          setScreen={(x) => (x ? setScreenState(x) : setScreen(null))}
          onSend={ordering.send}
          canBill={s.settings.billEnabled && s.settings.callsEnabled && cooldownMs <= 0}
          onBill={() => {
            setScreen(null);
            s.callWaiter('bill');
          }}
        />
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
