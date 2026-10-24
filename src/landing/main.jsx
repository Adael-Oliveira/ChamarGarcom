import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/fonts';
import '../shared/base.css';
import '../client/table-view.css';
import './landing.css';
import { isDemo } from '../lib/api';
import { BASE } from '../lib/env';
import PlatformMark, { Wordmark } from '../shared/ui/PlatformMark';
import { PLATFORM_TAGLINE } from '../shared/platform';
import { Icon } from '../shared/ui/Icon';
import TableView from '../client/TableView';
import { ContactButtons, LeadForm, useContacts } from '../shared/ui/Contact';

// Link antigo no formato /?id=TOKEN → página da mesa
const legacy = new URLSearchParams(location.search).get('id');
if (legacy) location.replace(`${BASE}mesa.html?id=${encodeURIComponent(legacy)}`);

const SAMPLE = { name: 'Cantina da Praça', tagline: 'Massas frescas todos os dias', primary: '#C2410C', accent: '#FDBA74', style: 'moderno', logo: null };
const SAMPLE2 = { name: 'Bistrô do Porto', tagline: 'Cozinha de mar, mesa de casa', primary: '#0B5B73', accent: '#5EEAD4', style: 'classico', logo: null };

function Landing() {
  const contacts = useContacts();
  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="lp-logo" href={BASE}>
          <PlatformMark size={30} /> <Wordmark />
        </a>
        <nav className="lp-nav-actions" aria-label="Acesso">
          <a className="btn btn-ghost" href="#quero">
            Quero minha ferramenta
          </a>
          <a className="btn btn-dark" href={`${BASE}admin/`}>
            Login do cliente
          </a>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-copy">
          <h1>O cliente chama pela mesa. A equipe vê na hora.</h1>
          <p>
            Um QR Code em cada mesa. O cliente toca em <strong>Chamar garçom</strong> ou <strong>Pedir a conta</strong> no próprio celular, sem baixar aplicativo e sem cadastro. A chamada aparece no
            caixa com som, e o cliente vê quando alguém está a caminho.
          </p>
          <div className="lp-ctas">
            <a className="btn btn-dark btn-lg" href="#quero">
              Quero minha ferramenta <Icon name="arrowRight" size={18} />
            </a>
            <a className="btn btn-lg" href={`${BASE}teste.html`}>
              <Icon name="phone" size={18} /> Testar como cliente
            </a>
          </div>
          <ul className="lp-facts">
            <li>Funciona no 4G, 5G ou Wi-Fi</li>
            <li>Logo, nome e cores do seu restaurante</li>
            <li>Relatório do tempo de resposta</li>
          </ul>
        </div>
        <div className="lp-visual" aria-hidden="true">
          <div className="lp-phone lp-phone-a">
            <TableView preview brand={SAMPLE2} table={{ number: 7 }} settings={{ callsEnabled: true, billEnabled: true }} phase="viewed" menuAvailable cooldownMs={72000} />
          </div>
          <div className="lp-phone lp-phone-b">
            <TableView preview brand={SAMPLE} table={{ number: 12 }} settings={{ callsEnabled: true, billEnabled: true }} menuAvailable />
          </div>
          <div className="lp-ticket">
            <b>12</b>
            <span>
              <strong>Chamou o garçom</strong>
              <small>0:48 esperando</small>
            </span>
          </div>
        </div>
      </section>

      <section className="lp-steps" aria-labelledby="como">
        <h2 id="como">Como funciona</h2>
        <ol>
          <li>
            <h3>Cadastre as mesas</h3>
            <p>A central gera um QR Code para cada mesa, já com o logo e as cores do restaurante. É só imprimir.</p>
          </li>
          <li>
            <h3>O cliente toca no celular</h3>
            <p>Ele aponta a câmera, abre a página da mesa e chama. Ali também vê o cardápio.</p>
          </li>
          <li>
            <h3>A equipe responde</h3>
            <p>A chamada entra na fila com som e cronômetro. Um clique em Visualizado avisa o cliente na hora.</p>
          </li>
        </ol>
      </section>

      <section className="lp-lead" id="quero" aria-labelledby="quero-t">
        <div className="lp-lead-copy">
          <h2 id="quero-t">Quero minha ferramenta</h2>
          <p>Deixe seu contato e liberamos a central do seu restaurante, já com o seu logo e as suas cores. Você só precisa de uma conta Google.</p>
          <ul className="lp-lead-points">
            <li>
              <Icon name="check" size={18} /> Configuração junto com você
            </li>
            <li>
              <Icon name="check" size={18} /> QR Codes prontos para imprimir
            </li>
            <li>
              <Icon name="check" size={18} /> Sua equipe entra com o próprio Google
            </li>
          </ul>
          <ContactButtons contacts={contacts} />
        </div>
        <div className="lp-lead-card">
          <LeadForm />
        </div>
      </section>

      <footer className="lp-foot">
        <span>
          <Wordmark /> · {PLATFORM_TAGLINE}
        </span>
        <span className="lp-foot-links">
          <a href="#quero">Quero minha ferramenta</a>
          <a href={`${BASE}admin/`}>Login do cliente</a>
          {isDemo && <a href={`${BASE}admin/`}>Demonstração</a>}
        </span>
      </footer>
    </div>
  );
}

if (!legacy)
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Landing />
    </StrictMode>,
  );
