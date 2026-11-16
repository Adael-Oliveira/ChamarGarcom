import { useEffect, useMemo, useRef, useState } from 'react';
import api, { isDemo } from '../../lib/api';
import { useAdmin } from '../AdminApp';
import { useWatch } from '../hooks';
import { fmtDateTime } from '../../shared/format';
import { Icon } from '../../shared/ui/Icon';
import Modal, { Confirm } from '../../shared/ui/Modal';
import Switch from '../../shared/ui/Switch';
import { Empty, PageHeader, Panel } from '../components/Page';
import { planHasMenu } from '../../shared/platform';
import { EMPTY_MENU, brl, menuItemCount, newId, parsePrice, priceInput, sanitizeMenu } from '../../shared/orders';
import { fileToMenuPhoto } from '../../lib/theme/logo';

const move = (list, i, d) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
};

/** Foto do item na central (carrega sob demanda). */
const photoCache = new Map();
function Thumb({ rid, id, size = 56 }) {
  const [src, setSrc] = useState(() => photoCache.get(id) || null);
  useEffect(() => {
    if (!id) return setSrc(null);
    if (photoCache.get(id)) return setSrc(photoCache.get(id));
    let ok = true;
    api.getMenuImage(rid, id).then((d) => {
      photoCache.set(id, d);
      if (ok) setSrc(d);
    });
    return () => {
      ok = false;
    };
  }, [rid, id]);
  return (
    <span className="mi-thumb" style={{ width: size, height: Math.round((size * 3) / 4) }}>
      {id ? src ? <img src={src} alt="" /> : null : <Icon name="image" size={18} />}
    </span>
  );
}

