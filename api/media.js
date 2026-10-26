const U = require('./_util');

const TIPOS = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };

// Entrega o arquivo do GitHub só para o dono dele, voluntários e administradores.
module.exports = async (req, res) => {
  const caminho = String(req.query.caminho || '');
  const partes = caminho.split('/');
  if (partes[0] !== 'midias' || partes.length !== 3 || caminho.includes('..')) return res.status(400).json({ erro: 'caminho inválido' });
  const eu = await U.quemE(req);
  if (!eu) return res.status(401).json({ erro: 'não autenticado' });
  const d = eu.dados;
  if (eu.uid !== partes[1] && d.ehVoluntario !== true && d.ehAdmin !== true) return res.status(403).json({ erro: 'sem permissão' });
  try {
    const url = `https://api.github.com/repos/${process.env.GITHUB_MEDIA_REPO}/contents/${caminho.split('/').map(encodeURIComponent).join('/')}?ref=${process.env.GITHUB_MEDIA_BRANCH || 'main'}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.raw+json', 'User-Agent': 'combate-desinformacao' } });
    if (!r.ok) return res.status(404).json({ erro: 'arquivo não encontrado' });
    const ext = caminho.split('.').pop().toLowerCase();
    res.setHeader('Content-Type', TIPOS[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    return res.status(500).json({ erro: 'erro ao buscar o arquivo' });
  }
};
