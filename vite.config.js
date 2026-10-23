import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Caminho onde o site fica publicado.
//   GitHub Pages: https://USUARIO.github.io/ChamarGarcom/  → /ChamarGarcom/
//   (o workflow preenche sozinho com o nome do repositório)
//   Local (npm run dev): /
function normalizeBase(value) {
  let base = (value || '/').trim();
  if (!base.startsWith('/')) base = '/' + base;
  if (!base.endsWith('/')) base += '/';
  return base;
}

// /admin (sem barra) → /admin/ também no servidor de desenvolvimento
function trailingSlash(base) {
  return {
    name: 'trailing-slash',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [path, query] = req.url.split('?');
        if (path === base + 'admin') {
          res.statusCode = 302;
          res.setHeader('Location', path + '/' + (query ? '?' + query : ''));
          return res.end();
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = normalizeBase(env.VITE_BASE_PATH);
  const r = (p) => resolve(import.meta.dirname, p);
  return {
    base,
    plugins: [react(), trailingSlash(base)],
    server: { host: true, port: 5173 },
    preview: { host: true, port: 4173 },
    build: {
      rollupOptions: {
        input: {
          index: r('index.html'),
          admin: r('admin/index.html'),
          mesa: r('mesa.html'),
          teste: r('teste.html'),
          404: r('404.html'),
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
            if (id.includes('node_modules/react')) return 'react';
          },
        },
      },
    },
  };
});
