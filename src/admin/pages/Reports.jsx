import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { addDays, fmtDateTime, fmtDuration, fmtFull, fromInputDate, startOfDay, toInputDate } from '../../shared/format';
import { STATUS_LABEL, staffName, summarize } from '../../shared/model';
import { useWatch } from '../hooks';
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

function csv(calls, nameOf) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = ['Mesa', 'Motivo', 'Chamada em', 'Atendida por', 'Visualizada em', 'Tempo de resposta', 'Tempo (s)', 'Liberada por', 'Liberada em', 'Status'];
  const rows = calls.map((c) => {
    const ms = c.viewedAt ? c.viewedAt - c.calledAt : null;
    return [
      c.tableNumber,
      c.reason === 'bill' ? 'Conta' : 'Garçom',
      fmtFull(c.calledAt),
      nameOf(c.viewedBy, c.viewedByName),
      fmtFull(c.viewedAt),
      ms != null ? fmtDuration(ms) : '',
      ms != null ? Math.round(ms / 1000) : '',
      nameOf(c.doneBy, c.doneByName),
      fmtFull(c.doneAt),
      STATUS_LABEL[c.status],
    ];
  });
  return '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n');
}

export default function Reports() {
  const { rid, calls: live } = useAdmin();
  const team = useWatch((ok, err) => api.watchTeam(rid, ok, err), [rid], { members: [], invites: [] });
  const [period, setPeriod] = useState('today');
  const [person, setPerson] = useState('all');
  const [from, setFrom] = useState(toInputDate(addDays(new Date(), -30)));
  const [to, setTo] = useState(toInputDate(new Date()));
  const [state, setState] = useState({ loading: true, rows: [], error: null });
  const liveKey = live.data.map((c) => c.id + c.status).join('|');

  useEffect(() => setPerson('all'), [period, from, to]);

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

  // nome atual da pessoa (se ainda está na equipe) ou o nome gravado no atendimento
  const names = useMemo(() => new Map(team.data.members.map((m) => [m.uid, staffName(m)])), [team.data.members]);
  const nameOf = (uid, saved) => (uid && names.get(uid)) || saved || (uid ? 'Ex-membro da equipe' : '');
  const keyOf = (c) => c.viewedBy || (c.viewedByName ? 'n:' + c.viewedByName : null);

  // ranking por atendente no período
  const people = useMemo(() => {
    const m = new Map();
    for (const c of state.rows) {
      const k = keyOf(c);
      if (!k || !c.viewedAt) continue;
      const p = m.get(k) || { key: k, name: nameOf(c.viewedBy, c.viewedByName), n: 0, total: 0, bills: 0 };
      p.n += 1;
      p.total += c.viewedAt - c.calledAt;
      if (c.reason === 'bill') p.bills += 1;
      m.set(k, p);
    }
    return [...m.values()].sort((x, y) => y.n - x.n);
  }, [state.rows, names]);
  const untracked = state.rows.filter((c) => c.viewedAt && !keyOf(c)).length;

  const rows = person === 'all' ? state.rows : state.rows.filter((c) => keyOf(c) === person);
  const s = summarize(rows);
  const [a, b] = range(period, from, to);
  const exportCsv = () => {
    const blob = new Blob([csv(rows, nameOf)], { type: 'text/csv;charset=utf-8' });
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
        text="Quantas mesas chamaram, quem atendeu e quanto tempo levou para responder."
        actions={
          <button className="btn" disabled={!rows.length} onClick={exportCsv}>
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
        {people.length > 0 && (
          <label className="field field-sm" htmlFor="r-person">
            <span>Atendente</span>
            <select id="r-person" className="input" value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="all">Toda a equipe</option>
              {people.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
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

      {people.length > 0 && person === 'all' && (
        <section className="panel people-rank" aria-labelledby="rank-titulo">
          <h2 id="rank-titulo">Atendimentos por pessoa</h2>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Atendente</th>
                  <th className="tnum">Mesas atendidas</th>
                  <th className="tnum">Pedidos de conta</th>
                  <th className="tnum">Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <button className="link-btn" onClick={() => setPerson(p.key)}>
                        {p.name}
                      </button>
                    </td>
                    <td className="tnum">{p.n}</td>
                    <td className="tnum">{p.bills}</td>
                    <td className="tnum">{fmtDuration(p.total / p.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {untracked > 0 && <p className="muted small">{untracked} atendimento(s) deste período são de antes do registro de quem atendeu.</p>}
        </section>
      )}

      {state.error ? (
        <Empty title="Não foi possível carregar" text={state.error.message} />
      ) : !state.loading && !rows.length ? (
        <Empty title="Nenhuma chamada neste período" text="Escolha outro período acima." />
      ) : (
        <div className="table-scroll panel">
          <table className="data">
            <thead>
              <tr>
                <th>Mesa</th>
                <th>Motivo</th>
                <th>Chamada</th>
                <th>Atendida por</th>
                <th>Visualizada</th>
                <th>Resposta</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>
                    <b className="mesa-n">{c.tableNumber}</b>
                  </td>
                  <td>{c.reason === 'bill' ? 'Conta' : 'Garçom'}</td>
                  <td>{fmtDateTime(c.calledAt)}</td>
                  <td>{nameOf(c.viewedBy, c.viewedByName) || '—'}</td>
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