/* ------------------------------------------------------------------ item */
function ItemModal({ rid, item, onSave, onClose }) {
  const [name, setName] = useState(item.name || '');
  const [desc, setDesc] = useState(item.desc || '');
  const [price, setPrice] = useState(priceInput(item.id ? item.price : null));
  const [tag, setTag] = useState(item.tag || '');
  const [hasOpts, setHasOpts] = useState(!!item.opts);
  const [optTitle, setOptTitle] = useState(item.opts?.title || '');
  const [choices, setChoices] = useState((item.opts?.choices || []).join('\n'));
  const [img, setImg] = useState(item.img || null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const file = useRef(null);
  const original = useRef(item.img || null);

  const pick = async (f) => {
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      const data = await fileToMenuPhoto(f);
      const id = await api.saveMenuImage(rid, data);
      photoCache.set(id, data);
      if (img && img !== original.current) api.deleteMenuImage(rid, img);
      setImg(id);
      setPreview(data);
    } catch (e) {
      setErr(e.message || 'Não foi possível usar esta foto.');
    }
    setBusy(false);
    if (file.current) file.current.value = '';
  };

  const submit = (e) => {
    e?.preventDefault();
    const p = parsePrice(price);
    if (!name.trim()) return setErr('Dê um nome para o item.');
    if (p == null) return setErr('Confira o preço. Ex.: 29,90');
    const list = choices
      .split(/\n|;/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (hasOpts && list.length < 2) return setErr('Coloque pelo menos duas opções, uma por linha.');
    onSave({
      ...item,
      id: item.id || newId('i'),
      name: name.trim(),
      desc: desc.trim(),
      price: p,
      tag: tag.trim() || null,
      img,
      available: item.available !== false,
      opts: hasOpts ? { title: optTitle.trim() || 'Escolha', choices: list } : null,
    });
    if (original.current && original.current !== img) api.deleteMenuImage(rid, original.current);
  };
  const cancel = () => {
    if (img && img !== original.current) api.deleteMenuImage(rid, img); // foto enviada e não usada
    onClose();
  };

  return (
    <Modal
      title={item.id ? `Editar ${item.name}` : 'Novo item'}
      onClose={cancel}
      width={620}
      footer={
        <>
          <button className="btn" onClick={cancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={busy}>
            {item.id ? 'Salvar' : 'Adicionar item'}
          </button>
        </>
      }
    >
      <form className="mi-form" onSubmit={submit}>
        <div className="mi-photo">
          {img ? <Thumb rid={rid} id={img} size={160} key={preview || img} /> : <span className="mi-thumb mi-thumb-empty" style={{ width: 160, height: 120 }}><Icon name="image" size={28} /></span>}
          <div className="mi-photo-actions">
            <input ref={file} id="mi-file" type="file" accept="image/*" className="visually-hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <label htmlFor="mi-file" className="btn btn-sm">
              <Icon name="upload" size={16} /> {busy ? 'Preparando…' : img ? 'Trocar foto' : 'Adicionar foto'}
            </label>
            {img && (
              <button type="button" className="btn btn-sm btn-ghost btn-danger" onClick={() => (img !== original.current && api.deleteMenuImage(rid, img), setImg(null))}>
                Remover foto
              </button>
            )}
            <span className="muted small">Opcional. A foto é cortada no formato 4:3 e reduzida automaticamente.</span>
          </div>
        </div>
        <div className="mi-row">
          <label className="field grow" htmlFor="mi-name">
            <span>Nome</span>
            <input id="mi-name" className="input" maxLength={60} placeholder="Ex.: Moqueca de peixe" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field mi-price" htmlFor="mi-price">
            <span>Preço (R$)</span>
            <input id="mi-price" className="input" inputMode="decimal" placeholder="0,00" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>
        <label className="field" htmlFor="mi-desc">
          <span>Descrição (opcional)</span>
          <textarea id="mi-desc" className="input" rows={2} maxLength={200} placeholder="Ex.: Serve 2 pessoas. Acompanha arroz e pirão." value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <label className="field" htmlFor="mi-tag">
          <span>Destaque (opcional)</span>
          <input id="mi-tag" className="input" maxLength={20} placeholder="Ex.: Mais pedido, Novo, Vegetariano" value={tag} onChange={(e) => setTag(e.target.value)} />
        </label>
        <div className="mi-opts">
          <Switch id="mi-has-opts" checked={hasOpts} onChange={setHasOpts} label="O cliente precisa escolher uma opção (sabor, ponto, tamanho…)" />
          {hasOpts && (
            <div className="mi-row">
              <label className="field" htmlFor="mi-opt-title">
                <span>Pergunta</span>
                <input id="mi-opt-title" className="input" maxLength={40} placeholder="Ex.: Sabor" value={optTitle} onChange={(e) => setOptTitle(e.target.value)} />
              </label>
              <label className="field grow" htmlFor="mi-choices">
                <span>Opções (uma por linha)</span>
                <textarea id="mi-choices" className="input" rows={3} placeholder={'Laranja\nLimão\nAbacaxi'} value={choices} onChange={(e) => setChoices(e.target.value)} />
              </label>
            </div>
          )}
        </div>
        {err && <p className="field-error">{err}</p>}
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ página */
export default function Menu() {
  const { rid, settings: s, plan, run } = useAdmin();
  const remote = useWatch((ok, err) => api.watchMenu(rid, ok, err), [rid], EMPTY_MENU);
  const [local, setLocal] = useState(null);
  const menu = local || remote.data;
  const [editing, setEditing] = useState(null); // { catId, item }
  const [confirm, setConfirm] = useState(null);
  const [newCat, setNewCat] = useState('');
  const [renaming, setRenaming] = useState(null);

  useEffect(() => setLocal(null), [remote.data]);

  const save = async (next, msg) => {
    const clean = sanitizeMenu(next);
    setLocal(clean);
    await run(() => api.saveMenu(rid, clean), msg).catch(() => setLocal(null));
  };
  const setCats = (cats, msg) => save({ categories: cats }, msg);
  const mapCat = (id, fn) => menu.categories.map((c) => (c.id === id ? fn(c) : c));

  const addCat = (e) => {
    e.preventDefault();
    const n = newCat.trim();
    if (!n) return;
    setCats([...menu.categories, { id: newId('c'), name: n, items: [] }], `Categoria “${n}” criada`);
    setNewCat('');
  };
  const saveItem = (catId, item) => {
    setCats(
      mapCat(catId, (c) => {
        const exists = c.items.some((i) => i.id === item.id);
        return { ...c, items: exists ? c.items.map((i) => (i.id === item.id ? item : i)) : [...c.items, item] };
      }),
      'Cardápio salvo',
    );
    setEditing(null);
  };
  const removeItem = (catId, item) => {
    setCats(mapCat(catId, (c) => ({ ...c, items: c.items.filter((i) => i.id !== item.id) })), `${item.name} removido`);
    if (item.img) api.deleteMenuImage(rid, item.img);
  };
  const removeCat = (cat) => {
    setCats(menu.categories.filter((c) => c.id !== cat.id), `Categoria “${cat.name}” removida`);
    cat.items.forEach((i) => i.img && api.deleteMenuImage(rid, i.img));
  };

  const count = menuItemCount(menu);
  const toggleSetting = (patch, msg) => run(() => api.saveSettings(rid, patch), msg).catch(() => {});

  return (
    <>
      <PageHeader title="Cardápio" text="Os itens aparecem na página da mesa. Com os pedidos ligados, o cliente pede pelo celular e a comanda sai na cozinha." />

      <Panel className="orders-switches">
        <div className="os-row">
          <div>
            <strong>Pedidos pelo cardápio</strong>
            <p className="muted small">
              {s.ordersEnabled
                ? count
                  ? 'Ligado. Os clientes já podem pedir pela página da mesa.'
                  : 'Ligado, mas o cardápio está vazio. Cadastre os itens abaixo.'
                : 'Desligado. Ligue quando o cardápio estiver pronto.'}
            </p>
          </div>
          <Switch id="orders-enabled" size="lg" checked={s.ordersEnabled} onChange={(v) => toggleSetting({ ordersEnabled: v }, v ? 'Pedidos ligados' : 'Pedidos desligados')} />
        </div>
        <div className="os-row">
          <div>
            <strong>O caixa confirma cada pedido</strong>
            <p className="muted small">O pedido só vai para a cozinha depois que alguém aprovar em Pedidos. Evita pedidos de brincadeira.</p>
          </div>
          <Switch id="orders-approval" checked={s.ordersApproval} onChange={(v) => toggleSetting({ ordersApproval: v }, v ? 'Aprovação ligada' : 'Aprovação desligada')} />
        </div>
      </Panel>

      {menu.categories.length === 0 && !remote.loading && (
        <Panel>
          <Empty title="Comece pelas categorias" text="Ex.: Entradas, Pratos, Bebidas, Sobremesas. Depois adicione os itens de cada uma." />
        </Panel>
      )}

      {menu.categories.map((c, ci) => (
        <Panel
          key={c.id}
          className="mc"
          title={
            renaming?.id === c.id ? (
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (renaming.name.trim()) setCats(mapCat(c.id, (x) => ({ ...x, name: renaming.name.trim() })), 'Categoria renomeada');
                  setRenaming(null);
                }}
              >
                <input className="input" autoFocus maxLength={40} aria-label="Nome da categoria" value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
                <button className="btn btn-sm btn-primary">Salvar</button>
              </form>
            ) : (
              <>
                {c.name} <span className="mc-count">{c.items.length}</span>
              </>
            )
          }
          actions={
            <div className="mc-actions">
              <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setCats(move(menu.categories, ci, -1))} disabled={ci === 0} aria-label="Subir categoria" title="Subir">
                ↑
              </button>
              <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setCats(move(menu.categories, ci, 1))} disabled={ci === menu.categories.length - 1} aria-label="Descer categoria" title="Descer">
                ↓
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setRenaming({ id: c.id, name: c.name })}>
                <Icon name="edit" size={16} /> Renomear
              </button>
              <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirm({ type: 'cat', c })}>
                <Icon name="trash" size={16} />
                <span className="visually-hidden">Excluir categoria</span>
              </button>
            </div>
          }
        >
          <ul className="mi-list">
            {c.items.map((i, ii) => (
              <li key={i.id} className={i.available ? '' : 'is-off'}>
                <Thumb rid={rid} id={i.img} />
                <span className="mi-main">
                  <strong>
                    {i.name}
                    {i.tag && <span className="pill">{i.tag}</span>}
                    {!i.available && <span className="pill pill-off">Esgotado</span>}
                  </strong>
                  <small>{[i.desc, i.opts ? `${i.opts.title}: ${i.opts.choices.join(', ')}` : ''].filter(Boolean).join(' · ') || 'Sem descrição'}</small>
                </span>
                <b className="mi-price-tag">{brl(i.price)}</b>
                <Switch
                  id={`av-${i.id}`}
                  checked={i.available}
                  label={i.available ? 'Disponível' : 'Esgotado'}
                  onChange={(v) => setCats(mapCat(c.id, (x) => ({ ...x, items: x.items.map((y) => (y.id === i.id ? { ...y, available: v } : y)) })), v ? `${i.name} voltou ao cardápio` : `${i.name} marcado como esgotado`)}
                />
                <span className="mi-btns">
                  <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setCats(mapCat(c.id, (x) => ({ ...x, items: move(x.items, ii, -1) })))} disabled={ii === 0} aria-label="Subir item">
                    ↑
                  </button>
                  <button className="btn btn-sm btn-icon btn-ghost" onClick={() => setCats(mapCat(c.id, (x) => ({ ...x, items: move(x.items, ii, 1) })))} disabled={ii === c.items.length - 1} aria-label="Descer item">
                    ↓
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditing({ catId: c.id, item: i })}>
                    <Icon name="edit" size={16} /> Editar
                  </button>
                  <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setConfirm({ type: 'item', c, i })} aria-label={`Excluir ${i.name}`}>
                    <Icon name="trash" size={16} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <button className="btn btn-sm mc-add" onClick={() => setEditing({ catId: c.id, item: { available: true } })}>
            <Icon name="plus" size={16} /> Adicionar item em {c.name}
          </button>
        </Panel>
      ))}

      <Panel title="Nova categoria">
        <form className="inline-form" onSubmit={addCat}>
          <label className="field grow" htmlFor="new-cat">
            <span className="visually-hidden">Nome da categoria</span>
            <input id="new-cat" className="input" maxLength={40} placeholder="Ex.: Bebidas" value={newCat} onChange={(e) => setNewCat(e.target.value)} />
          </label>
          <button className="btn btn-primary" disabled={!newCat.trim()}>
            <Icon name="plus" size={16} /> Criar categoria
          </button>
        </form>
      </Panel>

      {planHasMenu(plan) && <PdfMenu />}

      {editing && <ItemModal rid={rid} item={editing.item} onClose={() => setEditing(null)} onSave={(item) => saveItem(editing.catId, item)} />}
      {confirm?.type === 'item' && (
        <Confirm
          title={`Excluir ${confirm.i.name}?`}
          message="O item sai do cardápio na hora. Pedidos já feitos continuam no histórico."
          confirmLabel="Excluir item"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => (removeItem(confirm.c.id, confirm.i), setConfirm(null))}
        />
      )}
      {confirm?.type === 'cat' && (
        <Confirm
          title={`Excluir a categoria ${confirm.c.name}?`}
          message={`Os ${confirm.c.items.length} itens dela saem do cardápio.`}
          confirmLabel="Excluir categoria"
          danger
          onClose={() => setConfirm(null)}
          onConfirm={() => (removeCat(confirm.c), setConfirm(null))}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ PDF (alternativa, plano Avançado) */
function PdfMenu() {
  const { rid, settings: s, run, toast } = useAdmin();
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(null);
  const [link, setLink] = useState('');
  const [openUrl, setOpenUrl] = useState(null);
  const [open, setOpen] = useState(!!s.menuUrl);

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
      toast('Cardápio em PDF enviado.');
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
  const hidden = useMemo(() => s.ordersEnabled, [s.ordersEnabled]);

  return (
    <Panel
      title="Cardápio em PDF ou link (alternativa)"
      text={hidden ? 'Com os pedidos ligados, a mesa mostra o cardápio digital acima. O PDF só aparece com os pedidos desligados.' : 'Sem os pedidos ligados, o botão “Cardápio” da mesa abre este arquivo ou link.'}
      actions={
        <button className="btn btn-sm btn-ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? 'Esconder' : 'Mostrar'}
        </button>
      }
    >
      {open && (
        <div className="menu-grid">
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
            <p className="muted">Nenhum PDF ou link.</p>
          )}
          <div className="upload">
            <input ref={input} id="menu-file" type="file" accept="application/pdf,.pdf" className="visually-hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <label htmlFor="menu-file" className="btn">
              <Icon name="upload" size={16} /> Escolher PDF
            </label>
            <span className="upload-name">{file ? `${file.name} · ${(file.size / 1048576).toFixed(1)} MB` : isDemo ? 'Na demonstração fica neste navegador' : 'Exige o Firebase Storage (plano Blaze)'}</span>
            <button className="btn btn-primary" disabled={!file || progress !== null} onClick={send}>
              {progress !== null ? `Enviando ${Math.round(progress * 100)}%` : 'Enviar'}
            </button>
          </div>
          <form className="inline-form" onSubmit={saveLink}>
            <label className="field grow" htmlFor="menu-link">
              <span className="visually-hidden">Link do cardápio</span>
              <input id="menu-link" className="input" placeholder="Ou cole um link https://…" value={link} onChange={(e) => setLink(e.target.value)} />
            </label>
            <button className="btn" disabled={!link.trim()}>
              Salvar link
            </button>
          </form>
        </div>
      )}
    </Panel>
  );
}
