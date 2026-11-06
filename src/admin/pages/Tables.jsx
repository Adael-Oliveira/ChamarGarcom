import { useEffect, useMemo, useState } from 'react';
import api from '../../lib/api';
import { tableUrl, BASE } from '../../lib/env';
import { useAdmin } from '../AdminApp';
import { download, printSheet, tableCardPng } from '../qr';
import Modal, { Confirm } from '../../shared/ui/Modal';
import Switch from '../../shared/ui/Switch';
import { Icon } from '../../shared/ui/Icon';
import { Empty, PageHeader, Panel } from '../components/Page';
import { planById, planLimitMessage, planTables } from '../../shared/platform';

const num = (v) => {
  const n = Number(String(v).trim());
  return Number.isInteger(n) && n > 0 && n <= 9999 ? n : null;
};

function copy(text, toast, label) {
  const done = () => toast(label);
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text).then(done, () => toast('Não foi possível copiar. Selecione o link e copie manualmente.', 'error'));
  toast('Não foi possível copiar. Selecione o link e copie manualmente.', 'error');
}

function QrModal({ table, brand, onClose, toast }) {
  const [png, setPng] = useState(null);
  const url = tableUrl(table.token);
  useEffect(() => {
    let ok = true;
    tableCardPng(table, brand).then((p) => ok && setPng(p));
    return () => {
      ok = false;
    };
  }, [table, brand]);
  return (
    <Modal
      title={`QR Code da mesa ${table.number}`}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn" onClick={() => copy(url, toast, 'Link copiado')}>
            <Icon name="copy" size={16} /> Copiar link
          </button>
          <button className="btn btn-primary" disabled={!png} onClick={() => download(png, `mesa-${table.number}.png`)}>
            <Icon name="download" size={16} /> Baixar imagem
          </button>
        </>
      }
    >
      <div className="qr-box">{png ? <img src={png} alt={`Cartão com QR Code da mesa ${table.number}`} /> : <span className="spinner" />}</div>
      <p className="qr-url">
        <code>{url}</code>
      </p>
    </Modal>
  );
}

