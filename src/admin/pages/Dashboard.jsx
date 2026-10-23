import { useMemo, useState } from 'react';
import api from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { useNow } from '../hooks';
import { CALL_STATUS, LATE_AFTER_MINUTES, VIEWED_DISPLAY_MINUTES, summarize } from '../../shared/model';
import { fmtClock, fmtDuration, fmtTime, startOfDay } from '../../shared/format';
import { Icon } from '../../shared/ui/Icon';
import Switch from '../../shared/ui/Switch';
import { Empty, PageHeader, Stat } from '../components/Page';

function stateOf(table, call, now) {
  if (!table.active) return 'off';
  if (!call) return 'free';
  if (call.status === CALL_STATUS.PENDING) {
    const late = now - call.calledAt > LATE_AFTER_MINUTES * 60000;
    return late ? 'late' : call.reason === 'bill' ? 'bill' : 'wait';
  }
  if (call.status === CALL_STATUS.VIEWED && call.viewedAt && now - call.viewedAt < VIEWED_DISPLAY_MINUTES * 60000) return 'viewed';
  return 'free';
}

const STATE_LABEL = {
  free: 'Livre',
  wait: 'Chamando o garçom',
  bill: 'Pediu a conta',
  late: 'Esperando há muito tempo',
  viewed: 'Atendimento a caminho',
  off: 'Mesa desativada',
};

/** Ticket de chamada na fila: o que o caixa precisa ver de longe. */
function Ticket({ call, now, onViewed, busy }) {
  const waited = now - call.calledAt;
  const late = waited > LATE_AFTER_MINUTES * 60000;
  const bill = call.reason === 'bill';
  const pct = Math.min(1, waited / (LATE_AFTER_MINUTES * 60000));
  return (
    <li className={`ticket ${bill ? 'is-bill' : ''} ${late ? 'is-late' : ''}`}>
      <div className="ticket-num">
        <span>Mesa</span>
        <b>{call.tableNumber}</b>
      </div>
      <div className="ticket-info">
        <strong>{bill ? 'Pediu a conta' : 'Chamou o garçom'}</strong>
        <span className="ticket-time">
          <span className="ticket-clock">{fmtClock(waited)}</span> esperando · {fmtTime(call.calledAt)}
        </span>
        <span className="ticket-bar" aria-hidden="true">
          <i style={{ width: `${pct * 100}%` }} />
        </span>
      </div>
      <button className="btn ticket-btn" onClick={() => onViewed(call)} disabled={busy}>
        <Icon name="check" /> Visualizado
      </button>
    </li>
  );
}

