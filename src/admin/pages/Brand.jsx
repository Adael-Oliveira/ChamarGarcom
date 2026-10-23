import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { contrast, sanitizeBrand } from '../../lib/theme/brand';
import { fileToLogo } from '../../lib/theme/logo';
import { BRAND_PRESETS, BRAND_STYLES, HEX } from '../../shared/model';
import BrandMark from '../../shared/ui/BrandMark';
import { Icon } from '../../shared/ui/Icon';
import TableView from '../../client/TableView';
import { PageHeader, Panel } from '../components/Page';

const FIELDS = ['name', 'tagline', 'logo', 'primary', 'accent', 'style'];
const same = (a, b) => FIELDS.every((k) => (a[k] ?? '') === (b[k] ?? ''));

function ColorField({ id, label, value, onChange }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div className="field">
      <span>{label}</span>
      <div className="color-field">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={label} />
        <input
          className="input"
          value={text}
          maxLength={7}
          aria-label={`${label} em hexadecimal`}
          onChange={(e) => {
            const v = e.target.value.startsWith('#') ? e.target.value : '#' + e.target.value;
            setText(v);
            if (HEX.test(v)) onChange(v.toUpperCase());
          }}
        />
      </div>
    </div>
  );
}

export default function Brand() {
  const { rid, brand, brandLoading, settings, run, toast } = useAdmin();
  const [draft, setDraft] = useState(brand);
  const [previewPhase, setPreviewPhase] = useState('idle');
  const [busyLogo, setBusyLogo] = useState(false);
  const fileRef = useRef(null);
  const loaded = useRef(false);

  // carrega a marca salva uma vez; depois o rascunho é seu até salvar/descartar
  useEffect(() => {
    if (!brandLoading && !loaded.current) {
      setDraft(brand);
      loaded.current = true;
    }
  }, [brandLoading, brand]);

  const d = useMemo(() => sanitizeBrand(draft), [draft]);
  const dirty = !same(d, brand);
  const set = (patch) => setDraft((x) => ({ ...x, ...patch }));
  const weak = contrast(d.primary, '#ffffff') < 3 && contrast(d.primary, '#14161b') < 3;

  const onLogo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusyLogo(true);
    try {
      set({ logo: await fileToLogo(f) });
    } catch (err) {
      toast(err.message, 'error');
    }
    setBusyLogo(false);
  };

  const save = () => {
    if (!d.name.trim()) return toast('O nome do restaurante não pode ficar vazio.', 'error');
    const patch = Object.fromEntries(FIELDS.map((k) => [k, k === 'name' || k === 'tagline' ? (d[k] || '').trim() : d[k] ?? null]));
    run(() => api.saveBrand(rid, patch), 'Personalização salva. A página das mesas já foi atualizada.').catch(() => {});
  };

  return (
    <>
      <PageHeader
        title="Personalizar"
        text="Nome, logo e cores do restaurante. Aparecem na página que o cliente abre pelo QR Code, nos QR Codes impressos e aqui na central."
        actions={
          <>
            <button className="btn" disabled={!dirty} onClick={() => setDraft(brand)}>
              Descartar
            </button>
            <button className="btn btn-primary" disabled={!dirty} onClick={save}>
              {dirty ? 'Salvar alterações' : 'Tudo salvo'}
            </button>
          </>
        }
      />

      <div className="brand-layout">
        <div className="brand-form">
          <Panel title="Identidade">
            <div className="logo-row">
              <BrandMark brand={d} size={84} />
              <div className="logo-actions">
                <input ref={fileRef} id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="visually-hidden" onChange={onLogo} />
                <label htmlFor="logo-file" className="btn">
                  <Icon name="image" size={16} /> {busyLogo ? 'Processando…' : d.logo ? 'Trocar logo' : 'Enviar logo'}
                </label>
                {d.logo && (
                  <button className="btn btn-ghost btn-danger" onClick={() => set({ logo: null })}>
                    Remover
                  </button>
                )}
                <p className="field-hint">PNG com fundo transparente fica melhor. A imagem é reduzida automaticamente. Sem logo, usamos as iniciais.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field" htmlFor="brand-name">
                <span>Nome do restaurante</span>
                <input id="brand-name" className="input" maxLength={60} value={draft.name || ''} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label className="field" htmlFor="brand-tagline">
                <span>Frase curta (opcional)</span>
                <input id="brand-tagline" className="input" maxLength={60} placeholder="Ex.: Comida caseira desde 1998" value={draft.tagline || ''} onChange={(e) => set({ tagline: e.target.value })} />
              </label>
            </div>
          </Panel>

          <Panel title="Cores" text="Comece por uma combinação pronta e ajuste se quiser.">
            <div className="presets" role="list">
              {BRAND_PRESETS.map((p) => {
                const on = p.primary === d.primary && p.accent === d.accent;
                return (
                  <button key={p.id} role="listitem" className={`preset ${on ? 'is-on' : ''}`} onClick={() => set({ primary: p.primary, accent: p.accent })} aria-pressed={on}>
                    <span className="preset-swatch" style={{ background: p.primary }}>
                      <i style={{ background: p.accent }} />
                    </span>
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="form-grid">
              <ColorField id="c-primary" label="Cor principal" value={d.primary} onChange={(v) => set({ primary: v })} />
              <ColorField id="c-accent" label="Cor de destaque" value={d.accent} onChange={(v) => set({ accent: v })} />
            </div>
            {weak && <p className="field-error">Essa cor principal tem pouco contraste com texto. Prefira um tom mais escuro ou mais claro.</p>}
          </Panel>

          <Panel title="Estilo" text="Define as fontes e o arredondamento da página da mesa.">
            <div className="styles">
              {Object.entries(BRAND_STYLES).map(([id, s]) => (
                <button key={id} className={`style-card ${d.style === id ? 'is-on' : ''}`} onClick={() => set({ style: id })} aria-pressed={d.style === id} style={{ borderRadius: Math.min(s.radius, 22) }}>
                  <span className="style-sample" style={{ fontFamily: s.display }}>
                    Aa
                  </span>
                  <span className="style-name">{s.label}</span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <aside className="brand-preview" aria-label="Pré-visualização">
          <div className="preview-tabs" role="tablist" aria-label="Estado da pré-visualização">
            {[
              ['idle', 'Inicial'],
              ['pending', 'Chamando'],
              ['viewed', 'A caminho'],
            ].map(([id, l]) => (
              <button key={id} role="tab" aria-selected={previewPhase === id} className={previewPhase === id ? 'is-on' : ''} onClick={() => setPreviewPhase(id)}>
                {l}
              </button>
            ))}
          </div>
          <div className="phone">
            <div className="phone-screen">
              <TableView
                preview
                brand={d}
                table={{ number: 12, active: true }}
                settings={{ ...settings, callsEnabled: true }}
                phase={previewPhase}
                cooldownMs={previewPhase === 'idle' ? 0 : 84000}
                menuAvailable
              />
            </div>
          </div>
          <p className="preview-note">{dirty ? 'Pré-visualização das alterações ainda não salvas.' : 'É assim que o cliente vê a mesa 12.'}</p>
        </aside>
      </div>
    </>
  );
}
