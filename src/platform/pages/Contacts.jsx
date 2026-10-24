import { useEffect, useState } from 'react';
import api, { isDemo } from '../../lib/api';
import Switch from '../../shared/ui/Switch';
import { ContactButtons, useContacts } from '../../shared/ui/Contact';
import { PageHeader, Panel } from '../../admin/components/Page';
import { useWatch } from '../../admin/hooks';
import { usePlatform } from '../PlatformApp';

export default function Contacts() {
  const { user, run } = usePlatform();
  const saved = useContacts();
  const platform = useWatch((ok) => api.watchPlatform(ok), [], null);
  const [f, setF] = useState(null);

  // carrega o que está salvo (ou sugere os dados da sua conta, sem publicar)
  useEffect(() => {
    if (saved === undefined || f) return;
    setF({
      name: saved?.name ?? user.name ?? '',
      whatsapp: saved?.whatsapp ?? '',
      email: saved?.email ?? user.email ?? '',
      instagram: saved?.instagram ?? '',
      message: saved?.message ?? '',
    });
  }, [saved]); // eslint-disable-line

  if (!f) return <p className="muted">Carregando…</p>;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const digits = f.whatsapp.replace(/\D/g, '');
  const valid = !digits || (digits.length >= 12 && digits.length <= 13);

  const save = (e) => {
    e.preventDefault();
    if (!valid) return;
    run(() => api.saveContacts(f), 'Contatos publicados').catch(() => {});
  };

  return (
    <>
      <PageHeader title="Contatos e cadastros" text="Os contatos aparecem no site da plataforma e para quem entra com Google sem ter acesso." />

      <div className="contacts-layout">
        <Panel title="Seus contatos">
          <form className="auth-form" onSubmit={save}>
            <label className="field">
              <span>Nome</span>
              <input className="input" value={f.name} onChange={set('name')} maxLength={80} />
            </label>
            <label className="field">
              <span>WhatsApp (com código do país e DDD)</span>
              <input className="input" value={f.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="55 11 98888-7777" maxLength={20} />
              {!valid && <small className="field-error">Use o formato 55 + DDD + número, ex.: 5511988887777.</small>}
            </label>
            <label className="field">
              <span>E-mail</span>
              <input className="input" type="email" value={f.email} onChange={set('email')} maxLength={120} />
            </label>
            <label className="field">
              <span>Instagram (opcional)</span>
              <input className="input" value={f.instagram} onChange={set('instagram')} placeholder="@seuperfil" maxLength={60} />
            </label>
            <div>
              <button className="btn btn-primary" disabled={!valid}>
                {saved ? 'Salvar contatos' : 'Publicar contatos'}
              </button>
            </div>
            {!saved && <p className="muted small">Ainda não publicado: até salvar, os visitantes só veem o formulário “Quero minha ferramenta”.</p>}
          </form>
        </Panel>

        <Panel title="Como os visitantes veem">
          <div className="contacts-preview">
            <strong>Quer o Chamar Garçom no seu restaurante?</strong>
            <ContactButtons contacts={f} />
            {!f.whatsapp && !f.email && !f.instagram && <p className="muted small">Preencha ao menos um contato.</p>}
          </div>
        </Panel>
      </div>

      <Panel title="Cadastro de novos restaurantes">
        <div className="setting-inline">
          <p className="muted small">
            Fechado (recomendado): só entra quem você liberar em Clientes. Aberto: qualquer pessoa que entrar com Google cria o próprio restaurante sozinha.
          </p>
          <Switch
            id="p-signup"
            size="lg"
            checked={!!platform.data?.signupOpen}
            label={platform.data?.signupOpen ? 'Aberto' : 'Fechado'}
            onChange={(v) => (isDemo ? null : run(() => api.setSignupOpen(v), v ? 'Cadastro aberto' : 'Cadastro fechado').catch(() => {}))}
          />
        </div>
      </Panel>
    </>
  );
}
