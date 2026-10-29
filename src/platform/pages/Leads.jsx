import { useState } from 'react';
import api from '../../lib/api';
import { fmtDateTime } from '../../shared/format';
import { Confirm } from '../../shared/ui/Modal';
import { Icon } from '../../shared/ui/Icon';
import { fmtPhone, waLink } from '../../shared/ui/Contact';
import { Empty, PageHeader, Panel } from '../../admin/components/Page';
import { usePlatform } from '../PlatformApp';
import { NewClient, inviteMessage } from './Clients';

const STATUS = {
  new: 'Novo',
  contacted: 'Em contato',
  client: 'Virou cliente',
  archived: 'Arquivado',
};
const FILTERS = [['open', 'Em aberto'], ['new', 'Novos'], ['contacted', 'Em contato'], ['client', 'Clientes'], ['archived', 'Arquivados'], ['all', 'Todos']];

export default function Leads() {
  const { leads, run, toast, navigate } = usePlatform();
  const [filter, setFilter] = useState('open');
  const [modal, setModal] = useState(null);

  const shown = leads.data.filter((l) => (filter === 'all' ? true : filter === 'open' ? l.status === 'new' || l.status === 'contacted' : l.status === filter));
  const copy = (text) =>
    navigator.clipboard?.writeText(text).then(
      () => toast('Cliente liberado. Convite copiado: cole no WhatsApp dele.'),
      () => toast('Cliente liberado.'),
    );

  return (
    <>
      <PageHeader title="Interessados" text="Quem pediu a ferramenta pelo site ou ao tentar entrar sem acesso. Converse, combine e libere como cliente." />

      <div className="filters">
        <div className="segmented" role="radiogroup" aria-label="Situação">
          {FILTERS.map(([id, l]) => (
            <button key={id} role="radio" aria-checked={filter === id} className={filter === id ? 'is-on' : ''} onClick={() => setFilter(id)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {leads.loading ? (
        <p className="muted">Carregando…</p>
      ) : shown.length === 0 ? (
        <Panel>
          <Empty title="Nenhum interessado aqui" text="Os pedidos feitos em “Quero uma demonstração” aparecem nesta lista na hora." />
        </Panel>
      ) : (
        <ul className="clients">
          {shown.map((l) => (
            <li key={l.id} className={`client lead lead-${l.status}`}>
              <div className="client-row">
                <span className="client-avatar">{(l.restaurant || l.name || '?')[0]}</span>
                <div className="client-main">
                  <strong>{l.restaurant || l.name}</strong>
                  <small>
                    {l.name}
                    {l.city && ` · ${l.city}`} · {fmtDateTime(l.createdAt)}
                  </small>
                </div>
                <label className="field lead-status">
                  <span className="visually-hidden">Situação</span>
                  <select className="input" value={l.status} onChange={(e) => run(() => api.setLeadStatus(l.id, e.target.value)).catch(() => {})}>
                    {Object.entries(STATUS).map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {l.message && <p className="client-notes">{l.message}</p>}
              <div className="client-actions">
                <a className="btn btn-sm btn-wa" href={waLink(l.phone.length <= 11 ? '55' + l.phone : l.phone, `Olá, ${l.name}! Aqui é do Acenai. Vi seu interesse${l.restaurant ? ` para o ${l.restaurant}` : ''} no Acenai.`)} target="_blank" rel="noopener noreferrer">
                  <Icon name="whatsapp" size={16} /> {fmtPhone(l.phone)}
                </a>
                {l.email && (
                  <a className="btn btn-sm" href={`mailto:${l.email}`}>
                    <Icon name="mail" size={16} /> {l.email}
                  </a>
                )}
                {l.status !== 'client' && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() =>
                      setModal({
                        type: 'convert',
                        lead: l,
                        initial: { name: l.restaurant || '', email: l.email || '', notes: [l.name, l.phone && fmtPhone(l.phone), l.city].filter(Boolean).join(' · ') },
                      })
                    }
                  >
                    <Icon name="check" size={16} /> Liberar como cliente
                  </button>
                )}
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setModal({ type: 'delete', lead: l })}>
                  <Icon name="trash" size={16} /> Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal?.type === 'convert' && (
        <NewClient
          initial={modal.initial}
          onClose={() => setModal(null)}
          onCreated={(name, email) => copy(inviteMessage(name, email))}
          onDone={async () => {
            await api.setLeadStatus(modal.lead.id, 'client').catch(() => {});
            navigate('clientes');
          }}
        />
      )}
      {modal?.type === 'delete' && (
        <Confirm
          title={`Excluir o contato de ${modal.lead.name}?`}
          message="O pedido some da lista. Se só quer tirar da frente, prefira Arquivado."
          confirmLabel="Excluir"
          danger
          onClose={() => setModal(null)}
          onConfirm={() => run(() => api.deleteLead(modal.lead.id), 'Contato excluído').then(() => setModal(null), () => {})}
        />
      )}
    </>
  );
}
