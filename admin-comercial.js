// ============================================================
// ListaLar — Administração do módulo Comercial
// Arquivo: admin-comercial.js
// Versão: 1.1.0
// ============================================================

import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const VERSAO = "1.1.0";
const CAMPO_FAMILIAS = "comercialFamiliasHabilitadas";
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
  authDomain: "compras-da-casa.firebaseapp.com",
  projectId: "compras-da-casa",
  storageBucket: "compras-da-casa.firebasestorage.app",
  messagingSenderId: "63765433273",
  appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
};

const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);

let familias = [];
let liberadas = new Set();
let salvando = false;

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function status(mensagem, tipo = "") {
  const el = $("adminComercialStatus");
  el.hidden = !mensagem;
  el.className = `mod-status ${tipo}`.trim();
  el.textContent = mensagem || "";
}

async function validarAdmin(user) {
  const snap = await getDoc(doc(db, "usuarios", user.uid));
  return snap.exists() && snap.data()?.adminSistema === true;
}

async function carregarDados() {
  status("Carregando famílias e liberações...");

  const [configSnap, familiasSnap] = await Promise.all([
    getDoc(doc(db, "configuracoes", "modulos")),
    getDocs(collection(db, "familias"))
  ]);

  const ids = configSnap.exists() && Array.isArray(configSnap.data()?.[CAMPO_FAMILIAS])
    ? configSnap.data()[CAMPO_FAMILIAS]
    : [];

  liberadas = new Set(ids.map(String));
  familias = familiasSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR"));
  render();
  status("");
}

function render() {
  const lista = $("adminComercialLista");
  if (!familias.length) {
    lista.innerHTML = `<div class="empty-state">Nenhuma família cadastrada.</div>`;
    return;
  }

  lista.innerHTML = familias.map((f) => {
    const nome = f.nome || `Família ${f.id.slice(0, 8)}`;
    const email = f.email || f.donoEmail || "";
    return `<label class="mod-family">
      <div><strong>${escapar(nome)}</strong><small>${escapar(email)}</small></div>
      <span><input type="checkbox" data-familia="${escapar(f.id)}" ${liberadas.has(f.id) ? "checked" : ""}> Liberar</span>
    </label>`;
  }).join("");
}

async function salvar() {
  if (salvando) return;
  salvando = true;
  const botao = $("adminComercialSalvar");
  botao.disabled = true;
  status("Salvando liberações...");

  try {
    const selecionadas = [...document.querySelectorAll("[data-familia]:checked")]
      .map((el) => String(el.dataset.familia || ""))
      .filter(Boolean);

    await setDoc(
      doc(db, "configuracoes", "modulos"),
      { [CAMPO_FAMILIAS]: selecionadas },
      { merge: true }
    );

    liberadas = new Set(selecionadas);
    status("Liberações do Comercial salvas.", "ok");
  } catch (erro) {
    console.error(erro);
    status("Não foi possível salvar as liberações do Comercial.", "erro");
  } finally {
    salvando = false;
    botao.disabled = false;
  }
}

$("adminComercialSalvar").addEventListener("click", salvar);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "./index.html";
    return;
  }

  try {
    const admin = await validarAdmin(user);
    if (!admin) {
      status("Acesso negado. Esta página é exclusiva do administrador do sistema.", "erro");
      $("adminComercialConteudo").hidden = true;
      return;
    }

    $("adminComercialConteudo").hidden = false;
    await carregarDados();
  } catch (erro) {
    console.error(erro);
    status("Não foi possível validar o acesso administrativo.", "erro");
  }
});

console.log(`✅ Administração Comercial ${VERSAO}`);
