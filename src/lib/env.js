import fileConfig from '../config/firebase.config.js';

const env = import.meta.env;
const pick = (envKey, fileKey) => (env[envKey] || fileConfig[fileKey] || '').trim();

export const firebaseConfig = {
  apiKey: pick('VITE_FIREBASE_API_KEY', 'apiKey'),
  authDomain: pick('VITE_FIREBASE_AUTH_DOMAIN', 'authDomain'),
  projectId: pick('VITE_FIREBASE_PROJECT_ID', 'projectId'),
  storageBucket: pick('VITE_FIREBASE_STORAGE_BUCKET', 'storageBucket'),
  messagingSenderId: pick('VITE_FIREBASE_MESSAGING_SENDER_ID', 'messagingSenderId'),
  appId: pick('VITE_FIREBASE_APP_ID', 'appId'),
};

/** true = usa os emuladores locais do Firebase (npm run emulators). */
export const useEmulators = env.VITE_USE_EMULATORS === 'true';

/** 'firebase' quando há configuração (ou emuladores); senão 'demo'. */
export const backendMode =
  useEmulators || (firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId) ? 'firebase' : 'demo';

export const BASE = env.BASE_URL; // ex.: /ChamarGarcom/

/** Endereço público do app (usado nos links e QR Codes das mesas). */
export function appUrl() {
  const override = env.VITE_PUBLIC_APP_URL;
  if (override) return override.endsWith('/') ? override : override + '/';
  return window.location.origin + BASE;
}

export const tableUrl = (token) => `${appUrl()}mesa.html?id=${encodeURIComponent(token)}`;
