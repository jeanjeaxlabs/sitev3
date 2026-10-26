import { auth, db } from '/firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.querySelectorAll('.kebab').forEach((btn) => {
  btn.addEventListener('click', () => document.querySelector('.mobile-menu').classList.toggle('aberto'));
});

function destino(d) {
  if (d && d.ehAdmin) return '/admin/';
  if (d && d.ehVoluntario) return '/moderar/';
  return '/account/';
}

onAuthStateChanged(auth, async (user) => {
  let html = '<a href="/login/">ENTRAR</a>';
  if (user) {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      html = `<a href="${destino(snap.exists() ? snap.data() : null)}">MINHA CONTA</a><a href="#" data-sair>SAIR</a>`;
    } catch (e) { /* mantém ENTRAR */ }
  }
  document.querySelectorAll('.nav-account').forEach((el) => (el.innerHTML = html));
  document.querySelectorAll('[data-sair]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut(auth);
      location.href = '/';
    });
  });
});
