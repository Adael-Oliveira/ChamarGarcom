import { useEffect, useState } from 'react';
import { useContacts, waLink } from '../../shared/ui/Contact';
import { Icon } from '../../shared/ui/Icon';
import { WATCH_OFFER } from '../../shared/platform';
import PlatformMark from '../../shared/ui/PlatformMark';

// Convites do relógio dentro da central. Aparecem só para quem ainda não tem relógio
// e somem por um tempo quando a pessoa fecha (guardado só neste aparelho).
const DAY = 86400000;
const key = (rid, what) => `acenai:relogio:${what}:${rid}`;
const read = (k) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sem armazenamento: o aviso só volta a aparecer */
  }
};
const hiddenUntil = (rid, what) => Number(read(key(rid, what)) || 0);
export const rememberHasWatch = (rid, has) => write(key(rid, 'tem'), has ? '1' : '');
const hasWatch = (rid) => read(key(rid, 'tem')) === '1';

function useWaHref(restaurant) {
  const contacts = useContacts();
  return contacts?.whatsapp ? waLink(contacts.whatsapp, WATCH_OFFER.waText(restaurant)) : null;
}

/** Cartão fixo no topo da página Equipe. "Agora não" esconde por 30 dias. */
export function WatchPromo({ rid, restaurant, hasDevice }) {
  const href = useWaHref(restaurant);
  const [hidden, setHidden] = useState(() => hiddenUntil(rid, 'equipe') > Date.now());
  useEffect(() => rememberHasWatch(rid, hasDevice), [rid, hasDevice]);
  if (hasDevice || hidden) return null;
  const close = () => {
    write(key(rid, 'equipe'), String(Date.now() + 30 * DAY));
    setHidden(true);
  };
  return (
    <aside className="watch-promo" aria-label="Relógio Acenai">
      <div className="watch-promo-mini" aria-hidden="true">
        <span>7</span>
      </div>
      <div className="watch-promo-copy">
        <h2>Seus garçons podem receber as chamadas no pulso</h2>
        <p>
          O relógio Acenai vibra quando uma mesa chama, e o garçom marca Visualizado sem voltar ao caixa. <b>R$ {WATCH_OFFER.price} por relógio</b> (ou {WATCH_OFFER.installments}), entregue instalado e funcionando.
        </p>
      </div>
      <div className="watch-promo-actions">
        {href && (
          <a className="btn btn-primary-amber" href={href} target="_blank" rel="noopener noreferrer">
            <Icon name="whatsapp" size={16} /> Quero saber mais
          </a>
        )}
        <button type="button" className="btn btn-ghost-dark" onClick={close}>
          Agora não
        </button>
      </div>
    </aside>
  );
}

/** Dica no Painel quando uma chamada passa de 2 minutos. O × esconde por 7 dias. */
export function WatchTip({ rid, restaurant, oldest, now, enabled }) {
  const href = useWaHref(restaurant);
  const [hidden, setHidden] = useState(() => hiddenUntil(rid, 'painel') > Date.now());
  if (!enabled || hidden || hasWatch(rid) || !oldest || now - oldest.calledAt < 2 * 60000) return null;
  const close = () => {
    write(key(rid, 'painel'), String(Date.now() + 7 * DAY));
    setHidden(true);
  };
  return (
    <div className="watch-tip" role="status">
      <button type="button" className="watch-tip-x" aria-label="Fechar dica" onClick={close}>
        <Icon name="x" size={16} />
      </button>
      <span className="watch-tip-ic" aria-hidden="true">
        <PlatformMark size={36} />
      </span>
      <div>
        <strong>Mesa {oldest.tableNumber} esperando há mais de 2 minutos</strong>
        <p>Com o relógio Acenai, o garçom sente a chamada no pulso na mesma hora.</p>
        {href && (
          <a href={href} target="_blank" rel="noopener noreferrer">
            Conhecer o relógio →
          </a>
        )}
      </div>
    </div>
  );
}
