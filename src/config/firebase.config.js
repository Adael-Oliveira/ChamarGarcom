// =====================================================================
//  CONFIGURAÇÃO DO FIREBASE
//  Cole aqui os dados do seu Web App (Console do Firebase → ⚙ Configurações
//  do projeto → Geral → Seus apps → Configuração do SDK → "Config").
//
//  Estes valores são PÚBLICOS por natureza (vão para o navegador de qualquer
//  forma). Quem protege os dados são as regras (firestore.rules / storage.rules).
//
//  Enquanto apiKey estiver vazio, o site roda em MODO DEMONSTRAÇÃO: tudo
//  funciona, mas os dados ficam só no navegador de quem está usando.
//
//  Também dá para usar variáveis de ambiente (VITE_FIREBASE_API_KEY etc.);
//  quando existem, elas têm prioridade sobre este arquivo.
// =====================================================================
export default {
  apiKey: 'AIzaSyAQwZB04QYBtttFujfPsz7o8P5owV8E60Y',
  authDomain: 'chamar-garcom-33051.firebaseapp.com',
  projectId: 'chamar-garcom-33051',
  storageBucket: 'chamar-garcom-33051.firebasestorage.app',
  messagingSenderId: '256680075456',
  appId: '1:256680075456:web:e1c5cf02fb522536c50d25',
};
