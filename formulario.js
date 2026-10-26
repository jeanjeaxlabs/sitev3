// Monta os campos de um formulário configurado pelos administradores.
// Devolve uma função que lê as respostas (e lança erro se faltar algo obrigatório).
export function montarCampos(container, campos) {
  container.innerHTML = '';
  const refs = [];
  campos.forEach((c) => {
    const rotulo = document.createElement('label');
    rotulo.textContent = c.rotulo + (c.obrigatorio ? ' *' : '');
    let campo;
    if (c.tipo === 'textarea') { campo = document.createElement('textarea'); campo.rows = 3; }
    else if (c.tipo === 'opcoes') {
      campo = document.createElement('select');
      const vazio = document.createElement('option'); vazio.value = ''; vazio.textContent = 'Escolha...'; campo.appendChild(vazio);
      String(c.opcoes || '').split(';').map((s) => s.trim()).filter(Boolean).forEach((t) => {
        const o = document.createElement('option'); o.value = t; o.textContent = t; campo.appendChild(o);
      });
    } else { campo = document.createElement('input'); campo.type = 'text'; }
    container.appendChild(rotulo);
    container.appendChild(campo);
    refs.push({ c, campo });
  });
  return () => {
    const respostas = [];
    for (const { c, campo } of refs) {
      const v = campo.value.trim();
      if (c.obrigatorio && !v) throw new Error('Preencha: ' + c.rotulo);
      if (v) respostas.push({ pergunta: c.rotulo, resposta: v });
    }
    return respostas;
  };
}
