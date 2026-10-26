const { db, admin } = require('./_firebase');
const U = require('./_util');

const agora = () => new Date().toISOString();
const ehMod = (d) => d.ehAdmin === true || d.ehVoluntario === true;
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function novoDoc({ email, nome, senha, ehVoluntario = false, ehAdmin = false, quer = false }) {
  return {
    email: U.normEmail(email), nome: String(nome || '').trim().slice(0, 80),
    ...U.hashSenha(senha),
    ehUsuario: true, ehVoluntario, ehAdmin,
    solicitouVoluntariado: quer || ehVoluntario,
    temFormulario: false, formularioEnviado: false,
    statusVoluntario: ehVoluntario ? 'aceito' : quer ? 'pendente' : 'nenhum',
    statusVisto: true,
    respostasFormulario: [],
    falhas: '0', bloqueadoAte: '', criadoEm: agora(), ultimoLogin: '',
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ erro: 'método não permitido' });
  const b = req.body || {};
  try {
    if (b.acao === 'registrar') return await registrar(b, res);
    if (b.acao === 'entrar') return await entrar(b, res);

    const eu = await U.quemE(req);
    if (!eu) return res.status(401).json({ erro: 'Entre na sua conta primeiro.' });
    const d = eu.dados;
    const refEu = db.collection('users').doc(eu.uid);

    switch (b.acao) {
      case 'solicitar': {
        if (d.ehVoluntario) return res.status(400).json({ erro: 'Você já é voluntário.' });
        if (!['nenhum', 'recusado'].includes(d.statusVoluntario || 'nenhum')) {
          return res.status(400).json({ erro: 'Você já tem uma solicitação em andamento.' });
        }
        await refEu.update({ solicitouVoluntariado: true, statusVoluntario: 'pendente', statusVisto: true });
        return res.json({ ok: true });
      }
      case 'visto':
        await refEu.update({ statusVisto: true });
        return res.json({ ok: true });

      case 'enviarFormulario': {
        if (d.statusVoluntario !== 'formulario') return res.status(400).json({ erro: 'Nenhum formulário pendente.' });
        const campos = await U.camposDe('formulario-voluntario', U.CAMPOS_VOLUNTARIO);
        const resp = Array.isArray(b.respostas) ? b.respostas.slice(0, 40) : [];
        const limpas = resp.map((r) => ({ pergunta: String(r.pergunta || '').slice(0, 300), resposta: String(r.resposta || '').slice(0, 3000) }));
        for (const c of campos) {
          if (c.obrigatorio && !limpas.some((r) => r.pergunta === c.rotulo && r.resposta.trim())) {
            return res.status(400).json({ erro: 'Preencha: ' + c.rotulo });
          }
        }
        await refEu.update({ respostasFormulario: limpas, statusVoluntario: 'analise', temFormulario: false, formularioEnviado: true, formularioEm: agora() });
        return res.json({ ok: true });
      }
    }

    if (!ehMod(d)) return res.status(403).json({ erro: 'Sem permissão.' });

    switch (b.acao) {
      case 'listarPedidos': {
        const s = await db.collection('users').where('statusVoluntario', '==', 'pendente').get();
        return res.json({ pedidos: s.docs.map((x) => U.perfilPublico(x.id, x.data())) });
      }
      case 'aceitar':
      case 'pedirFormulario': {
        const ref = db.collection('users').doc(String(b.uid));
        const alvo = await ref.get();
        if (!alvo.exists || alvo.data().statusVoluntario !== 'pendente') return res.status(400).json({ erro: 'Esse pedido não está mais pendente.' });
        if (b.acao === 'aceitar') await ref.update({ ehVoluntario: true, statusVoluntario: 'aceito', statusVisto: false, decididoPor: d.email, decididoEm: agora() });
        else await ref.update({ statusVoluntario: 'formulario', temFormulario: true, statusVisto: true });
        return res.json({ ok: true });
      }
    }

    if (d.ehAdmin !== true) return res.status(403).json({ erro: 'Só administradores podem fazer isso.' });

    switch (b.acao) {
      case 'listarRevisoes': {
        const s = await db.collection('users').where('statusVoluntario', '==', 'analise').get();
        return res.json({ revisoes: s.docs.map((x) => ({ ...U.perfilPublico(x.id, x.data()), respostas: x.data().respostasFormulario || [] })) });
      }
      case 'decidir': {
        const ref = db.collection('users').doc(String(b.uid));
        const alvo = await ref.get();
        if (!alvo.exists) return res.status(404).json({ erro: 'Conta não encontrada.' });
        const aceito = b.aceitar === true;
        await ref.update({ ehVoluntario: aceito, statusVoluntario: aceito ? 'aceito' : 'recusado', temFormulario: false, statusVisto: false, decididoPor: d.email, decididoEm: agora() });
        return res.json({ ok: true });
      }
      case 'listarUsuarios': {
        const s = await db.collection('users').get();
        return res.json({ usuarios: s.docs.map((x) => U.perfilPublico(x.id, x.data())) });
      }
      case 'editarUsuario': {
        const uid = String(b.uid);
        if (uid === eu.uid && b.ehAdmin !== true) return res.status(400).json({ erro: 'Você não pode tirar o próprio acesso de administrador.' });
        const ref = db.collection('users').doc(uid);
        const alvo = await ref.get();
        if (!alvo.exists) return res.status(404).json({ erro: 'Conta não encontrada.' });
        const upd = { ehUsuario: b.ehUsuario === true, ehVoluntario: b.ehVoluntario === true, ehAdmin: b.ehAdmin === true };
        if (upd.ehVoluntario) { upd.statusVoluntario = 'aceito'; upd.solicitouVoluntariado = true; }
        else if (alvo.data().statusVoluntario === 'aceito') upd.statusVoluntario = 'nenhum';
        await ref.update(upd);
        return res.json({ ok: true });
      }
      case 'criarUsuario': {
        const tipo = b.tipo;
        if (!emailOk(U.normEmail(b.email)) || String(b.senha || '').length < 6 || !['usuario', 'voluntario', 'admin'].includes(tipo)) {
          return res.status(400).json({ erro: 'Preencha e-mail, senha (mínimo 6 caracteres) e um tipo válido.' });
        }
        const ref = db.collection('users').doc(U.uidDe(b.email));
        try {
          await ref.create(novoDoc({ email: b.email, nome: b.nome, senha: b.senha, ehVoluntario: tipo === 'voluntario' || tipo === 'admin', ehAdmin: tipo === 'admin' }));
        } catch (e) { return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail.' }); }
        return res.json({ ok: true });
      }
    }
    return res.status(400).json({ erro: 'Ação desconhecida.' });
  } catch (erro) {
    return res.status(500).json({ erro: 'Algo deu errado. Tente de novo.' });
  }
};

