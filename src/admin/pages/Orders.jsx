import { useMemo, useState } from 'react';
import api, { isDemo } from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { useNow, useWatch } from '../hooks';
import { fmtTime } from '../../shared/format';
import { MAX_STAFF_NAME, cleanStaffName } from '../../shared/model';
import { ORDER_STATUS, brl, countsInBill, linesCount, needsPrint, orderCode } from '../../shared/orders';
import { Icon } from '../../shared/ui/Icon';
import { Confirm } from '../../shared/ui/Modal';
import { Empty, PageHeader, Panel, Stat } from '../components/Page';

const NEXT = {
  WAITING: { to: 'NEW', label: 'Aprovar e enviar à cozinha' },
  NEW: { to: 'PREPARING', label: 'Começar preparo' },
  PREPARING: { to: 'READY', label: 'Pronto' },
  READY: { to: 'DELIVERED', label: 'Entregue na mesa' },
};
const COLS = [
  { id: 'WAITING', title: 'Para aprovar', empty: '' },
  { id: 'NEW', title: 'Novos', empty: 'Nenhum pedido novo.' },
  { id: 'PREPARING', title: 'Em preparo', empty: 'Nada no fogo agora.' },
  { id: 'READY', title: 'Prontos para levar', empty: 'Nenhum pedido esperando o garçom.' },
];

