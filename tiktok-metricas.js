// ListaLar — métricas da landing TikTok
// Registra apenas eventos agregados, sem nome, e-mail, IP ou identificador pessoal.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
  authDomain: "compras-da-casa.firebaseapp.com",
  projectId: "compras-da-casa",
  storageBucket: "compras-da-casa.firebasestorage.app",
  messagingSenderId: "63765433273",
  appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const ref = doc(db, "metricas_publicas", "tiktok");

async function registrar(campo) {
  try {
    await setDoc(ref, {
      [campo]: increment(1),
      atualizadoEm: serverTimestamp()
    }, { merge: true });
  } catch (erro) {
    console.warn("Métrica TikTok não registrada:", campo, erro?.code || erro?.message || erro);
  }
}

// Uma abertura por carregamento da landing.
registrar("landingAberta");

const seletoresCta = [
  'a[href^="./index.html"]',
  'a[href^="index.html"]'
];

document.querySelectorAll(seletoresCta.join(",")).forEach((link) => {
  try {
    const url = new URL(link.getAttribute("href"), window.location.href);
    url.searchParams.set("origem", "tiktok");
    link.href = url.toString();
  } catch (_) {}

  link.addEventListener("click", () => {
    registrar("clicouAbrirListaLar");
    try {
      localStorage.setItem("listalar_origem_tiktok", "1");
      localStorage.setItem("listalar_origem_tiktok_em", String(Date.now()));
    } catch (_) {}
  }, { passive: true });
});