function EditModal({ table, all, onSave, onClose }) {
  const [v, setV] = useState(String(table.number));
  const n = num(v);
  const dup = n && all.some((t) => t.number === n && t.id !== table.id);
  return (
    <Modal
      title={`Editar mesa ${table.number}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={!n || dup} onClick={() => onSave(n)}>
            Salvar
          </button>
        </>
      }
    >
      <label className="field" htmlFor="edit-number">
        <span>Número da mesa</span>
        <input id="edit-number" className="input" type="number" min="1" value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      {dup && <p className="field-error">Já existe uma mesa com esse número.</p>}
    </Modal>
  );
}

/** Exclui várias mesas, uma de cada vez (cada exclusão atualiza a contagem do plano). */
function BulkDeleteModal({ tables, onDelete, onClose, onDone }) {
  const [done, setDone] = useState(-1); // -1 = ainda não começou
  const busy = done >= 0;
  const nums = tables.map((t) => t.number).sort((a, b) => a - b);
  const shown = nums.length > 24 ? `${nums.slice(0, 24).join(', ')} e mais ${nums.length - 24}` : nums.join(', ');
  const go = async () => {
    setDone(0);
    let ok = 0;
    for (const t of tables) {
      try {
        await onDelete(t);
        ok++;
      } catch {
        break; // o erro já foi avisado; para aqui
      }
      setDone(ok);
    }
    onDone(ok, tables.length);
  };
  return (
    <Modal
      title={`Excluir ${tables.length} mesa${tables.length > 1 ? 's' : ''}?`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-danger-solid" onClick={go} disabled={busy}>
            {busy ? `Excluindo ${done} de ${tables.length}…` : `Excluir ${tables.length} mesa${tables.length > 1 ? 's' : ''}`}
          </button>
        </>
      }
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Mesas: <strong>{shown}</strong>
      </p>
      <p className="muted" style={{ margin: 0 }}>
        Os QR Codes dessas mesas deixam de funcionar. O histórico de chamadas continua nos relatórios.
      </p>
    </Modal>
  );
}

export default function Tables() {
  const { rid, tables, brand, run, toast, plan } = useAdmin();
  const list = tables.data;
  const limit = planTables(plan);
  const room = limit == null ? Infinity : Math.max(0, limit - list.length);
  const full = room <= 0;
  const next = list.length ? Math.max(...list.map((t) => t.number)) + 1 : 1;
  const [single, setSingle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const close = () => setModal(null);
  const [selected, setSelected] = useState(() => new Set());
  // tira da seleção mesas que não existem mais
  const sel = useMemo(() => list.filter((t) => selected.has(t.id)), [list, selected]);
  const allOn = list.length > 0 && sel.length === list.length;
  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(list.map((t) => t.id)));

  const addOne = async (e) => {
    e.preventDefault();
    const n = num(single || next);
    if (!n) return toast('Informe um número de mesa válido.', 'error');
    if (list.some((t) => t.number === n)) return toast(`A mesa ${n} já existe.`, 'error');
    if (full) return toast(planLimitMessage(plan), 'error');
    setBusy(true);
    await run(() => api.createTable(rid, n), `Mesa ${n} criada`).catch(() => {});
    setSingle('');
    setBusy(false);
  };

  const addRange = async (e) => {
    e.preventDefault();
    const a = num(from);
    const b = num(to);
    if (!a || !b || b < a) return toast('Informe um intervalo válido, por exemplo de 1 até 20.', 'error');
    if (b - a >= 100) return toast('Crie no máximo 100 mesas por vez.', 'error');
    const have = new Set(list.map((t) => t.number));
    const todo = [];
    for (let i = a; i <= b; i++) if (!have.has(i)) todo.push(i);
    if (!todo.length) return toast('Todas essas mesas já existem.', 'error');
    if (todo.length > room)
      return toast(full ? planLimitMessage(plan) : `Seu plano ainda permite ${room} mesa(s): você pediu ${todo.length}. ${planLimitMessage(plan)}`, 'error');
    setBusy(true);
    try {
      for (const n of todo) await run(() => api.createTable(rid, n));
      toast(`${todo.length} mesa(s) criada(s)`);
      setFrom('');
      setTo('');
    } catch {
      /* já avisado */
    }
    setBusy(false);
  };

  const simulator = () => {
    const ids = list.filter((t) => t.active).slice(0, 3).map((t) => t.token);
    if (!ids.length) return toast('Crie ao menos uma mesa ativa.', 'error');
    window.open(`${BASE}teste.html?ids=${ids.join(',')}`, '_blank', 'noopener');
  };

  return (
    <>
      <PageHeader
        title="Mesas"
        text="Cada mesa tem um link secreto e único. O número da mesa não aparece no link."
        actions={
          <>
            <button className="btn" onClick={simulator}>
              <Icon name="phone" size={16} /> Testar como cliente
            </button>
            <button className="btn" disabled={!list.length} onClick={() => run(() => printSheet(list.filter((t) => t.active), brand)).catch(() => {})}>
              <Icon name="print" size={16} /> Imprimir QR Codes
            </button>
          </>
        }
      />

      {limit != null && (
        <div className={`plan-bar ${full ? 'is-full' : ''}`} role="status">
          <span>
            Plano <strong>{planById(plan).name}</strong> · {list.length} de {limit} mesas
          </span>
          <span className="plan-meter" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (list.length / limit) * 100)}%` }} />
          </span>
          {full && <span className="plan-note">Limite atingido. Fale com a gente para ampliar o plano.</span>}
        </div>
      )}

      <Panel className="add-row">
        <form onSubmit={addOne} className="inline-form">
          <label className="field" htmlFor="new-table">
            <span>Nova mesa</span>
            <input id="new-table" className="input" type="number" min="1" placeholder={`Número (próxima: ${next})`} value={single} onChange={(e) => setSingle(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={busy || full}>
            <Icon name="plus" size={16} /> Criar mesa
          </button>
        </form>
        <form onSubmit={addRange} className="inline-form">
          <label className="field field-sm" htmlFor="range-from">
            <span>Várias de uma vez: da</span>
            <input id="range-from" className="input" type="number" min="1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field field-sm" htmlFor="range-to">
            <span>até a</span>
            <input id="range-to" className="input" type="number" min="1" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="btn" disabled={busy || full}>
            Criar mesas
          </button>
        </form>
      </Panel>

      {tables.loading ? null : !list.length ? (
        <Empty title="Nenhuma mesa ainda" text="Crie a primeira mesa acima. O QR Code é gerado na hora." />
      ) : (
        <>
        {sel.length > 0 && (
          <div className="bulk-bar" role="status">
            <span>
              <strong>{sel.length}</strong> mesa{sel.length > 1 ? 's' : ''} selecionada{sel.length > 1 ? 's' : ''}
            </span>
            <button className="btn btn-sm" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </button>
            <button className="btn btn-sm btn-danger-solid" onClick={() => setModal({ type: 'bulkdel', list: sel })}>
              <Icon name="trash" size={16} /> Excluir selecionadas
            </button>
          </div>
        )}
        <div className="table-scroll panel">
          <table className="data">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" checked={allOn} ref={(el) => el && (el.indeterminate = sel.length > 0 && !allOn)} onChange={toggleAll} aria-label="Selecionar todas as mesas" title="Selecionar todas" />
                </th>
                <th>Mesa</th>
                <th>Situação</th>
                <th>Link</th>
                <th className="ta-r">Ações</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className={`${t.active ? '' : 'is-off'} ${selected.has(t.id) ? 'is-selected' : ''}`}>
                  <td className="col-check">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Selecionar mesa ${t.number}`} />
                  </td>
                  <td>
                    <b className="mesa-n">{t.number}</b>
                  </td>
                  <td>
                    <Switch
                      id={`active-${t.id}`}
                      checked={t.active}
                      label={t.active ? 'Ativa' : 'Desativada'}
                      onChange={(v) => run(() => api.setTableActive(rid, t, v), `Mesa ${t.number} ${v ? 'ativada' : 'desativada'}`).catch(() => {})}
                    />
                  </td>
                  <td>
                    <code title={tableUrl(t.token)}>…?id={t.token.slice(0, 8)}…</code>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm" onClick={() => setModal({ type: 'qr', t })}>
                        <Icon name="qr" size={16} /> QR Code
                      </button>
                      <button className="btn btn-sm" onClick={() => copy(tableUrl(t.token), toast, `Link da mesa ${t.number} copiado`)}>
                        <Icon name="copy" size={16} /> Copiar link
                      </button>
                      <a className="btn btn-sm btn-ghost btn-icon" href={tableUrl(t.token)} target="_blank" rel="noopener" title="Abrir como cliente" aria-label={`Abrir mesa ${t.number} como cliente`}>
                        <Icon name="external" size={16} />
                      </a>
                      <button className="btn btn-sm btn-ghost btn-icon" onClick={() => setModal({ type: 'edit', t })} title="Editar número" aria-label={`Editar mesa ${t.number}`}>
                        <Icon name="edit" size={16} />
                      </button>
                      <button className="btn btn-sm btn-ghost btn-icon" onClick={() => setModal({ type: 'regen', t })} title="Gerar novo link" aria-label={`Gerar novo link da mesa ${t.number}`}>
                        <Icon name="refresh" size={16} />
                      </button>
                      <button className="btn btn-sm btn-ghost btn-icon btn-danger" onClick={() => setModal({ type: 'del', t })} title="Excluir" aria-label={`Excluir mesa ${t.number}`}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {modal?.type === 'qr' && <QrModal table={modal.t} brand={brand} onClose={close} toast={toast} />}
      {modal?.type === 'edit' && <EditModal table={modal.t} all={list} onClose={close} onSave={(n) => run(() => api.updateTableNumber(rid, modal.t, n), 'Mesa atualizada').then(close, () => {})} />}
      {modal?.type === 'regen' && (
        <Confirm
          title={`Gerar novo link da mesa ${modal.t.number}?`}
          message="O QR Code atual desta mesa para de funcionar na hora. Use quando alguém fotografou o QR Code e está chamando de fora. Depois imprima o novo."
          confirmLabel="Gerar novo link"
          onClose={close}
          onConfirm={() => run(() => api.regenerateToken(rid, modal.t), 'Novo link gerado').then(close, () => {})}
        />
      )}
      {modal?.type === 'bulkdel' && (
        <BulkDeleteModal
          tables={modal.list}
          onClose={close}
          onDelete={(t) => run(() => api.deleteTable(rid, t))}
          onDone={(ok, total) => {
            close();
            setSelected(new Set());
            if (ok) toast(ok === total ? `${ok} mesa${ok > 1 ? 's' : ''} excluída${ok > 1 ? 's' : ''}` : `${ok} de ${total} mesas excluídas`);
          }}
        />
      )}
      {modal?.type === 'del' && (
        <Confirm
          title={`Excluir a mesa ${modal.t.number}?`}
          message="O QR Code desta mesa deixa de funcionar. O histórico de chamadas continua nos relatórios."
          confirmLabel="Excluir mesa"
          danger
          onClose={close}
          onConfirm={() => run(() => api.deleteTable(rid, modal.t), 'Mesa excluída').then(close, () => {})}
        />
      )}
    </>
  );
}
