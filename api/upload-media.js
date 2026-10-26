const { db } = require('./_firebase');
const U = require('./_util');

// Fotos e vídeos vão para um repositório do GitHub (nunca para o Firebase).
// Limite: a Vercel aceita no máximo ~4,5 MB por requisição, então o arquivo pode ter até 3 MB.
const MAX_BYTES = 3 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'método não permitido' });
  const eu = await U.quemE(req);
  if (!eu) return res.status(401).json({ erro: 'Entre na sua conta para enviar arquivos.' });
  const { GITHUB_TOKEN, GITHUB_MEDIA_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_MEDIA_REPO) return res.status(500).json({ erro: 'O envio de arquivos ainda não foi configurado.' });
  try {
    const { nome, tipo, dados } = req.body || {};
    if (!/^(image|video)\//.test(String(tipo)) || typeof dados !== 'string') return res.status(400).json({ erro: 'Envie uma foto ou um vídeo.' });
    if (dados.length * 0.75 > MAX_BYTES) return res.status(413).json({ erro: 'O arquivo precisa ter até 3 MB.' });

    const seguro = U.normalizar(nome).replace(/[^a-z0-9._-]+/g, '_').slice(-80) || 'arquivo';
    const caminho = `midias/${eu.uid}/${Date.now()}-${seguro}`;
    const url = `https://api.github.com/repos/${GITHUB_MEDIA_REPO}/contents/${caminho.split('/').map(encodeURIComponent).join('/')}`;
    const r = await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'combate-desinformacao', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'midia enviada', content: dados, branch: process.env.GITHUB_MEDIA_BRANCH || 'main' }),
    });
    if (!r.ok) return res.status(502).json({ erro: 'Não foi possível guardar o arquivo agora.' });

    await db.collection('midiaSubmissoes').add({
      uid: eu.uid, email: eu.dados.email || '', caminho,
      tipo: String(tipo).startsWith('video') ? 'video' : 'imagem', nomeArquivo: String(nome || '').slice(0, 120),
      status: 'pendente', resposta: '', veredito: '', criadoEm: new Date().toISOString(),
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: 'Não foi possível enviar agora.' });
  }
};
