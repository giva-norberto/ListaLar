// ListaLar — métricas da landing TikTok
// Registra eventos anônimos do funil, sem nome, e-mail ou identificador pessoal.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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
const eventosRef = collection(db, "metricas_publicas", "tiktok", "eventos");

async function registrar(evento) {
  try {
    await addDoc(eventosRef, {
      evento,
      criadoEm: serverTimestamp()
    });
  } catch (erro) {
    console.warn("Métrica TikTok não registrada:", evento, erro?.code || erro?.message || erro);
  }
}

registrar("landing_aberta");

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
    registrar("clicou_abrir_listalar");
    try {
      localStorage.setItem("listalar_origem_tiktok", "1");
      localStorage.setItem("listalar_origem_tiktok_em", String(Date.now()));
    } catch (_) {}
  }, { passive: true });
});
