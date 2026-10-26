import { montarCampos } from '/formulario.js';

let ultima = null;
let lerFormulario = null;
const $ = (id) => document.getElementById(id);

async function post(url, corpo) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || 'Algo deu errado.');
  return j;
}

// O site manda só o texto; quem conhece as palavras e faz a conta é o servidor.
async function analisar(manterVotoTravado = false) {
  const texto = $('texto').value.trim();
  if (!texto) return;
  $('btn-verificar').disabled = true;
  try {
    const j = await post('/api/analyze', { texto });
    const p = j.probabilidade;
    $('resultado').style.display = 'block';
    $('percTexto').textContent = `Previsão: cerca de ${p}% de chance de ser falsa`;
    const fill = $('resultFill');
    fill.style.width = p + '%';
    fill.style.background = p <= 25 ? '#5cffa0' : p <= 60 ? '#ffc94d' : '#ff5c5c';
    $('palavrasEncontradas').textContent = j.encontradas.length
      ? 'Sinais que o programa encontrou: ' + j.encontradas.join(', ')
      : 'O programa não encontrou sinais conhecidos nesse texto.';

    $('bloco-formulario').style.display = j.mostrarFormulario ? 'block' : 'none';
    if (j.mostrarFormulario && !(ultima && ultima.texto === texto && lerFormulario)) {
      lerFormulario = montarCampos($('campos-formulario'), j.formulario);
      $('msg-form').textContent = '';
    }
    ultima = { texto, probabilidade: p, encontradas: j.encontradas };
    if (!manterVotoTravado) {
      $('feedbackMsg').textContent = '';
      $('btn-acertou').disabled = false;
      $('btn-errou').disabled = false;
    }
  } catch (e) {
    $('palavrasEncontradas').textContent = e.message;
    $('resultado').style.display = 'block';
  } finally {
    $('btn-verificar').disabled = false;
  }
}

async function enviarFeedback(correto) {
  if (!ultima) return;
  $('btn-acertou').disabled = true;
  $('btn-errou').disabled = true;
  try {
    await post('/api/feedback', { ...ultima, correto });
    $('feedbackMsg').textContent = 'Obrigado! Isso ajuda os voluntários a melhorar o detector.';
  } catch (e) {
    $('feedbackMsg').textContent = 'Não deu para salvar agora, mas obrigado por avisar.';
  }
  await analisar(true); // atualiza a tela na hora, sem recarregar a página
}

async function enviarFormulario() {
  try {
    const respostas = lerFormulario();
    await post('/api/feedback', { ...ultima, correto: null, respostas });
    $('msg-form').textContent = 'Informações enviadas. Os voluntários vão conferir.';
  } catch (e) {
    $('msg-form').textContent = e.message;
  }
}

$('btn-verificar').addEventListener('click', () => analisar());
$('btn-acertou').addEventListener('click', () => enviarFeedback(true));
$('btn-errou').addEventListener('click', () => enviarFeedback(false));
$('btn-enviar-form').addEventListener('click', enviarFormulario);
