import { useEffect, useMemo, useRef, useState } from 'react';
import { brandVars } from '../lib/theme/brand';
import BrandMark from '../shared/ui/BrandMark';
import {
  CLIENT_STEPS,
  MAX_QTY,
  ORDER_LABEL_CLIENT,
  ORDER_STATUS,
  brl,
  linesCount,
  linesTotal,
  orderCode,
  orderLine,
  sameLine,
} from '../shared/orders';
import { fmtTime } from '../shared/format';

// Fotos: buscadas uma vez e guardadas na memória enquanto a página estiver aberta.
const imgCache = new Map();
function usePhoto(id, getImage) {
  const [src, setSrc] = useState(() => (id ? imgCache.get(id) : null) || null);
  useEffect(() => {
    if (!id) return setSrc(null);
    if (imgCache.has(id)) return setSrc(imgCache.get(id));
    let alive = true;
    const p = getImage(id).then((d) => {
      imgCache.set(id, d);
      return d;
    });
    imgCache.set(id, null);
    p.then((d) => alive && setSrc(d)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]); // eslint-disable-line
  return src;
}

function Photo({ id, getImage, className, alt = '' }) {
  const src = usePhoto(id, getImage);
  return <span className={`of-photo ${className || ''}`}>{src ? <img src={src} alt={alt} loading="lazy" /> : <span className="of-photo-wait" />}</span>;
}

function Back({ onClick, label = 'Voltar' }) {
  return (
    <button type="button" className="of-back" onClick={onClick} aria-label={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

function Head({ title, brand, table, onBack }) {
  return (
    <header className="of-head">
      {onBack ? <Back onClick={onBack} /> : <BrandMark brand={brand} size={40} />}
      <div className="of-head-title">
        <strong>{title}</strong>
        <span>{brand.name}</span>
      </div>
      <div className="tv-table of-table" aria-label={`Mesa ${table.number}`}>
        <span>Mesa</span>
        <b>{table.number}</b>
      </div>
    </header>
  );
}

function Qty({ value, onChange, min = 1, small }) {
  return (
    <div className={`of-qty ${small ? 'is-small' : ''}`}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Menos um" disabled={value <= min}>
        −
      </button>
      <b aria-live="polite">{value}</b>
      <button type="button" onClick={() => onChange(Math.min(MAX_QTY, value + 1))} aria-label="Mais um" disabled={value >= MAX_QTY}>
        +
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ cardápio */
function MenuScreen({ menu, cart, getImage, onItem, onBag, head }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState(menu.categories[0]?.id);
  const body = useRef(null);
  const term = q.trim().toLowerCase();
  const cats = useMemo(
    () =>
      menu.categories
        .map((c) => ({ ...c, items: c.items.filter((i) => i.available && (!term || `${i.name} ${i.desc}`.toLowerCase().includes(term))) }))
        .filter((c) => c.items.length),
    [menu, term],
  );
  const qtyOf = (id) => cart.filter((l) => l.id === id).reduce((a, l) => a + l.qty, 0);
  const go = (id) => {
    setCat(id);
    const el = body.current?.querySelector(`[data-cat="${id}"]`);
    if (el) body.current.scrollTo({ top: el.offsetTop - 64, behavior: 'smooth' });
  };
  // categoria ativa acompanha a rolagem
  const onScroll = () => {
    const secs = body.current?.querySelectorAll('[data-cat]') || [];
    let cur = cats[0]?.id;
    for (const s of secs) if (s.offsetTop - 80 <= body.current.scrollTop) cur = s.dataset.cat;
    if (cur && cur !== cat) setCat(cur);
  };

  return (
    <>
      {head}
      <div className="of-body" ref={body} onScroll={onScroll}>
        <label className="of-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5" />
          </svg>
          <input id="of-busca" type="search" placeholder="Buscar no cardápio" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar no cardápio" />
        </label>
        {!term && cats.length > 1 && (
          <nav className="of-cats" aria-label="Categorias">
            {cats.map((c) => (
              <button key={c.id} type="button" aria-pressed={cat === c.id} onClick={() => go(c.id)}>
                {c.name}
              </button>
            ))}
          </nav>
        )}
        {cats.map((c) => (
          <section key={c.id} className="of-sec" data-cat={c.id}>
            <h2>{c.name}</h2>
            {c.items.map((i) => {
              const n = qtyOf(i.id);
              return (
                <button key={i.id} type="button" className="of-item" onClick={() => onItem(i)}>
                  <span className="of-item-text">
                    <strong>
                      {i.name}
                      {i.tag && <span className="of-tag">{i.tag}</span>}
                    </strong>
                    {i.desc && <span className="of-desc">{i.desc}</span>}
                    <span className="of-price">{brl(i.price)}</span>
                  </span>
                  {i.img ? <Photo id={i.img} getImage={getImage} className="of-thumb" /> : <span className="of-add" aria-hidden="true">+</span>}
                  {n > 0 && <span className="of-badge">{n}</span>}
                </button>
              );
            })}
          </section>
        ))}
        {!cats.length && <p className="of-empty">{term ? 'Nada encontrado com esse nome.' : 'O cardápio está sendo atualizado. Chame o garçom.'}</p>}
        <div style={{ height: cart.length ? 100 : 24 }} />
      </div>
      {cart.length > 0 && (
        <button type="button" className="of-cartbar" onClick={onBag}>
          <span className="of-cartbar-n">{linesCount(cart)}</span>
          <strong>Ver sacola</strong>
          <span>{brl(linesTotal(cart))}</span>
        </button>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ item */
function ItemScreen({ item, getImage, onBack, onAdd }) {
  const [qty, setQty] = useState(1);
  const [opt, setOpt] = useState(null);
  const [obs, setObs] = useState('');
  const need = item.opts && !opt;
  return (
    <>
      <div className="of-body">
        <div className={`of-hero ${item.img ? '' : 'is-plain'}`}>
          {item.img ? <Photo id={item.img} getImage={getImage} alt={item.name} /> : null}
          <Back onClick={onBack} />
        </div>
        <div className="of-detail">
          <h1>{item.name}</h1>
          <p className="of-price is-big">{brl(item.price)}</p>
          {item.desc && <p className="of-detail-desc">{item.desc}</p>}
          {item.opts && (
            <fieldset className="of-group">
              <legend>
                {item.opts.title}
                <span className={opt ? 'is-ok' : ''}>{opt ? '✓' : 'Obrigatório'}</span>
              </legend>
              {item.opts.choices.map((c) => (
                <label key={c} className={`of-opt ${opt === c ? 'is-on' : ''}`}>
                  <input type="radio" name="of-opcao" value={c} checked={opt === c} onChange={() => setOpt(c)} />
                  <span>{c}</span>
                  <i aria-hidden="true" />
                </label>
              ))}
            </fieldset>
          )}
          <div className="of-group">
            <label className="of-label" htmlFor="of-obs">
              Alguma observação?
            </label>
            <textarea id="of-obs" maxLength={80} placeholder="Ex.: sem cebola, molho à parte" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <div style={{ height: 100 }} />
      </div>
      <div className="of-actions">
        <Qty value={qty} onChange={setQty} min={1} />
        <button type="button" className="of-primary" disabled={need} onClick={() => onAdd(orderLine(item, qty, opt, obs))}>
          <span>{need ? 'Escolha uma opção' : 'Adicionar'}</span>
          <span>{brl(item.price * qty)}</span>
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ sacola */
function BagScreen({ cart, setCart, head, onMore, onSend, sending, error, approval }) {
  const [note, setNote] = useState('');
  const change = (k, q) => setCart(q <= 0 ? cart.filter((_, i) => i !== k) : cart.map((l, i) => (i === k ? { ...l, qty: q } : l)));
  return (
    <>
      {head}
      <div className="of-body">
        {cart.length ? (
          <div className="of-bag">
            {cart.map((l, k) => (
              <div key={k} className="of-line">
                <div>
                  <strong>{l.name}</strong>
                  {l.opt && <small>{l.opt}</small>}
                  {l.obs && <small>Obs.: {l.obs}</small>}
                  <Qty value={l.qty} onChange={(q) => change(k, q)} min={0} small />
                </div>
                <span className="of-line-price">{brl(l.price * l.qty)}</span>
              </div>
            ))}
            <button type="button" className="of-more" onClick={onMore}>
              + Adicionar mais itens
            </button>
            <div className="of-group">
              <label className="of-label" htmlFor="of-nota">
                Recado para a cozinha (opcional)
              </label>
              <textarea id="of-nota" maxLength={200} placeholder="Ex.: trazer os pratos juntos" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="of-sum">
              <span>Total deste pedido</span>
              <strong>{brl(linesTotal(cart))}</strong>
            </div>
            <p className="of-info">Você paga tudo no final, junto com a conta da mesa.{approval ? ' O caixa confirma o pedido antes de ir para a cozinha.' : ''}</p>
            {error && <p className="tv-alert">{error}</p>}
          </div>
        ) : (
          <div className="of-empty">
            <p>Sua sacola está vazia.</p>
            <button type="button" className="of-primary is-center" onClick={onMore}>
              Ver cardápio
            </button>
          </div>
        )}
        <div style={{ height: 100 }} />
      </div>
      {cart.length > 0 && (
        <div className="of-actions is-one">
          <button type="button" className="of-primary" disabled={sending} onClick={() => onSend(note)}>
            <span>{sending ? 'Enviando…' : approval ? 'Enviar pedido' : 'Enviar pedido para a cozinha'}</span>
            <span>{brl(linesTotal(cart))}</span>
          </button>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ acompanhamento */
function Steps({ order }) {
  // Recebido já vale ao enviar; a etapa seguinte fica destacada até a cozinha avançar
  const idx = order.status === ORDER_STATUS.DELIVERED ? CLIENT_STEPS.length - 1 : CLIENT_STEPS.indexOf(order.status);
  return (
    <ol className="of-steps">
      {CLIENT_STEPS.map((s, k) => {
        const done = k <= idx;
        const now = k === idx + 1;
        return (
          <li key={s} className={`${done ? 'is-done' : ''} ${now ? 'is-now' : ''}`}>
            <i>{done ? '✓' : k + 1}</i>
            <span>
              {ORDER_LABEL_CLIENT[s]}
              {s === 'READY' && ' · o garçom leva até a mesa'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({ order }) {
  return (
    <article className="of-card">
      <header>
        <strong>
          Pedido {orderCode(order.id)} · {fmtTime(order.createdAt)}
        </strong>
        <span className={`of-pill is-${order.status}`}>{ORDER_LABEL_CLIENT[order.status]}</span>
      </header>
      <ul>
        {order.items.map((l, k) => (
          <li key={k}>
            {l.qty}× {l.name}
            {l.opt ? ` · ${l.opt}` : ''}
            {l.obs ? ` · obs.: ${l.obs}` : ''}
          </li>
        ))}
      </ul>
    </article>
  );
}

function SentScreen({ order, head, onHome }) {
  if (!order) return null;
  const waiting = order.status === ORDER_STATUS.WAITING;
  const canceled = order.status === ORDER_STATUS.CANCELED;
  return (
    <>
      {head}
      <div className="of-body">
        <div className="of-done">
          <span className={`of-done-icon ${canceled ? 'is-bad' : waiting ? 'is-wait' : ''}`}>{canceled ? '×' : waiting ? '…' : '✓'}</span>
          <h1>{canceled ? 'Pedido cancelado' : waiting ? 'Pedido enviado!' : `Pedido ${orderCode(order.id)} enviado!`}</h1>
          <p>{canceled ? 'Chame o garçom se precisar de ajuda.' : waiting ? 'O caixa vai confirmar e mandar para a cozinha.' : 'A cozinha já recebeu. Acompanhe aqui.'}</p>
        </div>
        {!waiting && !canceled && <Steps order={order} />}
        <OrderCard order={order} />
        <button type="button" className="of-primary is-center" onClick={onHome}>
          Voltar ao início
        </button>
      </div>
    </>
  );
}

function OrdersScreen({ orders, head, onMenu, onBill, canBill }) {
  const valid = orders.filter((o) => o.status !== ORDER_STATUS.CANCELED);
  return (
    <>
      {head}
      <div className="of-body">
        {orders.length ? (
          <div className="of-bag">
            {orders.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
            <div className="of-sum">
              <span>Total dos pedidos deste celular</span>
              <strong>{brl(valid.reduce((a, o) => a + o.total, 0))}</strong>
            </div>
            <p className="of-info">Pedidos feitos em outros celulares da mesa também entram na conta.</p>
            {canBill && (
              <button type="button" className="of-primary is-center" onClick={onBill}>
                Pedir a conta
              </button>
            )}
          </div>
        ) : (
          <div className="of-empty">
            <p>Nenhum pedido feito neste celular ainda.</p>
            <button type="button" className="of-primary is-center" onClick={onMenu}>
              Ver cardápio
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ fluxo completo */
export default function OrderFlow({ brand, table, menu, getImage, cart, setCart, orders, approval, screen, setScreen, onSend, onBill, canBill }) {
  const [item, setItem] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [lastId, setLastId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const head = (title, back) => <Head title={title} brand={brand} table={table} onBack={back} />;
  const add = (line) => {
    const k = cart.findIndex((l) => sameLine(l, line));
    setCart(k >= 0 ? cart.map((l, i) => (i === k ? { ...l, qty: Math.min(MAX_QTY, l.qty + line.qty) } : l)) : [...cart, line]);
    setScreen('menu');
    setToast('Adicionado à sacola');
  };
  const send = async (note) => {
    setSending(true);
    setError(null);
    const r = await onSend(note);
    setSending(false);
    if (r.ok) {
      setLastId(r.orderId);
      setScreen('sent');
    } else setError(r.message);
  };

  let content = null;
  if (screen === 'menu') content = <MenuScreen menu={menu} cart={cart} getImage={getImage} head={head('Cardápio', () => setScreen(null))} onItem={(i) => (setItem(i), setScreen('item'))} onBag={() => setScreen('bag')} />;
  else if (screen === 'item' && item) content = <ItemScreen key={item.id} item={item} getImage={getImage} onBack={() => setScreen('menu')} onAdd={add} />;
  else if (screen === 'bag')
    content = <BagScreen cart={cart} setCart={setCart} head={head('Sua sacola', () => setScreen('menu'))} onMore={() => setScreen('menu')} onSend={send} sending={sending} error={error} approval={approval} />;
  else if (screen === 'sent') content = <SentScreen order={orders.find((o) => o.id === lastId)} head={head('Pedido enviado', () => setScreen(null))} onHome={() => setScreen(null)} />;
  else if (screen === 'orders')
    content = <OrdersScreen orders={orders} head={head('Meus pedidos', () => setScreen(null))} onMenu={() => setScreen('menu')} onBill={onBill} canBill={canBill} />;

  if (!content) return null;
  return (
    <div className="tv of" style={brandVars(brand)} role="dialog" aria-modal="true" aria-label="Cardápio e pedidos">
      {content}
      {toast && (
        <div className="of-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
