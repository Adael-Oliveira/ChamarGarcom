// Escolhe o "banco": Firebase (quando configurado) ou demonstração.
// O resto do app só conversa com `api` e não sabe qual está em uso.
import { backendMode } from '../env';

const api = backendMode === 'firebase' ? (await import('./firebase.js')).default : (await import('./demo.js')).default;

export default api;
export const isDemo = api.mode === 'demo';
