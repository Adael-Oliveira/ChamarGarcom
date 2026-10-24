import { useMemo, useState } from 'react';
import api from '../../lib/api';
import { appUrl, BASE } from '../../lib/env';
import { fmtDateTime } from '../../shared/format';
import { normalizeEmail } from '../../shared/model';
import Modal, { Confirm } from '../../shared/ui/Modal';
import { Icon } from '../../shared/ui/Icon';
import { Empty, PageHeader, Panel, Stat } from '../../admin/components/Page';
import { usePlatform } from '../PlatformApp';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

export function inviteMessage(restaurant, email) {
  return (
    `Olá! A central do Acenai do ${restaurant} está liberada.\n\n` +
    `1. Acesse ${appUrl()}admin/\n` +
    `2. Entre com a conta Google ${email}\n` +
    `3. Aceite o convite: você entra como Responsável, com controle total do restaurante.\n\n` +
    `Lá você coloca o logo e as cores, cadastra as mesas, imprime os QR Codes e convida a sua equipe.`
  );
}

function statusOf(r) {
  if (r.suspended) return { id: 'paused', label: 'Pausado', tone: 'pill-paused' };
  if (r.members.some((m) => m.role === 'owner')) return { id: 'active', label: 'Ativo', tone: 'pill-active' };
  if (r.invites.some((i) => i.role === 'owner')) return { id: 'waiting', label: 'Aguardando o responsável', tone: 'pill-waiting' };
  return { id: 'none', label: 'Sem responsável', tone: '' };
}

const FILTERS = [
  ['all', 'Todos'],
  ['active', 'Ativos'],
  ['waiting', 'Aguardando'],
  ['paused', 'Pausados'],
];

