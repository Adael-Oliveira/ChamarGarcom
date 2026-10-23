import BrandMark from '../shared/ui/BrandMark';
import { brandVars } from '../lib/theme/brand';
import { fmtCountdown } from '../shared/format';

function Bell({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M10 46h44" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M15 41a17 17 0 0 1 34 0z" fill="currentColor" />
      <circle cx="32" cy="20" r="3.5" fill="currentColor" />
    </svg>
  );
}
function Receipt({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 5v16M8 7h7M8 11h7" />
    </svg>
  );
}

/**
 * Tela do cliente na mesa. Componente "puro": recebe tudo por props.
 * É usado na página real (mesa.html) e na pré-visualização da tela Personalizar.
 *
 * phase: 'idle' | 'sending' | 'pending' | 'viewed'
 */
export default function TableView({
  brand,
  table,
  settings,
  phase = 'idle',
  reason = 'waiter',
  cooldownMs = 0,
  error = null,
  menuAvailable = false,
  onCall,
  onMenu,
  preview = false,
}) {
  const enabled = settings.callsEnabled && table.active !== false;
  const busy = phase === 'sending';
  const waiting = phase === 'pending' || phase === 'viewed';
  const canCall = enabled && cooldownMs <= 0 && !busy;
  const isBill = reason === 'bill';

  return (
    <div className={`tv tv-${phase} ${preview ? 'tv-preview' : ''}`} style={brandVars(brand)}>
      <header className="tv-head">
        <div className="tv-brand">
          <BrandMark brand={brand} size={44} className="tv-logo" />
          <div className="tv-brand-text">
            <strong>{brand.name}</strong>
            {brand.tagline && <span>{brand.tagline}</span>}
          </div>
        </div>
        <div className="tv-table" aria-label={`Mesa ${table.number}`}>
          <span>Mesa</span>
          <b>{table.number}</b>
        </div>
      </header>

      <main className="tv-main">
        {phase === 'viewed' && (
          <div className="tv-status tv-status-viewed" role="status" aria-live="polite">
            <span className="tv-status-icon">✓</span>
            <div>
              <strong>{isBill ? 'A conta já vai chegar' : 'Garçom a caminho'}</strong>
              <span>{isBill ? 'Já vamos levar a conta até a sua mesa.' : 'O garçom chegará em breve.'}</span>
            </div>
          </div>
        )}
        {phase === 'pending' && (
          <div className="tv-status tv-status-pending" role="status" aria-live="polite">
            <span className="tv-status-icon tv-ring">{isBill ? <Receipt size={20} /> : <Bell size={22} />}</span>
            <div>
              <strong>{isBill ? 'Pedido de conta enviado!' : 'Solicitação enviada!'}</strong>
              <span>{isBill ? 'Estamos preparando a sua conta.' : 'Estamos chamando um garçom.'}</span>
            </div>
          </div>
        )}

        {table.active === false ? (
          <p className="tv-alert">Esta mesa está temporariamente indisponível para chamadas.</p>
        ) : !settings.callsEnabled ? (
          <p className="tv-alert">Chamadas temporariamente indisponíveis.</p>
        ) : null}

        <button
          type="button"
          className={`tv-call ${waiting ? 'is-compact' : ''}`}
          disabled={!canCall}
          onClick={() => !preview && onCall?.('waiter')}
          tabIndex={preview ? -1 : undefined}
        >
          {busy ? <span className="tv-spin" /> : <Bell size={waiting ? 28 : 58} />}
          <span>{busy ? 'Enviando…' : 'Chamar garçom'}</span>
        </button>

        {settings.billEnabled && (
          <button
            type="button"
            className="tv-bill"
            disabled={!canCall}
            onClick={() => !preview && onCall?.('bill')}
            tabIndex={preview ? -1 : undefined}
          >
            <Receipt /> Pedir a conta
          </button>
        )}

        {enabled && cooldownMs > 0 && !busy && (
          <p className="tv-cooldown">
            Você poderá chamar novamente em <strong>{fmtCountdown(cooldownMs)}</strong>
          </p>
        )}
        {error === 'rejected' && <p className="tv-alert">Não foi possível chamar agora. Aguarde alguns segundos e tente de novo.</p>}
        {error === 'network' && <p className="tv-alert">Sem conexão com a internet. Verifique o sinal e tente de novo.</p>}

        <button type="button" className="tv-menu" disabled={!menuAvailable} onClick={() => !preview && onMenu?.()} tabIndex={preview ? -1 : undefined}>
          <MenuIcon /> {menuAvailable ? 'Ver cardápio' : 'Cardápio indisponível'}
        </button>
      </main>

      <footer className="tv-foot">Chamar Garçom</footer>
    </div>
  );
}
