// Nome da plataforma (troque aqui quando definir a marca nova).
export const PLATFORM_TAGLINE = 'Um sinal. Atendimento imediato.';
export const PLATFORM_NAME = 'Acenai';

/** Planos exibidos no site (mesmos valores da apresentação comercial). */
export const PLANS = [
  { id: 'essencial', name: 'Essencial', price: '99,90', tables: 10 },
  { id: 'profissional', name: 'Profissional', price: '149,90', tables: 30, highlight: true },
  { id: 'avancado', name: 'Avançado', price: '249,90', tables: 60, extras: ['Cardápio'] },
];
export const SETUP_FEE = '297,00';

/** Relógio de atendimento (opcional): valor único por unidade, entregue instalado. */
export const WATCH_OFFER = {
  price: '597',
  installments: '3x de R$ 199 sem juros',
  terms: ['Ou em até 3x de R$ 199 sem juros', 'Entregue instalado e funcionando', 'Pronto até o mês seguinte ao pedido'],
  waText: (restaurant) => `Olá! Quero saber do relógio Acenai${restaurant ? ` para o ${restaurant}` : ''}.`,
};

export const planById = (id) => PLANS.find((p) => p.id === id) || null;
/** Limite de mesas do plano; null = restaurante sem plano definido (sem limite). */
export const planTables = (id) => planById(id)?.tables ?? null;
/** Cardápio: só no Avançado (e nos restaurantes sem plano definido). */
export const planHasMenu = (id) => !id || id === 'avancado';
export const planLimitMessage = (id) => `O plano ${planById(id)?.name || ''} permite até ${planTables(id)} mesas. Fale com a gente para ampliar.`;
