import { createRoot } from 'react-dom/client';
import '../shared/fonts';
import '../shared/base.css';
import { BASE } from '../lib/env';

// GitHub Pages: /admin sem barra ou link quebrado → manda para o lugar certo
const path = location.pathname.replace(/\/+$/, '');
if (path.endsWith('/admin') || path.endsWith('/plataforma')) location.replace(path + '/' + location.search + location.hash);

createRoot(document.getElementById('root')).render(
  <div className="fullscreen">
    <div style={{ textAlign: 'center', maxWidth: 360 }}>
      <h1 style={{ fontFamily: 'var(--display)', margin: '0 0 8px' }}>Página não encontrada</h1>
      <p className="muted">Se você veio de um QR Code, escaneie de novo. Se é da equipe, entre pela central.</p>
      <a className="btn btn-dark" href={`${BASE}admin/`}>
        Ir para a central
      </a>
    </div>
  </div>,
);