/** Imprime a comanda pelo navegador (quando não há impressora da cozinha). */
function printInBrowser(order, brandName) {
  const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const lines = order.items
    .map(
      (l) =>
        `<div class="l"><b>${l.qty}x</b> ${esc(l.name)}</div>${l.opt ? `<div class="o">&gt; ${esc(l.opt)}</div>` : ''}${l.obs ? `<div class="o">OBS: ${esc(l.obs)}</div>` : ''}`,
    )
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Comanda</title><style>
    @page{size:58mm auto;margin:2mm}*{margin:0}body{font:13px/1.35 'Courier New',monospace;width:54mm;color:#000}
    .c{text-align:center}.big{font-size:22px;font-weight:700;margin:2px 0}hr{border:0;border-top:1px dashed #000;margin:6px 0}
    .r{display:flex;justify-content:space-between}.l{margin-top:3px}.o{padding-left:16px;font-weight:700}
  </style></head><body><div class="c">${esc(brandName)}</div><div class="c big">MESA ${order.tableNumber}</div>
  <div class="r"><span>PEDIDO ${orderCode(order.id)}</span><span>${fmtTime(order.createdAt)}</span></div><hr>${lines}
  ${order.note ? `<hr><div class="o">RECADO: ${esc(order.note)}</div>` : ''}<hr><div class="r"><span>ITENS: ${linesCount(order.items)}</span><span>VIA COZINHA</span></div></body></html>`;
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(f);
  f.contentDocument.open();
  f.contentDocument.write(html);
  f.contentDocument.close();
  setTimeout(() => {
    f.contentWindow.focus();
    f.contentWindow.print();
    setTimeout(() => f.remove(), 1000);
  }, 150);
}

function OrderCard({ order, now, busy, onNext, onCancel, onReprint, onPrint, hasPrinter }) {
  const next = NEXT[order.status];
  const age = now - (order.createdAt?.getTime() || now);
  const late = order.status !== 'READY' && age > 20 * 60000;
  return (
    <li className={`oc oc-${order.status} ${late ? 'is-late' : ''}`}>
      <header className="oc-head">
        <span className="oc-table">
          <span>Mesa</span>
          <b>{order.tableNumber}</b>
        </span>
        <span className="oc-meta">
          <strong>Pedido {orderCode(order.id)}</strong>
          <span>
            {fmtTime(order.createdAt)} · há {age < 60000 ? "menos de 1 min" : Math.floor(age / 60000) + " min"}
          </span>
        </span>
        <b className="oc-total">{brl(order.total)}</b>
      </header>
      <ul className="oc-items">
        {order.items.map((l, k) => (
          <li key={k}>
            <b>{l.qty}×</b> {l.name}
            {l.opt && <em>{l.opt}</em>}
            {l.obs && <em className="oc-obs">Obs.: {l.obs}</em>}
          </li>
        ))}
      </ul>
      {order.note && <p className="oc-note">Recado: {order.note}</p>}
      {order.status !== 'WAITING' && hasPrinter && (
        <p className={`oc-print ${order.printed ? 'is-ok' : 'is-wait'}`}>
          <Icon name="print" size={14} />
          {order.printed ? `Comanda impressa${order.printedAt ? ' às ' + fmtTime(order.printedAt) : ''}` : 'Aguardando a impressora…'}
        </p>
      )}
      <div className="oc-actions">
        {next && (
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={onNext}>
            <Icon name="check" size={16} /> {next.label}
          </button>
        )}
        {order.status !== 'WAITING' &&
          (hasPrinter ? (
            <button className="btn btn-sm" disabled={busy || !order.printed} onClick={onReprint} title="Manda a comanda de novo para a impressora">
              <Icon name="refresh" size={16} /> Reimprimir
            </button>
          ) : (
            <button className="btn btn-sm" onClick={onPrint} title="Imprime pelo computador">
              <Icon name="print" size={16} /> Imprimir
            </button>
          ))}
        <button className="btn btn-sm btn-ghost btn-danger" disabled={busy} onClick={onCancel}>
          {order.status === 'WAITING' ? 'Recusar' : 'Cancelar'}
        </button>
      </div>
    </li>
  );
}

function Printers({ printers }) {
  const { rid, run, isOwner } = useAdmin();
  const [pair, setPair] = useState({ code: '', name: 'Cozinha', busy: false });
  const connect = async (e) => {
    e.preventDefault();
    setPair((p) => ({ ...p, busy: true }));
    try {
      await run(() => api.pairDevice(rid, pair.code, pair.name, 'printer'), `Impressora ${cleanStaffName(pair.name)} conectada. As próximas comandas saem nela.`);
      setPair({ code: '', name: 'Cozinha', busy: false });
    } catch {
      setPair((p) => ({ ...p, busy: false }));
    }
  };
  return (
    <Panel
      title="Impressora da cozinha"
      text={
        printers.length
          ? 'A comanda de cada pedido sai sozinha na impressora térmica. Para remover, vá em Equipe.'
          : 'Sem impressora conectada, use o botão Imprimir de cada pedido (sai pela impressora do computador).'
      }
    >
      {printers.length > 0 && (
        <ul className="printers">
          {printers.map((p) => (
            <li key={p.uid}>
              <Icon name="print" size={18} /> <strong>{p.displayName || 'Impressora'}</strong> <span className="pill pill-active">Conectada</span>
            </li>
          ))}
        </ul>
      )}
      {isOwner ? (
        <form className="inline-form" onSubmit={connect}>
          <label className="field field-sm" htmlFor="printer-code">
            <span>Código impresso no papel</span>
            <input
              id="printer-code"
              className="input input-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={pair.code}
              onChange={(e) => setPair((p) => ({ ...p, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            />
          </label>
          <label className="field grow" htmlFor="printer-name">
            <span>Nome</span>
            <input id="printer-name" className="input" maxLength={MAX_STAFF_NAME} value={pair.name} onChange={(e) => setPair((p) => ({ ...p, name: e.target.value }))} />
          </label>
          <button className="btn btn-primary" disabled={pair.busy || pair.code.length !== 6}>
            <Icon name="print" size={16} /> {pair.busy ? 'Conectando…' : 'Conectar impressora'}
          </button>
        </form>
      ) : (
        <p className="muted small">Só a pessoa Responsável conecta a impressora.</p>
      )}
      {isDemo && <p className="muted small">Na demonstração, qualquer código de 6 números conecta uma impressora de exemplo.</p>}
    </Panel>
  );
}

export default function Orders() {
  const { rid, user, myName, orders, run, brand, settings, navigate, can } = useAdmin();
  const team = useWatch((ok, err) => api.watchTeam(rid, ok, err), [rid], { members: [], invites: [] });
  const printers = team.data.members.filter((m) => m.device && m.kind === 'printer');
  const now = useNow(5000);
  const [busy, setBusy] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const who = { uid: user.uid, name: myName };
  const list = orders.data;

  const byStatus = useMemo(() => {
    const m = {};
    for (const o of [...list].sort((a, b) => a.createdAt - b.createdAt)) (m[o.status] ||= []).push(o);
    return m;
  }, [list]);
  const bills = useMemo(() => {
    const m = new Map();
    for (const o of list.filter(countsInBill)) {
      const b = m.get(o.tableId) || { tableId: o.tableId, tableNumber: o.tableNumber, orders: [], total: 0 };
      b.orders.push(o);
      b.total += o.total;
      m.set(o.tableId, b);
    }
    return [...m.values()].sort((a, b) => a.tableNumber - b.tableNumber);
  }, [list]);
  const delivered = (byStatus.DELIVERED || []).slice().reverse();
  const todayTotal = list.filter((o) => o.status !== 'CANCELED' && o.status !== 'WAITING').reduce((a, o) => a + o.total, 0);

  const act = async (o, fn, msg) => {
    setBusy(o.id);
    await run(fn, msg).catch(() => {});
    setBusy(null);
  };
  const advance = (o) => act(o, () => api.setOrderStatus(rid, o.id, NEXT[o.status].to, who));

  const open = COLS.filter((c) => c.id !== 'WAITING' || byStatus.WAITING?.length);

  return (
    <>
      <PageHeader
        title="Pedidos"
        text={settings.ordersEnabled ? 'Pedidos feitos pelo cardápio da mesa, em tempo real.' : 'Os pedidos estão desligados. Ligue em Cardápio.'}
        actions={
          can('cardapio') && (
            <button className="btn" onClick={() => navigate('cardapio')}>
              <Icon name="book" size={16} /> Editar cardápio
            </button>
          )
        }
      />

      <div className="stats">
        <Stat label="Em andamento" value={(byStatus.WAITING?.length || 0) + (byStatus.NEW?.length || 0) + (byStatus.PREPARING?.length || 0) + (byStatus.READY?.length || 0)} tone={byStatus.NEW?.length ? 'wait' : undefined} />
        <Stat label="Entregues hoje" value={delivered.length} />
        <Stat label="Contas abertas" value={bills.length} />
        <Stat label="Pedidos hoje" value={brl(todayTotal)} hint="valor" />
      </div>

      <div className="ob" style={{ '--cols': open.length }}>
        {open.map((c) => (
          <section key={c.id} className={`ob-col ob-${c.id}`} aria-labelledby={`col-${c.id}`}>
            <h2 id={`col-${c.id}`}>
              {c.title} <span>{byStatus[c.id]?.length || 0}</span>
            </h2>
            {byStatus[c.id]?.length ? (
              <ol className="ob-list">
                {byStatus[c.id].map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    now={now}
                    busy={busy === o.id}
                    hasPrinter={printers.length > 0}
                    onNext={() => advance(o)}
                    onCancel={() => setConfirm({ type: 'cancel', o })}
                    onReprint={() => act(o, () => api.reprintOrder(rid, o.id), 'Comanda enviada de novo para a impressora')}
                    onPrint={() => printInBrowser(o, brand.name)}
                  />
                ))}
              </ol>
            ) : (
              <p className="ob-empty">{c.empty}</p>
            )}
          </section>
        ))}
      </div>

      <div className="orders-bottom">
        <Panel title="Contas abertas" text="Soma dos pedidos de cada mesa. Feche a conta quando o cliente pagar.">
          {bills.length ? (
            <ul className="bills">
              {bills.map((b) => (
                <li key={b.tableId}>
                  <span className="oc-table is-small">
                    <span>Mesa</span>
                    <b>{b.tableNumber}</b>
                  </span>
                  <span className="bills-main">
                    <strong>{brl(b.total)}</strong>
                    <small>
                      {b.orders.length} {b.orders.length === 1 ? 'pedido' : 'pedidos'} · {linesCount(b.orders.flatMap((o) => o.items))} itens
                    </small>
                  </span>
                  <button className="btn btn-sm" onClick={() => setConfirm({ type: 'bill', b })}>
                    <Icon name="receipt" size={16} /> Fechar conta
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Nenhuma conta aberta" text="Quando uma mesa fizer pedidos, o total aparece aqui." />
          )}
        </Panel>
        <Printers printers={printers} />
      </div>

      {delivered.length > 0 && (
        <Panel title="Entregues hoje">
          <ul className="delivered">
            {delivered.slice(0, 30).map((o) => (
              <li key={o.id}>
                <span>
                  Mesa <b>{o.tableNumber}</b> · {orderCode(o.id)}
                </span>
                <span className="muted">{o.items.map((l) => `${l.qty}× ${l.name}`).join(', ')}</span>
                <span>{fmtTime(o.statusAt || o.createdAt)}</span>
                <b>{brl(o.total)}</b>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {isDemo && printers.length > 0 && list.some(needsPrint) && (
        <div className="banner banner-alert" role="note">
          <span>
            <Icon name="print" size={18} /> Demonstração: não há impressora de verdade.
          </span>
          <button className="btn btn-sm btn-dark" onClick={() => api.demoPrintPending(rid)}>
            Simular impressão
          </button>
        </div>
      )}

      {confirm?.type === 'cancel' && (
        <Confirm
          title={`${confirm.o.status === 'WAITING' ? 'Recusar' : 'Cancelar'} o pedido da mesa ${confirm.o.tableNumber}?`}
          message="O cliente vê o pedido como cancelado e ele não entra na conta da mesa."
          confirmLabel={confirm.o.status === 'WAITING' ? 'Recusar pedido' : 'Cancelar pedido'}
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            act(confirm.o, () => api.setOrderStatus(rid, confirm.o.id, ORDER_STATUS.CANCELED, who), 'Pedido cancelado');
            setConfirm(null);
          }}
        />
      )}
      {confirm?.type === 'bill' && (
        <Confirm
          title={`Fechar a conta da mesa ${confirm.b.tableNumber}?`}
          message={`Total de ${brl(confirm.b.total)} em ${confirm.b.orders.length} ${confirm.b.orders.length === 1 ? 'pedido' : 'pedidos'}. Os pedidos saem das contas abertas.`}
          confirmLabel="Fechar conta"
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const ids = confirm.b.orders.map((o) => o.id);
            setConfirm(null);
            run(() => api.closeBill(rid, ids), `Conta da mesa ${confirm.b.tableNumber} fechada`).catch(() => {});
          }}
        />
      )}
    </>
  );
}
