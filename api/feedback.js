const { db } = require('./_firebase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'método não permitido' });
  try {
    const b = req.body || {};
    if (typeof b.texto !== 'string' || !b.texto.trim()) return res.status(400).json({ erro: 'texto inválido' });
    const respostas = (Array.isArray(b.respostas) ? b.respostas : []).slice(0, 40).map((r) => ({
      pergunta: String(r.pergunta || '').slice(0, 300), resposta: String(r.resposta || '').slice(0, 3000),
    }));
    await db.collection('feedback').add({
      texto: b.texto.slice(0, 20000),
      probabilidade: String(parseInt(b.probabilidade, 10) || 0),
      encontradas: (Array.isArray(b.encontradas) ? b.encontradas : []).slice(0, 50).map((x) => String(x).slice(0, 120)),
      correto: b.correto === true ? 'sim' : b.correto === false ? 'nao' : '',
      respostas, temFormulario: respostas.length > 0,
      revisado: false, veredito: '', criadoEm: new Date().toISOString(),
    });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ erro: 'não foi possível salvar agora' });
  }
};