function TableTile({ table, call, now, onViewed, onDone, busy }) {
  const st = stateOf(table, call, now);
  const pending = st === 'wait' || st === 'bill' || st === 'late';
  return (
    <div className={`tile tile-${st}`}>
      <div className="tile-top">
        <b className="tile-num">{table.number}</b>
        <span className="tile-dot" aria-hidden="true" />
      </div>
      <span className="tile-state">{STATE_LABEL[st]}</span>
      <span className="tile-time">
        {pending ? `há ${fmtDuration(now - call.calledAt)}` : call ? `Última: ${fmtTime(call.calledAt)}` : 'Sem chamadas hoje'}
      </span>
      {pending && (
        <button className="btn btn-sm tile-btn" onClick={() => onViewed(call)} disabled={busy}>
          <Icon name="check" size={16} /> Visualizado
        </button>
      )}
      {st === 'viewed' && (
        <button className="btn btn-sm btn-ghost tile-btn" onClick={() => onDone(call)} disabled={busy}>
          Liberar mesa
        </button>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { rid, user, settings, tables, calls, run, navigate } = useAdmin();
  const now = useNow(1000);
  const [busy, setBusy] = useState(null);

  const list = calls.data;
  const lastByTable = useMemo(() => {
    const m = new Map();
    for (const c of list) if (!m.has(c.tableId)) m.set(c.tableId, c);
    return m;
  }, [list]);
  const queue = useMemo(() => list.filter((c) => c.status === CALL_STATUS.PENDING).sort((a, b) => a.calledAt - b.calledAt), [list]);
  const today = summarize(list.filter((c) => c.calledAt >= startOfDay()));

  const act = async (call, fn) => {
    setBusy(call.id);
    await run(fn).catch(() => {});
    setBusy(null);
  };
  const viewed = (c) => act(c, () => api.markViewed(rid, c.id, user.uid));
  const done = (c) => act(c, () => api.markDone(rid, c.id));

  const known = new Set(tables.data.map((t) => t.id));
  const orphans = queue.filter((c) => !known.has(c.tableId)); // mesa excluída com chamada aberta

  return (
    <>
      <PageHeader
        title="Painel"
        text="Atualiza sozinho, em tempo real."
        actions={
          <div className={`live-switch ${settings.callsEnabled ? 'is-on' : 'is-off'}`}>
            <span className="live-dot" aria-hidden="true" />
            <span className="live-text">{settings.callsEnabled ? 'Chamadas ativas' : 'Chamadas desativadas'}</span>
            <Switch
              id="calls-enabled"
              checked={settings.callsEnabled}
              onChange={(v) => run(() => api.saveSettings(rid, { callsEnabled: v }), v ? 'Chamadas ativadas' : 'Chamadas desativadas').catch(() => {})}
            />
          </div>
        }
      />

      <div className="stats">
        <Stat label="Na fila agora" value={queue.length} tone={queue.length ? 'wait' : undefined} />
        <Stat label="Atendidas hoje" value={today.attended} />
        <Stat label="Tempo médio de resposta" value={fmtDuration(today.avgMs)} hint="hoje" />
        <Stat label="Pedidos de conta" value={today.bills} hint="hoje" />
      </div>

      <div className="board">
        <section className="queue" aria-labelledby="fila-titulo">
          <div className="queue-head">
            <h2 id="fila-titulo">Fila</h2>
            <span>{queue.length ? 'mais antiga primeiro' : ''}</span>
          </div>
          {queue.length ? (
            <ol className="tickets">
              {queue.map((c) => (
                <Ticket key={c.id} call={c} now={now} onViewed={viewed} busy={busy === c.id} />
              ))}
            </ol>
          ) : (
            <div className="queue-empty">
              <Icon name="bell" size={26} />
              <p>Nenhuma mesa chamando.</p>
              <small>Quando um cliente tocar no QR Code da mesa, a chamada aparece aqui com som.</small>
            </div>
          )}
        </section>

        <section className="tables-area" aria-labelledby="mesas-titulo">
          <div className="queue-head">
            <h2 id="mesas-titulo">Mesas</h2>
            <div className="legend">
              <span className="lg-wait">Chamando</span>
              <span className="lg-bill">Conta</span>
              <span className="lg-viewed">A caminho</span>
              <span className="lg-free">Livre</span>
            </div>
          </div>
          {tables.loading ? null : tables.data.length === 0 ? (
            <Empty title="Nenhuma mesa cadastrada" text="Cadastre as mesas para gerar os QR Codes.">
              <button className="btn btn-primary" onClick={() => navigate('mesas')}>
                <Icon name="plus" /> Cadastrar mesas
              </button>
            </Empty>
          ) : (
            <div className="tiles">
              {tables.data.map((t) => (
                <TableTile key={t.id} table={t} call={lastByTable.get(t.id)} now={now} busy={busy === lastByTable.get(t.id)?.id} onViewed={viewed} onDone={done} />
              ))}
              {orphans.map((c) => (
                <TableTile key={c.id} table={{ id: c.tableId, number: c.tableNumber, active: true }} call={c} now={now} busy={busy === c.id} onViewed={viewed} onDone={done} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
