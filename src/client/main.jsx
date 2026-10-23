import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/fonts';
import '../shared/base.css';
import './table-view.css';
import './client.css';
import api from '../lib/api';
import { applyBrand, sanitizeBrand } from '../lib/theme/brand';
import { DemoBanner } from '../shared/ui/Feedback';
import TableView from './TableView';
import { phaseOf, useTableSession } from './useTableSession';

const token = new URLSearchParams(window.location.search).get('id');

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

  const brand = s.brand ? sanitizeBrand(s.brand) : null;
  useEffect(() => {
    if (!brand) return;
    applyBrand(brand);
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
      />
      {menuOpen && <MenuSheet url={menuUrl} onClose={() => setMenuOpen(false)} />}
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
