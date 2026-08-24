// ListaLar Comercial 1.2.0 — contexto compartilhado
import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, collection } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const VERSAO = "1.2.0";
export const CAMPO_FAMILIAS = "comercialFamiliasHabilitadas";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
  authDomain: "compras-da-casa.firebaseapp.com",
  projectId: "compras-da-casa",
  storageBucket: "compras-da-casa.firebasestorage.app",
  messagingSenderId: "63765433273",
  appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
};

export const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const ESTADO = {
  usuario: null,
  familiaId: "",
  adminSistema: false,
  permitido: false,
  produtos: [],
  movimentos: [],
  unsubscribeProdutos: null,
  unsubscribeMovimentos: null,
  periodo: competenciaAtual(),
  salvando: false,
  eventosConfigurados: false,
  edicao: { produtoId: "", compraId: "", vendaId: "", despesaId: "" }
};

export const $ = (id) => document.getElementById(id);

export function normalizarNumeroTexto(valor) {
  let texto = String(valor ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!texto) return "";
  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    texto = ultimaVirgula > ultimoPonto
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(/,/g, "");
  } else if (ultimaVirgula >= 0) {
    texto = texto.replace(",", ".");
  }
  return texto;
}

export function numero(valor, padrao = 0) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : padrao;
  const texto = normalizarNumeroTexto(valor);
  if (!texto) return padrao;
  const n = Number(texto);
  return Number.isFinite(n) ? n : padrao;
}

export function numeroDigitado(valor) {
  const texto = normalizarNumeroTexto(valor);
  if (!texto) return NaN;
  const n = Number(texto);
  return Number.isFinite(n) ? n : NaN;
}

export function moeda(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

export function quantidade(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 1000) / 1000;
}

export function fmtMoeda(valor) {
  return moeda(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtNumero(valor) {
  return numero(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function fmtCampoMoeda(valor) {
  return moeda(valor).toFixed(2).replace(".", ",");
}

export function fmtCampoQuantidade(valor) {
  return quantidade(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
    useGrouping: false
  });
}

export function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizarTexto(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function competenciaAtual() {
  return hoje().slice(0, 7);
}

export function dataValida(valor) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(valor || ""));
}

export function competenciaMovimento(m) {
  const data = String(m.data || "");
  if (/^\d{4}-\d{2}/.test(data)) return data.slice(0, 7);
  const criado = m.criadoEm?.toDate?.();
  if (criado) return `${criado.getFullYear()}-${String(criado.getMonth() + 1).padStart(2, "0")}`;
  return "";
}

export function rotuloCompetencia(valor) {
  if (valor === "todos") return "Todos os períodos";
  const m = String(valor).match(/^(\d{4})-(\d{2})$/);
  if (!m) return valor;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const txt = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

export function toast(mensagem, tipo = "") {
  document.querySelector(".toast")?.remove();
  const div = document.createElement("div");
  div.className = `toast ${tipo}`.trim();
  div.textContent = mensagem;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4200);
}

export function status(mensagem, erro = false) {
  const el = $("statusComercial");
  if (!el) return;
  el.hidden = !mensagem;
  el.classList.toggle("erro", erro);
  el.textContent = mensagem || "";
}

export function produtoPorId(id) {
  return ESTADO.produtos.find((p) => p.id === id) || null;
}

export function movimentoPorId(id) {
  return ESTADO.movimentos.find((m) => m.id === id) || null;
}

export function refs() {
  return {
    produtos: collection(db, "familias", ESTADO.familiaId, "comercial_produtos"),
    movimentos: collection(db, "familias", ESTADO.familiaId, "comercial_movimentos")
  };
}

export function produtoRef(id) {
  return doc(db, "familias", ESTADO.familiaId, "comercial_produtos", id);
}

export function movimentoRef(id) {
  return doc(db, "familias", ESTADO.familiaId, "comercial_movimentos", id);
}

export async function verificarAcesso(usuario) {
  const userSnap = await getDoc(doc(db, "usuarios", usuario.uid));
  if (!userSnap.exists()) return false;
  const dados = userSnap.data() || {};
  ESTADO.adminSistema = dados.adminSistema === true;
  ESTADO.familiaId = String(dados.familiaId || "").trim();
  if (!ESTADO.familiaId) return false;
  if (ESTADO.adminSistema) return true;

  const configSnap = await getDoc(doc(db, "configuracoes", "modulos"));
  const liberadas = configSnap.exists() && Array.isArray(configSnap.data()?.[CAMPO_FAMILIAS])
    ? configSnap.data()[CAMPO_FAMILIAS]
    : [];
  return liberadas.includes(ESTADO.familiaId);
}