export default function Clients() {
  const { user, clients, leads, run, toast, navigate } = usePlatform();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [open, setOpen] = useState(null);

  const list = useMemo(() => clients.data.map((r) => ({ ...r, st: statusOf(r), mine: r.members.some((m) => m.uid === user.uid) })), [clients.data, user.uid]);
  const count = (id) => list.filter((r) => r.st.id === id).length;
  const term = q.trim().toLowerCase();
  const shown = list.filter(
    (r) =>
      (filter === 'all' || r.st.id === filter) &&
      (!term || r.name?.toLowerCase().includes(term) || r.ownerEmail?.includes(term) || r.members.some((m) => m.email?.includes(term)) || r.invites.some((i) => i.email.includes(term))),
  );

  const copy = (text, ok = 'Mensagem copiada. Cole no WhatsApp do cliente.') => {
    if (!navigator.clipboard?.writeText) return toast('Não foi possível copiar neste navegador.', 'error');
    navigator.clipboard.writeText(text).then(
      () => toast(ok),
      () => toast('Não foi possível copiar neste navegador.', 'error'),
    );
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        text="Cada cliente é um restaurante. Ao liberar, o responsável recebe o convite e entra com a conta Google dele."
        actions={
          <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>
            <Icon name="plus" size={16} /> Liberar novo cliente
          </button>
        }
      />

      <div className="stats">
        <Stat label="Restaurantes" value={list.length} />
        <Stat label="Ativos" value={count('active')} tone="ok" />
        <Stat label="Aguardando o responsável" value={count('waiting')} tone={count('waiting') ? 'wait' : undefined} />
        <Stat label="Interessados novos" value={leads.data.filter((l) => l.status === 'new').length} hint={<button className="link-btn" onClick={() => navigate('interessados')}>Ver interessados</button>} />
      </div>

      <div className="filters">
        <label className="field search-field" htmlFor="c-search">
          <span className="visually-hidden">Buscar</span>
          <Icon name="search" size={16} />
          <input id="c-search" className="input" placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="segmented" role="radiogroup" aria-label="Situação">
          {FILTERS.map(([id, l]) => (
            <button key={id} role="radio" aria-checked={filter === id} className={filter === id ? 'is-on' : ''} onClick={() => setFilter(id)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {clients.loading ? (
        <p className="muted">Carregando…</p>
      ) : shown.length === 0 ? (
        <Panel>
          <Empty title={list.length ? 'Nada encontrado' : 'Nenhum cliente ainda'} text={list.length ? 'Tente outra busca ou filtro.' : 'Libere o primeiro restaurante pelo botão acima.'} />
        </Panel>
      ) : (
        <ul className="clients">
          {shown.map((r) => {
            const owners = r.members.filter((m) => m.role === 'owner');
            const ownerInvite = r.invites.find((i) => i.role === 'owner');
            const expanded = open === r.id;
            return (
              <li key={r.id} className={`client ${r.suspended ? 'is-paused' : ''}`}>
                <div className="client-row">
                  <span className="client-avatar">{(r.name || '?')[0]}</span>
                  <div className="client-main">
                    <strong>
                      {r.name} {r.mine && <span className="pill">Seu restaurante</span>}
                    </strong>
                    <small>
                      {owners.length ? owners.map((o) => o.email).join(', ') : ownerInvite ? `Convite para ${ownerInvite.email}` : r.ownerEmail || 'Sem responsável'}
                      {r.createdAt && ` · desde ${fmtDateTime(r.createdAt)}`}
                    </small>
                  </div>
                  <span className={`pill ${r.st.tone}`}>{r.st.label}</span>
                  <div className="row-actions">
                    {ownerInvite && !owners.length && (
                      <button className="btn btn-sm" onClick={() => copy(inviteMessage(r.name, ownerInvite.email))}>
                        <Icon name="copy" size={16} /> Copiar convite
                      </button>
                    )}
                    <a className="btn btn-sm" href={`${BASE}admin/?r=${encodeURIComponent(r.id)}`} target="_blank" rel="noopener">
                      <Icon name="lifebuoy" size={16} /> Abrir central
                    </a>
                    <button className="btn btn-sm btn-ghost" onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded}>
                      {expanded ? 'Fechar' : 'Detalhes'}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="client-detail">
                    {r.notes && <p className="client-notes">{r.notes}</p>}
                    <h3>Pessoas com acesso</h3>
                    <ul className="people">
                      {r.members.length === 0 && <li className="muted small">Ninguém entrou ainda.</li>}
                      {r.members.map((m) => (
                        <li key={m.uid}>
                          <span className="avatar">{(m.name || m.email || '?')[0]}</span>
                          <span className="people-main">
                            <strong>{m.name || m.email}</strong>
                            <small>{m.email}</small>
                          </span>
                          <span className={`pill ${m.role === 'owner' ? 'pill-owner' : ''}`}>{m.role === 'owner' ? 'Responsável' : 'Equipe'}</span>
                          {m.uid !== user.uid && (
                            <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setModal({ type: 'remove', r, m })}>
                              Remover
                            </button>
                          )}
                        </li>
                      ))}
                      {r.invites.map((i) => (
                        <li key={i.email}>
                          <span className="avatar is-pending">
                            <Icon name="mail" size={16} />
                          </span>
                          <span className="people-main">
                            <strong>{i.email}</strong>
                            <small>Convite pendente · {fmtDateTime(i.createdAt)}</small>
                          </span>
                          <span className={`pill ${i.role === 'owner' ? 'pill-owner' : ''}`}>{i.role === 'owner' ? 'Responsável' : 'Equipe'}</span>
                          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => run(() => api.revokeInvite(i.email), 'Convite cancelado').catch(() => {})}>
                            Cancelar
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="client-actions">
                      <button className="btn btn-sm" onClick={() => setModal({ type: 'invite', r })}>
                        <Icon name="mail" size={16} /> Convidar responsável
                      </button>
                      <button className="btn btn-sm" onClick={() => setModal({ type: 'edit', r })}>
                        <Icon name="edit" size={16} /> Editar
                      </button>
                      {!r.mine &&
                        (r.suspended ? (
                          <button className="btn btn-sm" onClick={() => run(() => api.setSuspended(r.id, false), `${r.name} reativado`).catch(() => {})}>
                            <Icon name="play" size={16} /> Reativar
                          </button>
                        ) : (
                          <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setModal({ type: 'pause', r })}>
                            <Icon name="pause" size={16} /> Pausar acesso
                          </button>
                        ))}
                      <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setModal({ type: 'delete', r })}>
                        <Icon name="trash" size={16} /> Excluir restaurante
                      </button>
                      <span className="muted small client-id">
                        Código: <code>{r.id}</code>
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modal?.type === 'new' && <NewClient initial={modal.initial} onClose={() => setModal(null)} onCreated={(name, email) => copy(inviteMessage(name, email), 'Cliente liberado. Convite copiado: cole no WhatsApp dele.')} />}
      {modal?.type === 'edit' && <EditClient r={modal.r} onClose={() => setModal(null)} />}
      {modal?.type === 'invite' && <InviteOwner r={modal.r} onClose={() => setModal(null)} onCreated={(email) => copy(inviteMessage(modal.r.name, email), 'Convite criado e copiado.')} />}
      {modal?.type === 'pause' && (
        <Confirm
          title={`Pausar ${modal.r.name}?`}
          message="A equipe deixa de acessar a central e as mesas param de receber chamadas até você reativar. Nada é apagado."
          confirmLabel="Pausar acesso"
          danger
          onClose={() => setModal(null)}
          onConfirm={() => run(() => api.setSuspended(modal.r.id, true), `${modal.r.name} pausado`).then(() => setModal(null), () => {})}
        />
      )}
      {modal?.type === 'delete' && <DeleteClient r={modal.r} onClose={() => setModal(null)} />}
      {modal?.type === 'remove' && (
        <Confirm
          title={`Remover ${modal.m.name || modal.m.email}?`}
          message={`A pessoa perde o acesso à central do ${modal.r.name} na hora.`}
          confirmLabel="Remover acesso"
          danger
          onClose={() => setModal(null)}
          onConfirm={() => run(() => api.removeMember(modal.m.uid), 'Acesso removido').then(() => setModal(null), () => {})}
        />
      )}
    </>
  );
}

function DeleteClient({ r, onClose }) {
  const { run } = usePlatform();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = typed.trim().toLowerCase() === (r.name || '').trim().toLowerCase();
  const go = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      await run(() => api.deleteRestaurant(r.id), `${r.name} excluído`);
      onClose();
    } catch {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Excluir ${r.name}?`}
      onClose={busy ? () => {} : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button className="btn btn-danger-solid" onClick={go} disabled={!ok || busy}>
            {busy ? 'Excluindo…' : 'Excluir para sempre'}
          </button>
        </>
      }
    >
      <div className="auth-form">
        <p className="muted" style={{ margin: 0 }}>
          Apaga mesas, QR Codes, chamadas, relatórios, marca, equipe e convites deste restaurante. Os QR Codes impressos param de funcionar. <strong>Não dá para desfazer.</strong>
          {r.mine && ' Você continua dono da plataforma.'}
        </p>
        <label className="field">
          <span>
            Digite <strong>{r.name}</strong> para confirmar
          </span>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} autoComplete="off" />
        </label>
      </div>
    </Modal>
  );
}

export function NewClient({ initial = {}, onClose, onCreated, onDone }) {
  const { user, run } = usePlatform();
  const [name, setName] = useState(initial.name || '');
  const [email, setEmail] = useState(initial.email || '');
  const [notes, setNotes] = useState(initial.notes || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    const em = normalizeEmail(email);
    if (!name.trim()) return setError('Informe o nome do restaurante.');
    if (!isEmail(em)) return setError('Informe o e-mail da conta Google do responsável.');
    setBusy(true);
    setError('');
    try {
      const rid = await run(() => api.createClient({ name: name.trim(), ownerEmail: em, notes: notes.trim() }, user.uid), null);
      onCreated?.(name.trim(), em);
      await onDone?.(rid);
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Liberar novo cliente"
      onClose={onClose}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="btn btn-primary" form="new-client" disabled={busy}>
            {busy ? 'Liberando…' : 'Liberar e copiar convite'}
          </button>
        </>
      }
    >
      <form id="new-client" className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Nome do restaurante</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Cantina da Praça" />
        </label>
        <label className="field">
          <span>E-mail Google do responsável</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dono@gmail.com" />
          <small className="field-hint">Ele entra como Responsável, com controle total do restaurante (marca, mesas, equipe).</small>
        </label>
        <label className="field">
          <span>Observações (só você vê)</span>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} placeholder="Plano, telefone, combinado…" />
        </label>
        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}

function EditClient({ r, onClose }) {
  const { run } = usePlatform();
  const [name, setName] = useState(r.name || '');
  const [notes, setNotes] = useState(r.notes || '');
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    run(() => api.updateClient(r.id, { name: name.trim(), notes: notes.trim() }), 'Cliente atualizado').then(onClose, () => {});
  };
  return (
    <Modal
      title={`Editar ${r.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="btn btn-primary" form="edit-client">
            Salvar
          </button>
        </>
      }
    >
      <form id="edit-client" className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>Nome do restaurante</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </label>
        <label className="field">
          <span>Observações (só você vê)</span>
          <textarea className="input" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} />
        </label>
      </form>
    </Modal>
  );
}

function InviteOwner({ r, onClose, onCreated }) {
  const { user, run } = usePlatform();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const em = normalizeEmail(email);
    if (!isEmail(em)) return setError('Digite um e-mail válido.');
    run(() => api.invite(r.id, em, user.uid, 'owner'), null).then(
      () => {
        onCreated(em);
        onClose();
      },
      (err) => setError(err.message),
    );
  };
  return (
    <Modal
      title={`Convidar responsável · ${r.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="btn btn-primary" form="invite-owner">
            Convidar e copiar
          </button>
        </>
      }
    >
      <form id="invite-owner" className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>E-mail Google</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@gmail.com" />
          <small className="field-hint">A pessoa entra como Responsável deste restaurante.</small>
        </label>
        {error && <p className="field-error">{error}</p>}
      </form>
    </Modal>
  );
}