async function registrar(b, res) {
  const email = U.normEmail(b.email);
  if (!emailOk(email) || String(b.senha || '').length < 6) {
    return res.status(400).json({ erro: 'Use um e-mail válido e uma senha com pelo menos 6 caracteres.' });
  }
  const uid = U.uidDe(email);
  const doc = novoDoc({ email, nome: b.nome, senha: b.senha, quer: b.quererSerVoluntario === true });
  try { await db.collection('users').doc(uid).create(doc); }
  catch (e) { return res.status(409).json({ erro: 'Já existe uma conta com esse e-mail.' }); }
  const token = await admin.auth().createCustomToken(uid);
  return res.json({ token, perfil: U.perfilPublico(uid, doc), formulario: null });
}

async function entrar(b, res) {
  const email = U.normEmail(b.email);
  const uid = U.uidDe(email);
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const generico = { erro: 'E-mail ou senha incorretos.' };
  if (!snap.exists) return res.status(401).json(generico);
  const d = snap.data();
  const t = Date.now();
  if (d.bloqueadoAte && Date.parse(d.bloqueadoAte) > t) return res.status(429).json({ erro: 'Muitas tentativas erradas. Tente de novo em alguns minutos.' });
  if (!U.conferirSenha(b.senha, d.senhaSalt, d.senhaHash)) {
    const f = (parseInt(d.falhas || '0', 10) || 0) + 1;
    await ref.update(f >= 5 ? { falhas: '0', bloqueadoAte: new Date(t + 10 * 60000).toISOString() } : { falhas: String(f) });
    return res.status(401).json(generico);
  }
  await ref.update({ falhas: '0', ultimoLogin: agora() });
  const token = await admin.auth().createCustomToken(uid);
  const formulario = d.statusVoluntario === 'formulario' ? await U.camposDe('formulario-voluntario', U.CAMPOS_VOLUNTARIO) : null;
  return res.json({ token, perfil: U.perfilPublico(uid, d), formulario });
}
