import { useState } from 'react';
import api, { isDemo } from '../../lib/api';
import { appUrl } from '../../lib/env';
import { useAdmin } from '../AdminApp';
import { useWatch } from '../hooks';
import { fmtDateTime } from '../../shared/format';
import { MAX_STAFF_NAME, PERMS, cleanPerms, cleanStaffName, normalizeEmail, permsOf, staffName } from '../../shared/model';
import Modal, { Confirm } from '../../shared/ui/Modal';
import { Icon } from '../../shared/ui/Icon';
import { PageHeader, Panel } from '../components/Page';

const ROLES = {
  staff: { label: 'Equipe', text: 'Atende as mesas. Você escolhe o que mais a pessoa pode fazer.' },
  owner: { label: 'Responsável', text: 'Controle total do restaurante: também personaliza a marca e gerencia a equipe.' },
};

/** Resumo curto do que a pessoa pode fazer. */
function permsSummary(m) {
  if (m.role === 'owner') return 'Controle total';
  const p = permsOf(m);
  if (!p.length) return 'Só atendimento das mesas';
  return 'Atendimento + ' + PERMS.filter((x) => p.includes(x.id)).map((x) => x.label.split(' ')[0]).join(', ');
}

/** Caixas de permissão (o atendimento das mesas vem sempre marcado). */
function PermsPicker({ value, onChange, idPrefix }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <fieldset className="perm-pick">
      <legend>O que essa pessoa pode fazer</legend>
      <label className="perm-option is-fixed" htmlFor={`${idPrefix}-atender`}>
        <input id={`${idPrefix}-atender`} type="checkbox" checked disabled />
        <span>
          <strong>Atender as mesas</strong>
          <small>Vê as chamadas e clica em Visualizado. Fica registrado quem atendeu, quando e qual mesa.</small>
        </span>
      </label>
      {PERMS.map((p) => (
        <label key={p.id} className={`perm-option ${value.includes(p.id) ? 'is-on' : ''}`} htmlFor={`${idPrefix}-${p.id}`}>
          <input id={`${idPrefix}-${p.id}`} type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} />
          <span>
            <strong>{p.label}</strong>
            <small>{p.text}</small>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function EditMember({ member, onClose, onSave }) {
  const [name, setName] = useState(member.displayName || staffName(member));
  const [perms, setPerms] = useState(permsOf(member));
  const [busy, setBusy] = useState(false);
  const staff = member.role === 'staff';
  const submit = async (e) => {
    e?.preventDefault();
    setBusy(true);
    await onSave({ displayName: cleanStaffName(name), perms: cleanPerms(perms) }).then(onClose, () => setBusy(false));
  };
  return (
    <Modal
      title={`Editar ${staffName(member) || member.email}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form className="invite-form" onSubmit={submit}>
        <label className="field" htmlFor="edit-name">
          <span>Nome que aparece no painel e nos relatórios</span>
          <input id="edit-name" className="input" maxLength={MAX_STAFF_NAME} placeholder={member.name || 'Ex.: Bia'} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="muted small">Conta Google: {member.email}</p>
        {staff ? <PermsPicker value={perms} onChange={setPerms} idPrefix="edit" /> : <p className="muted small">Responsável tem controle total do restaurante.</p>}
      </form>
    </Modal>
  );
}

export default function Team() {
  const { rid, user, brand, run, toast } = useAdmin();
  const team = useWatch((ok, err) => api.watchTeam(rid, ok, err), [rid], { members: [], invites: [] });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [perms, setPerms] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const [editing, setEditing] = useState(null);
  const adminLink = `${appUrl()}admin/`;

  const inviteText = (i) =>
    `Olá${i.displayName ? `, ${i.displayName}` : ''}! Você foi convidado como ${ROLES[i.role]?.label || 'Equipe'} da central do ${brand.name}.\n` +
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
    const n = cleanStaffName(name);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return toast('Digite um e-mail válido.', 'error');
    if (team.data.members.some((m) => m.email === v)) return toast('Essa pessoa já faz parte da equipe.', 'error');
    try {
      await run(() => api.invite(rid, v, user.uid, role, { displayName: n, perms }), `Convite criado para ${n || v} como ${ROLES[role].label}`);
      copyInvite({ email: v, role, displayName: n });
      setName('');
      setEmail('');
      setRole('staff');
      setPerms([]);
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
          <div className="invite-row">
            <label className="field" htmlFor="invite-name">
              <span>Nome do funcionário</span>
              <input id="invite-name" className="input" maxLength={MAX_STAFF_NAME} placeholder="Ex.: Bia" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field" htmlFor="invite-email">
              <span>E-mail da conta Google</span>
              <input id="invite-email" className="input" type="email" placeholder="nome@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
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
          {role === 'staff' && <PermsPicker value={perms} onChange={setPerms} idPrefix="invite" />}
          <div>
            <button className="btn btn-primary">
              <Icon name="mail" size={16} /> Convidar e copiar convite
            </button>
          </div>
        </form>
        <p className="muted small invite-help">
          O convite vale só para esse e-mail. Ao criar, a mensagem com o endereço da central é copiada: cole no WhatsApp da pessoa. Ela entra com essa conta Google e aceita o convite. O nome e as permissões dá
          para mudar depois.
        </p>
      </Panel>

      <Panel title="Pessoas com acesso">
        <ul className="people">
          {team.data.members.map((m) => (
            <li key={m.uid}>
              <span className="avatar">{(staffName(m) || '?')[0]}</span>
              <span className="people-main">
                <strong>
                  {staffName(m) || m.email}
                  {m.uid === user.uid ? ' (você)' : ''}
                </strong>
                <small>
                  {m.email} · {permsSummary(m)}
                </small>
              </span>
              <span className={`pill ${m.role === 'owner' ? 'pill-owner' : ''}`}>{ROLES[m.role]?.label || 'Equipe'}</span>
              <button className="btn btn-sm" onClick={() => setEditing(m)}>
                <Icon name="edit" size={16} /> Editar
              </button>
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
                  <strong>{i.displayName || i.email}</strong>
                  <small>
                    {i.displayName ? `${i.email} · ` : ''}
                    {permsSummary(i)} · convidado em {fmtDateTime(i.createdAt)}
                  </small>
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

      {editing && (
        <EditMember
          member={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => run(() => api.updateMember(editing.uid, editing, patch), 'Alterações salvas. Valem na hora, sem a pessoa sair da central.')}
        />
      )}

      {confirm?.type === 'member' && (
        <Confirm
          title={`Remover ${staffName(confirm.m) || confirm.m.email}?`}
          message="A pessoa perde o acesso à central na hora. Os atendimentos dela continuam nos relatórios. Dá para convidar de novo depois."
          confirmLabel="Remover acesso"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => run(() => api.removeMember(confirm.m.uid), 'Acesso removido').then(() => setConfirm(null), () => {})}
        />
      )}
    </>
  );
}
