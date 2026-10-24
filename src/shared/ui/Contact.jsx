import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { Icon } from './Icon';
import '../contact.css';

/** Contatos públicos do dono da plataforma (definidos em Plataforma → Contatos). */
export function useContacts() {
  const [contacts, setContacts] = useState(undefined);
  useEffect(() => api.watchContacts((c) => setContacts(c || null)), []);
  return contacts; // undefined = carregando, null = ainda não configurado
}

export const waLink = (number, text) => `https://wa.me/${String(number || '').replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export function fmtPhone(v) {
  const d = String(v || '').replace(/\D/g, '');
  const n = d.startsWith('55') && d.length > 11 ? d.slice(2) : d;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return v || '';
}

/** Botões de contato (WhatsApp, e-mail, Instagram). Não mostra nada se não houver contatos. */
export function ContactButtons({ contacts, text = 'Olá! Tenho interesse no Acenai para o meu restaurante.', size = '' }) {
  if (!contacts) return null;
  const { whatsapp, email, instagram } = contacts;
  if (!whatsapp && !email && !instagram) return null;
  return (
    <div className="contact-buttons">
      {whatsapp && (
        <a className={`btn btn-wa ${size}`} href={waLink(whatsapp, text)} target="_blank" rel="noopener noreferrer">
          <Icon name="whatsapp" size={18} /> Falar no WhatsApp
        </a>
      )}
      {email && (
        <a className={`btn ${size}`} href={`mailto:${email}?subject=${encodeURIComponent('Acenai para o meu restaurante')}&body=${encodeURIComponent(text)}`}>
          <Icon name="mail" size={18} /> {email}
        </a>
      )}
      {instagram && (
        <a className={`btn ${size}`} href={`https://instagram.com/${instagram.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer">
          <Icon name="instagram" size={18} /> @{instagram.replace(/^@/, '')}
        </a>
      )}
    </div>
  );
}

const onlyDigits = (v) => v.replace(/\D/g, '');

/** Formulário "Quero minha ferramenta": o pedido chega em Plataforma → Interessados. */
export function LeadForm({ initial = {}, onSent, compact }) {
  const [f, setF] = useState({ name: initial.name || '', restaurant: '', city: '', phone: '', email: initial.email || '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [trap, setTrap] = useState(''); // campo invisível: só robô preenche
  const openedAt = useRef(Date.now());
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.restaurant.trim()) return setError('Preencha seu nome e o nome do restaurante.');
    const phone = onlyDigits(f.phone);
    if (phone.length < 10 || phone.length > 13) return setError('Informe um WhatsApp com DDD, ex.: (11) 98888-7777.');
    if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setError('Confira o e-mail.');
    setBusy(true);
    setError('');
    // robô (campo escondido preenchido ou envio instantâneo): finge que deu certo e não grava
    if (trap || Date.now() - openedAt.current < 2500) {
      await new Promise((r) => setTimeout(r, 600));
      setSent(true);
      setBusy(false);
      return;
    }
    try {
      await api.createLead({ ...f, phone, email: f.email.trim().toLowerCase() });
      setSent(true);
      onSent?.();
    } catch {
      setError('Não foi possível enviar agora. Tente de novo ou fale pelo WhatsApp.');
    }
    setBusy(false);
  };

  if (sent)
    return (
      <div className="lead-sent" role="status">
        <span className="lead-sent-icon">
          <Icon name="check" size={22} />
        </span>
        <div>
          <strong>Recebemos seu contato!</strong>
          <p>Vamos falar com você pelo WhatsApp informado para combinar a liberação do seu restaurante.</p>
        </div>
      </div>
    );

  return (
    <form className={`lead-form ${compact ? 'is-compact' : ''}`} onSubmit={submit} noValidate>
      <label className="field">
        <span>Seu nome</span>
        <input className="input" value={f.name} onChange={set('name')} maxLength={80} autoComplete="name" required />
      </label>
      <label className="field">
        <span>Restaurante</span>
        <input className="input" value={f.restaurant} onChange={set('restaurant')} maxLength={80} placeholder="Ex.: Cantina da Praça" required />
      </label>
      <label className="field">
        <span>WhatsApp</span>
        <input className="input" value={f.phone} onChange={set('phone')} maxLength={20} inputMode="tel" autoComplete="tel" placeholder="(11) 98888-7777" required />
      </label>
      <label className="field">
        <span>Cidade</span>
        <input className="input" value={f.city} onChange={set('city')} maxLength={80} autoComplete="address-level2" />
      </label>
      <label className="field lead-wide">
        <span>E-mail (conta Google que vai usar)</span>
        <input className="input" type="email" value={f.email} onChange={set('email')} maxLength={120} autoComplete="email" placeholder="nome@gmail.com" />
      </label>
      {!compact && (
        <label className="field lead-wide">
          <span>Quer contar algo? (opcional)</span>
          <textarea className="input" rows={3} value={f.message} onChange={set('message')} maxLength={600} placeholder="Quantas mesas, quando quer começar…" />
        </label>
      )}
      <label className="lead-trap" aria-hidden="true">
        Site
        <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </label>
      <div className="lead-wide">
        <button className="btn btn-dark btn-lg btn-block" disabled={busy}>
          {busy ? 'Enviando…' : 'Quero minha ferramenta'}
        </button>
        {error && <p className="field-error">{error}</p>}
        <p className="lead-privacy">Usamos seus dados só para falar com você sobre a ferramenta. Nada é compartilhado.</p>
      </div>
    </form>
  );
}
