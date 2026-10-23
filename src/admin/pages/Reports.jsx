import { useEffect, useState } from 'react';
import api from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { addDays, fmtDateTime, fmtDuration, fmtFull, fromInputDate, startOfDay, toInputDate } from '../../shared/format';
import { STATUS_LABEL, summarize } from '../../shared/model';
import { Icon } from '../../shared/ui/Icon';
import { Empty, PageHeader, Stat } from '../components/Page';

const PERIODS = [
  ['today', 'Hoje'],
  ['yesterday', 'Ontem'],
  ['7d', 'Últimos 7 dias'],
  ['30d', 'Últimos 30 dias'],
  ['custom', 'Escolher datas'],
];

function range(p, from, to) {
  const t = startOfDay();
  if (p === 'yesterday') return [addDays(t, -1), t];
  if (p === '7d') return [addDays(t, -6), addDays(t, 1)];
  if (p === '30d') return [addDays(t, -29), addDays(t, 1)];
  if (p === 'custom') return [fromInputDate(from), addDays(fromInputDate(to), 1)];
  return [t, addDays(t, 1)];
}

function csv(calls) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Mesa', 'Motivo', 'Chamada em', 'Visualizada em', 'Tempo de resposta', 'Tempo (s)', 'Status'];
  const rows = calls.map((c) => {
    const ms = c.viewedAt ? c.viewedAt - c.calledAt : null;
    return [c.tableNumber, c.reason === 'bill' ? 'Conta' : 'Garçom', fmtFull(c.calledAt), fmtFull(c.viewedAt), ms != null ? fmtDuration(ms) : '', ms != null ? Math.round(ms / 1000) : '', STATUS_LABEL[c.status]];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
}

export default function Reports() {
  const { rid, calls: live } = useAdmin();
  const [period, setPeriod] = useState('today');
  const [from, setFrom] = useState(toInputDate(addDays(new Date(), -30)));
  const [to, setTo] = useState(toInputDate(new Date()));
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  const liveKey = live.data.map((c) => c.id + c.status).join('|');

  useEffect(() => {
    let ok = true;
    const [a, b] = range(period, from, to);
    setState((s) => ({ ...s, loading: true }));
    api.listCalls(rid, a, b).then(
      (rows) => ok && setState({ loading: false, rows, error: null }),
      (error) => ok && setState({ loading: false, rows: [], error }),
    );
    return () => {
      ok = false;
    };
  }, [rid, period, from, to, liveKey]);

  const s = summarize(state.rows);
  const [a, b] = range(period, from, to);
  const exportCsv = () => {
    const blob = new Blob([csv(state.rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const el = document.createElement('a');
    el.href = url;
    el.download = `chamadas_${toInputDate(a)}_a_${toInputDate(addDays(b, -1))}.csv`;
    el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <>
      <PageHeader
        title="Relatórios"
        text="Quantas mesas chamaram e quanto tempo a equipe levou para responder."
        actions={
          <button className="btn" disabled={!state.rows.length} onClick={exportCsv}>
            <Icon name="download" size={16} /> Exportar planilha (CSV)
          </button>
        }
      />

      <div className="filters">
        <div className="segmented" role="radiogroup" aria-label="Período">
          {PERIODS.map(([id, l]) => (
            <button key={id} role="radio" aria-checked={period === id} className={period === id ? 'is-on' : ''} onClick={() => setPeriod(id)}>
              {l}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="inline-form">
            <label className="field field-sm" htmlFor="r-from">
              <span>De</span>
              <input id="r-from" className="input" type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
            </label>
            <label className="field field-sm" htmlFor="r-to">
              <span>Até</span>
              <input id="r-to" className="input" type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} />
            </label>
          </div>
        )}
      </div>

      <div className="stats stats-6">
        <Stat label="Chamadas" value={s.total} />
        <Stat label="Atendidas" value={s.attended} />
        <Stat label="Pendentes" value={s.pending} tone={s.pending ? 'wait' : undefined} />
        <Stat label="Tempo médio" value={fmtDuration(s.avgMs)} />
        <Stat label="Mais rápida" value={fmtDuration(s.minMs)} />
        <Stat label="Mais demorada" value={fmtDuration(s.maxMs)} />
      </div>

      {state.error ? (
        <Empty title="Não foi possível carregar" text={state.error.message} />
      ) : !state.loading && !state.rows.length ? (
        <Empty title="Nenhuma chamada neste período" text="Escolha outro período acima." />
      ) : (
        <div className="table-scroll panel">
          <table className="data">
            <thead>
              <tr>
                <th>Mesa</th>
                <th>Motivo</th>
                <th>Chamada</th>
                <th>Visualizada</th>
                <th>Resposta</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b className="mesa-n">{c.tableNumber}</b>
                  </td>
                  <td>{c.reason === 'bill' ? 'Conta' : 'Garçom'}</td>
                  <td>{fmtDateTime(c.calledAt)}</td>
                  <td>{fmtDateTime(c.viewedAt)}</td>
                  <td className="tnum">{c.viewedAt ? fmtDuration(c.viewedAt - c.calledAt) : '—'}</td>
                  <td>
                    <span className={`pill pill-${c.status}`}>{STATUS_LABEL[c.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
