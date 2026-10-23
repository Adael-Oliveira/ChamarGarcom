// Simulador: vários "celulares" de clientes lado a lado.
// Deixe a central aberta em outra janela para ver as chamadas chegando.
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/fonts';
import '../shared/base.css';
import './test.css';
import api, { isDemo } from '../lib/api';
import { BASE } from '../lib/env';
import { DemoBanner } from '../shared/ui/Feedback';
import { Icon } from '../shared/ui/Icon';

function initialIds() {
  const p = new URLSearchParams(location.search).get('ids');
  if (p) return p.split(',').filter(Boolean);
  return isDemo ? api.demoTokens(3) : [];
}
function tokenOf(v) {
  try {
    return new URL(v.trim()).searchParams.get('id') || '';
  } catch {
    return v.trim();
  }
}

function Simulator() {
  const [ids, setIds] = useState(initialIds);
  const [value, setValue] = useState('');
  const [key, setKey] = useState(0);
  const update = (next) => {
    setIds(next);
    const u = new URL(location.href);
    next.length ? u.searchParams.set('ids', next.join(',')) : u.searchParams.delete('ids');
    history.replaceState(null, '', u);
  };
  return (
    <>
      <DemoBanner />
      <div className="sim">
        <header className="sim-head">
          <div>
            <h1>Testar como cliente</h1>
            <p className="muted">Cada tela é um celular independente. Abra a central ao lado para ver as chamadas chegando.</p>
          </div>
          <div className="sim-actions">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = tokenOf(value);
                if (t && !ids.includes(t)) update([...ids, t]);
                setValue('');
              }}
            >
              <label htmlFor="sim-add" className="visually-hidden">
                Link de uma mesa
              </label>
              <input id="sim-add" className="input" placeholder="Cole o link de uma mesa" value={value} onChange={(e) => setValue(e.target.value)} />
              <button className="btn">Adicionar</button>
            </form>
            <a className="btn btn-dark" href={`${BASE}admin/`} target="cg-central">
              Abrir a central <Icon name="external" size={16} />
            </a>
            <button className="btn btn-ghost" onClick={() => setKey((k) => k + 1)}>
              <Icon name="refresh" size={16} /> Recarregar
            </button>
          </div>
        </header>
        {ids.length === 0 ? (
          <div className="empty">
            <h3>Nenhuma mesa aqui ainda</h3>
            <p>Na central, vá em Mesas e clique em “Testar como cliente”, ou cole acima o link de uma mesa.</p>
          </div>
        ) : (
          <div className="sim-phones">
            {ids.map((id) => (
              <figure key={id + key}>
                <div className="sim-phone">
                  <iframe title={`Mesa ${id.slice(0, 6)}`} src={`${BASE}mesa.html?id=${encodeURIComponent(id)}`} />
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => update(ids.filter((x) => x !== id))}>
                  Tirar este celular
                </button>
              </figure>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Simulator />
  </StrictMode>,
);
