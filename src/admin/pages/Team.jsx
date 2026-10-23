import { useState } from 'react';
import api, { isDemo } from '../../lib/api';
import { appUrl } from '../../lib/env';
import { useAdmin } from '../AdminApp';
import { useWatch } from '../hooks';
import { fmtDateTime } from '../../shared/format';
import { normalizeEmail } from '../../shared/model';
import { Confirm } from '../../shared/ui/Modal';
import { Icon } from '../../shared/ui/Icon';
import { PageHeader, Panel } from '../components/Page';

export default function Team() {
  const { rid, user, run, toast } = useAdmin();
  const team = useWatch((ok, err) => api.watchTeam(rid, ok, err), [rid], { members: [], invites: [] });
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState(null);
  const adminLink = `${appUrl()}admin/`;

  const invite = async (e) => {
    e.preventDefault();
    const v = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast('Digite um e-mail válido.', 'error');
    if (team.data.members.some((m) => m.email === v)) return toast('Essa pessoa já faz parte da equipe.', 'error');
    await run(() => api.invite(rid, v, user.uid), `Convite criado para ${v}`).catch(() => {});
    setEmail('');
  };

  return (
    <>
      <PageHeader title="Equipe" text="Quem pode usar esta central. Cada pessoa entra com a própria conta Google." />

      <Panel title="Convidar alguém" text={`Depois de convidar, mande este endereço para a pessoa entrar com o e-mail convidado: ${adminLink}`}>
        <form className="inline-form" onSubmit={invite}>
          <label className="field grow" htmlFor="invite-email">
            <span>E-mail da conta Google</span>
            <input id="invite-email" className="input" type="email" placeholder="nome@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn btn-primary">
            <Icon name="mail" size={16} /> Convidar
          </button>
        </form>
      </Panel>

      <Panel title="Pessoas com acesso">
        <ul className="people">
          {team.data.members.map((m) => (
            <li key={m.uid}>
              <span className="avatar">{(m.name || m.email || '?')[0]}</span>
              <span className="people-main">
                <strong>{m.name || m.email}</strong>
                <small>{m.email}</small>
              </span>
              <span className={`pill ${m.role === 'owner' ? 'pill-owner' : ''}`}>{m.role === 'owner' ? 'Responsável' : 'Equipe'}</span>
              {m.role !== 'owner' && m.uid !== user.uid && (
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirm({ type: 'member', m })}>
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {team.data.invites.length > 0 && (
        <Panel title="Convites pendentes" text="Somem daqui quando a pessoa entra pela primeira vez.">
          <ul className="people">
            {team.data.invites.map((i) => (
              <li key={i.email}>
                <span className="avatar is-pending">
                  <Icon name="mail" size={16} />
                </span>
                <span className="people-main">
                  <strong>{i.email}</strong>
                  <small>Convidado em {fmtDateTime(i.createdAt)}</small>
                </span>
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => run(() => api.revokeInvite(i.email), 'Convite cancelado').catch(() => {})}>
                  Cancelar convite
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {isDemo && <p className="muted small">Na demonstração os convites são só ilustrativos.</p>}

      {confirm?.type === 'member' && (
        <Confirm
          title={`Remover ${confirm.m.name || confirm.m.email}?`}
          message="A pessoa perde o acesso à central na hora. Dá para convidar de novo depois."
          confirmLabel="Remover acesso"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => run(() => api.removeMember(confirm.m.uid), 'Acesso removido').then(() => setConfirm(null), () => {})}
        />
      )}
    </>
  );
}
