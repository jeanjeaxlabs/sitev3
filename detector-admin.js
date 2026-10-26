import { auth, db } from '/firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, setDoc, deleteDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { el } from '/api.js';

const idPalavra = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
const painel = document.getElementById('painel-palavras');
const lista = document.getElementById('lista-palavras');
const entrada = document.getElementById('nova-palavra');

onAuthStateChanged(auth, async (user) => {
  painel.style.display = 'none';
  if (!user) return;
  const snap = await getDoc(doc(db, 'users', user.uid));
  const d = snap.exists() ? snap.data() : {};
  if (!d.ehAdmin && !d.ehVoluntario) return;
  painel.style.display = 'block';

  onSnapshot(collection(db, 'palavras'), (s) => {
    lista.innerHTML = '';
    s.docs.filter((x) => x.data().ativa).forEach((x) => {
      const p = x.data();
      lista.appendChild(el('li', {},
        el('span', { texto: `${p.texto} (fake ${p.fake || 0} / verdade ${p.verdade || 0})` }),
        el('button', { texto: 'remover', onclick: () => deleteDoc(doc(db, 'palavras', x.id)) })));
    });
  });

  document.getElementById('add-palavra').onclick = async () => {
    const texto = entrada.value.trim().toLowerCase();
    if (!idPalavra(texto)) return;
    await setDoc(doc(db, 'palavras', idPalavra(texto)), { texto, ativa: true, fake: 2, verdade: 0 }, { merge: true });
    entrada.value = '';
  };
});
