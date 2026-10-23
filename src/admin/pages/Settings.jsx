import { useEffect, useState } from 'react';
import api, { isDemo } from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { chime, useWatch } from '../hooks';
import Switch from '../../shared/ui/Switch';
import { Confirm } from '../../shared/ui/Modal';
import { Icon } from '../../shared/ui/Icon';
import { PageHeader } from '../components/Page';

function Row({ title, text, children }) {
  return (
    <section className="setting">
      <div>
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      <div className="setting-control">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { rid, settings: s, isOwner, run, soundOn, setSoundOn, user, admin } = useAdmin();
  const [cd, setCd] = useState(String(s.cooldownMinutes));
  const [reset, setReset] = useState(false);
  useEffect(() => setCd(String(s.cooldownMinutes)), [s.cooldownMinutes]);
  const platform = useWatch((ok) => api.watchPlatform(ok), [], null);
  const isPlatformOwner = platform.data?.ownerUid === user.uid;

  const n = Number(cd);
  const valid = Number.isInteger(n) && n >= 0 && n <= 60;
  const save = (patch, msg) => run(() => api.saveSettings(rid, patch), msg).catch(() => {});

  return (
    <>
      <PageHeader title="Configurações" />

      <div className="settings">
        <Row title="Chamadas" text="Desligado: o cliente ainda vê o cardápio, mas recebe “Chamadas temporariamente indisponíveis”.">
          <Switch id="s-calls" size="lg" checked={s.callsEnabled} label={s.callsEnabled ? 'Ligado' : 'Desligado'} onChange={(v) => save({ callsEnabled: v }, v ? 'Chamadas ativadas' : 'Chamadas desativadas')} />
        </Row>

        <Row title="Botão “Pedir a conta”" text="Mostra um segundo botão na página da mesa. A chamada chega na fila marcada como conta.">
          <Switch id="s-bill" size="lg" checked={s.billEnabled} label={s.billEnabled ? 'Ligado' : 'Desligado'} onChange={(v) => save({ billEnabled: v }, v ? 'Botão de conta ativado' : 'Botão de conta desativado')} />
        </Row>

        <Row title="Intervalo entre chamadas" text="Quanto tempo a mesma mesa espera para chamar de novo. Conferido também no servidor.">
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) save({ cooldownMinutes: n }, 'Intervalo salvo');
            }}
          >
            <div className="segmented" role="radiogroup" aria-label="Minutos">
              {[1, 2, 3, 5, 10].map((p) => (
                <button key={p} type="button" role="radio" aria-checked={n === p} className={n === p ? 'is-on' : ''} onClick={() => setCd(String(p))}>
                  {p} min
                </button>
              ))}
            </div>
            <label className="field field-xs" htmlFor="s-cd">
              <span className="visually-hidden">Minutos</span>
              <input id="s-cd" className="input" type="number" min="0" max="60" value={cd} onChange={(e) => setCd(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={!valid || n === s.cooldownMinutes}>
              Salvar
            </button>
          </form>
          {!valid && <p className="field-error">Use um número inteiro de 0 a 60.</p>}
        </Row>

        <Row title="Som de nova chamada" text="Toca neste computador quando uma mesa chama. Clique em qualquer lugar da central uma vez para o navegador liberar o som.">
          <button className="btn btn-sm" onClick={() => chime()}>
            <Icon name="volume" size={16} /> Testar
          </button>
          <Switch id="s-sound" size="lg" checked={soundOn} label={soundOn ? 'Ligado' : 'Desligado'} onChange={setSoundOn} />
        </Row>

        {isPlatformOwner && !isDemo && (
          <Row title="Novos restaurantes" text="Permite que qualquer pessoa que entrar com Google crie o próprio restaurante nesta plataforma. Deixe desligado se só você vai usar.">
            <Switch id="s-signup" size="lg" checked={!!platform.data?.signupOpen} label={platform.data?.signupOpen ? 'Abertos' : 'Fechados'} onChange={(v) => run(() => api.setSignupOpen(v), v ? 'Cadastros abertos' : 'Cadastros fechados').catch(() => {})} />
          </Row>
        )}

        <Row title="Informações para suporte">
          <dl className="kv">
            <dt>Conta</dt>
            <dd>{user.email}</dd>
            <dt>Função</dt>
            <dd>{isOwner ? 'Responsável' : 'Equipe'}</dd>
            <dt>Restaurante</dt>
            <dd>
              <code>{admin.restaurantId}</code>
            </dd>
            <dt>Banco de dados</dt>
            <dd>{isDemo ? 'Demonstração (neste navegador)' : 'Firebase'}</dd>
          </dl>
        </Row>

        {isDemo && (
          <Row title="Recomeçar a demonstração" text="Volta mesas, chamadas e personalização ao exemplo inicial.">
            <button className="btn btn-danger" onClick={() => setReset(true)}>
              <Icon name="refresh" size={16} /> Recomeçar
            </button>
          </Row>
        )}
      </div>

      {reset && (
        <Confirm
          title="Recomeçar a demonstração?"
          message="Tudo o que você mudou neste navegador será apagado."
          confirmLabel="Recomeçar"
          danger
          onClose={() => setReset(false)}
          onConfirm={() => {
            api.resetDemo();
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
