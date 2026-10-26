const crypto = require('crypto');
const { db, admin } = require('./_firebase');

const CAMPOS_DETECTOR = [
  { id: 'fonte', rotulo: 'Fonte da notícia', tipo: 'texto', obrigatorio: false, opcoes: '' },
  { id: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: false, opcoes: '' },
  { id: 'veiculo', rotulo: 'Veículo de informação', tipo: 'texto', obrigatorio: false, opcoes: '' },
  { id: 'link', rotulo: 'Link, se tiver', tipo: 'texto', obrigatorio: false, opcoes: '' },
  { id: 'obs', rotulo: 'Observações', tipo: 'textarea', obrigatorio: false, opcoes: '' },
];
const CAMPOS_VOLUNTARIO = [
  { id: 'motivo', rotulo: 'Por que você quer ser voluntário?', tipo: 'textarea', obrigatorio: true, opcoes: '' },
  { id: 'turma', rotulo: 'Turma ou ano', tipo: 'texto', obrigatorio: true, opcoes: '' },
  { id: 'horas', rotulo: 'Quantas horas por semana você consegue ajudar?', tipo: 'texto', obrigatorio: true, opcoes: '' },
];

async function camposDe(docId, padrao) {
  try {
    const s = await db.collection('config').doc(docId).get();
    if (s.exists && Array.isArray(s.data().campos) && s.data().campos.length) return s.data().campos;
  } catch (e) { /* usa o padrão */ }
  return padrao;
}

function normalizar(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
const idPalavra = (t) => normalizar(t).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
const normEmail = (e) => String(e || '').trim().toLowerCase();
const uidDe = (email) => crypto.createHash('sha256').update(normEmail(email)).digest('hex').slice(0, 40);

// Senha: scrypt com sal aleatório (nunca guardamos a senha em si)
function hashSenha(senha) {
  const sal = crypto.randomBytes(16);
  return { senhaSalt: sal.toString('hex'), senhaHash: crypto.scryptSync(String(senha), sal, 64).toString('hex') };
}
function conferirSenha(senha, saltHex, hashHex) {
  try {
    const h = crypto.scryptSync(String(senha), Buffer.from(saltHex, 'hex'), 64);
    const a = Buffer.from(hashHex, 'hex');
    return a.length === h.length && crypto.timingSafeEqual(a, h);
  } catch (e) { return false; }
}

// O que o navegador pode saber de uma conta (nunca inclui hash nem sal)
function perfilPublico(uid, d) {
  return {
    uid, email: d.email || '', nome: d.nome || '',
    ehUsuario: d.ehUsuario === true, ehVoluntario: d.ehVoluntario === true, ehAdmin: d.ehAdmin === true,
    solicitouVoluntariado: d.solicitouVoluntariado === true,
    temFormulario: d.temFormulario === true,
    statusVoluntario: d.statusVoluntario || 'nenhum',
    statusVisto: d.statusVisto !== false,
    criadoEm: d.criadoEm || '',
  };
}

async function quemE(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  try {
    const dec = await admin.auth().verifyIdToken(token);
    const snap = await db.collection('users').doc(dec.uid).get();
    return snap.exists ? { uid: dec.uid, dados: snap.data() } : null;
  } catch (e) { return null; }
}

module.exports = {
  CAMPOS_DETECTOR, CAMPOS_VOLUNTARIO, camposDe, normalizar, idPalavra,
  normEmail, uidDe, hashSenha, conferirSenha, perfilPublico, quemE,
};
