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

const ROLES = {
  staff: { label: 'Equipe', text: 'Atende as chamadas, cuida das mesas, do cardápio e vê relatórios.' },
  owner: { label: 'Responsável', text: 'Controle total do restaurante: também personaliza a marca e gerencia a equipe.' },
};

export default function Team() {
  const { rid, user, brand, run, toast } = useAdmin();
  const team = useWatch((ok, err) => api.watchTeam(rid, ok, err), [rid], { members: [], invites: [] });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [confirm, setConfirm] = useState(null);
  const adminLink = `${appUrl()}admin/`;

  const inviteText = (i) =>
    `Olá! Você foi convidado como ${ROLES[i.role]?.label || 'Equipe'} da central do ${brand.name}.\n` +
    `Acesse ${adminLink} e entre com a conta Google ${i.email}.`;

  const copyInvite = (i) => {
    const text = inviteText(i);
    if (!navigator.clipboard?.writeText) return toast('Não foi possível copiar. Envie o endereço da central e o e-mail convidado.', 'error');
    navigator.clipboard.writeText(text).then(
      () => toast('Convite copiado. Cole no WhatsApp ou e-mail da pessoa.'),
      () => toast('Não foi possível copiar. Envie o endereço da central e o e-mail convidado.', 'error'),
    );
  };

  const invite = async (e) => {
    e.preventDefault();
    const v = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast('Digite um e-mail válido.', 'error');
    if (team.data.members.some((m) => m.email === v)) return toast('Essa pessoa já faz parte da equipe.', 'error');
    try {
      await run(() => api.invite(rid, v, user.uid, role), `Convite criado para ${v} como ${ROLES[role].label}`);
      copyInvite({ email: v, role });
      setEmail('');
      setRole('staff');
    } catch {
      /* já avisado */
    }
  };

  return (
    <>
      <PageHeader
        title="Equipe"
        text="Só entra na central quem estiver aqui. Qualquer outra conta Google que tentar entrar não vê nada do restaurante."
      />

      <Panel title="Convidar alguém">
        <form className="invite-form" onSubmit={invite}>
          <label className="field" htmlFor="invite-email">
            <span>E-mail da conta Google</span>
            <input id="invite-email" className="input" type="email" placeholder="nome@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <fieldset className="role-pick">
            <legend>Papel</legend>
            {Object.entries(ROLES).map(([id, r]) => (
              <label key={id} className={`role-option ${role === id ? 'is-on' : ''}`} htmlFor={`role-${id}`}>
                <input id={`role-${id}`} type="radio" name="role" value={id} checked={role === id} onChange={() => setRole(id)} />
                <span>
                  <strong>{r.label}</strong>
                  <small>{r.text}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <button className="btn btn-primary">
              <Icon name="mail" size={16} /> Convidar e copiar convite
            </button>
          </div>
        </form>
        <p className="muted small invite-help">
          O convite vale só para esse e-mail. Ao criar, a mensagem com o endereço da central é copiada: cole no WhatsApp da pessoa. Ela entra com essa conta Google e aceita o convite.
        </p>
      </Panel>

      <Panel title="Pessoas com acesso">
        <ul className="people">
          {team.data.members.map((m) => (
            <li key={m.uid}>
              <span className="avatar">{(m.name || m.email || '?')[0]}</span>
              <span className="people-main">
                <strong>
                  {m.name || m.email}
                  {m.uid === user.uid ? ' (você)' : ''}
                </strong>
                <small>{m.email}</small>
              </span>
              <span className={`pill ${m.role === 'owner' ? 'pill-owner' : ''}`}>{ROLES[m.role]?.label || 'Equipe'}</span>
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
                <span className={`pill ${i.role === 'owner' ? 'pill-owner' : ''}`}>{ROLES[i.role]?.label || 'Equipe'}</span>
                <button className="btn btn-sm" onClick={() => copyInvite(i)}>
                  <Icon name="copy" size={16} /> Copiar convite
                </button>
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => run(() => api.revokeInvite(i.email), 'Convite cancelado').catch(() => {})}>
                  Cancelar
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
