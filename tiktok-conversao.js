// ListaLar — atribuição simples de conversão vinda do TikTok
// Usa apenas um marcador local de origem e incrementa contadores agregados.

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
  authDomain: "compras-da-casa.firebaseapp.com",
  projectId: "compras-da-casa",
  storageBucket: "compras-da-casa.firebasestorage.app",
  messagingSenderId: "63765433273",
  appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const metricasRef = doc(db, "metricas_publicas", "tiktok");

function veioDoTikTok() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("origem") === "tiktok") {
    try {
      localStorage.setItem("listalar_origem_tiktok", "1");
      localStorage.setItem("listalar_origem_tiktok_em", String(Date.now()));
    } catch (_) {}
    return true;
  }

  try {
    return localStorage.getItem("listalar_origem_tiktok") === "1";
  } catch (_) {
    return false;
  }
}

async function registrarUmaVez(chaveLocal, campo) {
  try {
    if (localStorage.getItem(chaveLocal) === "1") return;
  } catch (_) {}

  try {
    await setDoc(metricasRef, {
      [campo]: increment(1),
      atualizadoEm: serverTimestamp()
    }, { merge: true });
    try { localStorage.setItem(chaveLocal, "1"); } catch (_) {}
  } catch (erro) {
    console.warn("Métrica TikTok não registrada:", campo, erro?.code || erro?.message || erro);
  }
}

if (veioDoTikTok()) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    await registrarUmaVez("listalar_tiktok_login_registrado", "loginConcluido");

    try {
      const usuarioSnap = await getDoc(doc(db, "usuarios", user.uid));
      const familiaId = usuarioSnap.exists() ? String(usuarioSnap.data()?.familiaId || "").trim() : "";
      if (familiaId) {
        await registrarUmaVez("listalar_tiktok_familia_registrada", "familiaVinculada");
      }
    } catch (erro) {
      console.warn("Não foi possível verificar vínculo de família para a métrica TikTok:", erro?.code || erro?.message || erro);
    }
  });
}
