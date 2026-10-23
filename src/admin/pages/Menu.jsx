import { useEffect, useRef, useState } from 'react';
import api, { isDemo } from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { fmtDateTime } from '../../shared/format';
import { Icon } from '../../shared/ui/Icon';
import { PageHeader, Panel } from '../components/Page';

export default function Menu() {
  const { rid, settings: s, run, toast } = useAdmin();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [link, setLink] = useState('');
  const [openUrl, setOpenUrl] = useState(null);

  useEffect(() => {
    let ok = true;
    api.resolveMenuUrl(s, rid).then((u) => ok && setOpenUrl(u));
    return () => {
      ok = false;
    };
  }, [s.menuUrl, s.menuUpdatedAt, rid]); // eslint-disable-line

  const send = async () => {
    if (!file) return;
    setProgress(0);
    try {
      await api.uploadMenu(rid, file, s.menuPath, setProgress);
      toast('Cardápio enviado. Já aparece em todas as mesas.');
      setFile(null);
      if (input.current) input.current.value = '';
    } catch (e) {
      toast(e.message, 'error');
    }
    setProgress(null);
  };

  const saveLink = (e) => {
    e.preventDefault();
    const url = link.trim();
    if (!/^https:\/\/\S+$/i.test(url)) return toast('O link precisa começar com https://', 'error');
    run(() => api.setMenuLink(rid, url, s.menuPath), 'Link do cardápio salvo').then(() => setLink(''), () => {});
  };

  const isLink = s.menuUrl && !s.menuFileName;

  return (
    <>
      <PageHeader title="Cardápio" text="O botão “Ver cardápio” da página da mesa abre o arquivo ou o link que você definir aqui." />

      <div className="menu-grid">
        <Panel title="Cardápio atual">
          {s.menuUrl ? (
            <div className="menu-current">
              <span className={`file-badge ${isLink ? 'is-link' : ''}`}>{isLink ? <Icon name="link" /> : 'PDF'}</span>
              <div className="menu-meta">
                <strong>{isLink ? s.menuUrl : s.menuFileName}</strong>
                <span>Atualizado em {fmtDateTime(s.menuUpdatedAt)}</span>
              </div>
              {openUrl && (
                <a className="btn btn-sm" href={openUrl} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={16} /> Abrir
                </a>
              )}
              <button className="btn btn-sm btn-danger" onClick={() => run(() => api.removeMenu(rid, s.menuPath), 'Cardápio removido').catch(() => {})}>
                <Icon name="trash" size={16} /> Remover
              </button>
            </div>
          ) : (
            <p className="muted">Nenhum cardápio ainda. Na mesa, o botão aparece como “Cardápio indisponível”.</p>
          )}
        </Panel>

        <Panel title="Enviar PDF" text={isDemo ? 'Na demonstração o arquivo fica guardado neste navegador.' : 'Usa o Firebase Storage (exige o plano Blaze no Firebase). Até 20 MB.'}>
          <div className="upload">
            <input ref={input} id="menu-file" type="file" accept="application/pdf,.pdf" className="visually-hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <label htmlFor="menu-file" className="btn">
              <Icon name="upload" size={16} /> Escolher PDF
            </label>
            <span className="upload-name">{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : 'Nenhum arquivo escolhido'}</span>
            <button className="btn btn-primary" disabled={!file || progress !== null} onClick={send}>
              {progress !== null ? `Enviando ${Math.round(progress * 100)}%` : 'Enviar'}
            </button>
          </div>
          {progress !== null && (
            <div className="progress" aria-hidden="true">
              <i style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </Panel>

        <Panel title="Ou usar um link" text="Google Drive (compartilhado com “qualquer pessoa com o link”), Dropbox, Instagram ou o site do restaurante. Não precisa do Storage.">
          <form className="inline-form" onSubmit={saveLink}>
            <label className="field grow" htmlFor="menu-link">
              <span className="visually-hidden">Link do cardápio</span>
              <input id="menu-link" className="input" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
            </label>
            <button className="btn btn-primary" disabled={!link.trim()}>
              Salvar link
            </button>
          </form>
        </Panel>
      </div>
    </>
  );
}
