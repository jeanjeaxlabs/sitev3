const { db } = require('./_firebase');
const U = require('./_util');

// O navegador manda só o texto. A lista de palavras fica aqui no servidor.
const PRIOR = 0.15; // chance inicial de um texto sem nenhum sinal ser falso (ponto de partida fixo)
const SEMENTES = [
  'compartilhe antes que apaguem', 'a midia nao mostra isso', 'o governo esconde', 'cura milagrosa',
  'urgente, compartilhe', 'voce nao vai acreditar', 'chocante', 'bomba', 'os cientistas escondem',
  'isso nao e fake news', 'a vacina mata', 'fim do mundo', 'exclusivo e chocante',
  'ninguem esta falando disso', 'compartilhe com todos', 'antes que apaguem',
  'a verdade que escondem de voce', '100% verdadeiro', 'nao e fake', 'print da conversa',
];
let cache = { t: 0, palavras: [] };

async function palavras() {
  if (Date.now() - cache.t < 60000 && cache.palavras.length) return cache.palavras;
  let s = await db.collection('palavras').where('ativa', '==', true).get();
  if (s.empty) {
    const lote = db.batch();
    SEMENTES.forEach((t) => lote.set(db.collection('palavras').doc(U.idPalavra(t)), { texto: t, ativa: true, fake: 6, verdade: 1 }));
    await lote.commit();
    s = await db.collection('palavras').where('ativa', '==', true).get();
  }
  cache = { t: Date.now(), palavras: s.docs.map((x) => ({ ...x.data(), n: U.normalizar(x.data().texto) })).filter((x) => x.n) };
  return cache.palavras;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'método não permitido' });
  const texto = String((req.body || {}).texto || '').slice(0, 20000);
  if (!texto.trim()) return res.status(400).json({ erro: 'Cole um texto primeiro.' });
  try {
    const norm = U.normalizar(texto);
    const lista = await palavras();
    const achadas = lista.filter((w) => new RegExp('(^|[^a-z0-9])' + w.n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)').test(norm));

    // Chance = combinação do que os voluntários já viram: cada palavra tem uma taxa
    // (vezes vista em texto falso contra vezes vista em texto verdadeiro).
    let logit = Math.log(PRIOR / (1 - PRIOR));
    const base = logit;
    if (achadas.length) {
      let soma = 0;
      for (const w of achadas) {
        const f = (w.fake || 0) + 1, v = (w.verdade || 0) + 1, taxa = f / (f + v);
        soma += Math.log(taxa / (1 - taxa)) - base;
      }
      logit += soma / Math.sqrt(achadas.length); // palavras repetidas pesam menos
    }
    // Sinais de estilo: excesso de MAIÚSCULAS e de exclamações
    const letras = (texto.match(/\p{L}/gu) || []).length;
    const maius = (texto.match(/\p{Lu}/gu) || []).length;
    if (letras >= 30 && maius / letras > 0.3) logit += Math.min(1.5, (maius / letras - 0.3) * 5);
    const excl = (texto.match(/!/g) || []).length;
    if (excl >= 3) logit += Math.min(1, (excl / (texto.length / 100)) * 0.25);

    const p = 1 / (1 + Math.exp(-logit));
    const pct = Math.min(99, Math.max(1, Math.round(p * 100)));
    const mostrar = pct > 25;
    return res.json({
      probabilidade: pct,
      encontradas: achadas.map((w) => w.texto),
      mostrarFormulario: mostrar,
      formulario: mostrar ? await U.camposDe('formulario-detector', U.CAMPOS_DETECTOR) : [],
    });
  } catch (e) {
    return res.status(500).json({ erro: 'Não foi possível analisar agora. Tente de novo.' });
  }
};
