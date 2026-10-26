import { auth } from '/firebase-config.js';

const MAX = 3 * 1024 * 1024;

async function cabecalho() {
  const h = { 'Content-Type': 'application/json' };
  if (auth.currentUser) h.Authorization = 'Bearer ' + (await auth.currentUser.getIdToken());
  return h;
}

export async function api(url, corpo) {
  const r = await fetch(url, { method: 'POST', headers: await cabecalho(), body: JSON.stringify(corpo || {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'Algo deu errado.');
  return j;
}

function lerBase64(f) {
  return new Promise((ok, erro) => {
    const fr = new FileReader();
    fr.onload = () => ok(String(fr.result).split(',')[1]);
    fr.onerror = erro;
    fr.readAsDataURL(f);
  });
}

export async function enviarMidia(arquivo) {
  if (arquivo.size > MAX) throw new Error('O arquivo precisa ter até 3 MB.');
  return api('/api/upload-media', { nome: arquivo.name, tipo: arquivo.type, dados: await lerBase64(arquivo) });
}

export async function urlMidia(caminho) {
  const r = await fetch('/api/media?caminho=' + encodeURIComponent(caminho), { headers: await cabecalho() });
  return r.ok ? URL.createObjectURL(await r.blob()) : null;
}

export function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'texto') e.textContent = v;
    else if (k.startsWith('on')) e[k] = v;
    else e.setAttribute(k, v);
  });
  filhos.flat().forEach((f) => { if (f != null) e.appendChild(typeof f === 'string' ? document.createTextNode(f) : f); });
  return e;
}

export function midiaElemento(item) {
  const tag = item.tipo === 'video' ? el('video', { controls: '', style: 'width:140px;border-radius:12px;' }) : el('img', { alt: 'envio', style: 'width:140px;border-radius:12px;' });
  urlMidia(item.caminho).then((u) => { if (u) tag.src = u; });
  return tag;
}
