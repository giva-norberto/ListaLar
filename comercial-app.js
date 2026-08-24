// ============================================================
// ListaLar — Aplicação Comercial independente
// Arquivo: comercial-app.js
// Versão: 1.1.0
// ============================================================

import { getApps, getApp, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, collection, addDoc, onSnapshot, query, orderBy,
  runTransaction, serverTimestamp
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

const ESTADO = {
  usuario: null,
  familiaId: "",
  adminSistema: false,
  permitido: false,
  produtos: [],
  movimentos: [],
  unsubscribeProdutos: null,
  unsubscribeMovimentos: null,
  periodo: competenciaAtual(),
  salvando: false
};

const $ = (id) => document.getElementById(id);

function numero(valor, padrao = 0) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : padrao;
  let t = String(valor ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!t) return padrao;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : padrao;
}

function moeda(valor) {
  return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
}

function fmtMoeda(valor) {
  return moeda(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNumero(valor) {
  return numero(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function competenciaAtual() {
  return hoje().slice(0, 7);
}

function competenciaMovimento(m) {
  const data = String(m.data || "");
  if (/^\d{4}-\d{2}/.test(data)) return data.slice(0, 7);
  const criado = m.criadoEm?.toDate?.();
  if (criado) return `${criado.getFullYear()}-${String(criado.getMonth() + 1).padStart(2, "0")}`;
  return "";
}

function rotuloCompetencia(valor) {
  if (valor === "todos") return "Todos os períodos";
  const m = String(valor).match(/^(\d{4})-(\d{2})$/);
  if (!m) return valor;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const txt = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

function toast(mensagem, tipo = "") {
  document.querySelector(".toast")?.remove();
  const div = document.createElement("div");
  div.className = `toast ${tipo}`.trim();
  div.textContent = mensagem;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3600);
}

function status(mensagem, erro = false) {
  const el = $("statusComercial");
  if (!el) return;
  el.hidden = !mensagem;
  el.classList.toggle("erro", erro);
  el.textContent = mensagem || "";
}

function produtoPorId(id) {
  return ESTADO.produtos.find((p) => p.id === id) || null;
}

function refs() {
  return {
    produtos: collection(db, "familias", ESTADO.familiaId, "comercial_produtos"),
    movimentos: collection(db, "familias", ESTADO.familiaId, "comercial_movimentos")
  };
}

async function verificarAcesso(usuario) {
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

function configurarNavegacao() {
  document.querySelectorAll(".nav button[data-tela]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tela = btn.dataset.tela;
      document.querySelectorAll(".nav button").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === `tela-${tela}`));
    });
  });
}

function configurarDatas() {
  ["compraData", "vendaData", "despesaData"].forEach((id) => {
    if ($(id)) $(id).value = hoje();
  });
}

function renderSelectProdutos() {
  const opcoes = ESTADO.produtos
    .filter((p) => p.ativo !== false)
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))
    .map((p) => `<option value="${escapar(p.id)}">${escapar(p.nome)} — estoque ${fmtNumero(p.estoque)}</option>`)
    .join("");

  ["compraProduto", "vendaProduto"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    const atual = el.value;
    el.innerHTML = `<option value="">Selecione...</option>${opcoes}`;
    if ([...el.options].some((o) => o.value === atual)) el.value = atual;
  });

  const venda = produtoPorId($("vendaProduto")?.value);
  if (venda && !$("vendaValor").value) $("vendaValor").value = moeda(venda.precoVenda).toFixed(2).replace(".", ",");
}

function htmlProduto(p) {
  const custo = moeda(p.custoMedio);
  const venda = moeda(p.precoVenda);
  const lucro = moeda(venda - custo);
  const margem = venda > 0 ? (lucro / venda) * 100 : 0;
  const markup = custo > 0 ? (lucro / custo) * 100 : 0;
  return `<article class="item">
    <div class="item-top"><div class="item-title">${escapar(p.nome)}</div><span class="badge">${fmtNumero(p.estoque)} un</span></div>
    <div class="values">
      <div class="value"><span>Custo médio</span><strong>${fmtMoeda(custo)}</strong></div>
      <div class="value"><span>Preço venda</span><strong>${fmtMoeda(venda)}</strong></div>
      <div class="value"><span>Lucro/un</span><strong>${fmtMoeda(lucro)}</strong></div>
      <div class="value"><span>Margem / markup</span><strong>${margem.toFixed(1)}% / ${markup.toFixed(1)}%</strong></div>
    </div>
  </article>`;
}

function renderProdutos() {
  const lista = ESTADO.produtos.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const html = lista.length ? lista.map(htmlProduto).join("") : `<div class="empty">Nenhum produto comercial cadastrado.</div>`;
  $("listaProdutos").innerHTML = html;
  $("listaEstoque").innerHTML = html;
  $("dashboardProdutos").innerHTML = lista.length ? lista.slice(0, 6).map(htmlProduto).join("") : html;
  renderSelectProdutos();
  renderDashboard();
}

function htmlMovimento(m) {
  const tipo = String(m.tipo || "");
  const rotulo = tipo === "venda" ? "Venda" : tipo === "compra" ? "Compra" : "Despesa";
  const produto = m.produtoNome || produtoPorId(m.produtoId)?.nome || "";
  let detalhe = "";

  if (tipo === "compra") detalhe = `${fmtNumero(m.quantidade)} un × ${fmtMoeda(m.custoUnitario)} = ${fmtMoeda(m.valorTotal)}`;
  else if (tipo === "venda") detalhe = `${fmtNumero(m.quantidade)} un × ${fmtMoeda(m.precoUnitario)} = ${fmtMoeda(m.receita)} · lucro bruto ${fmtMoeda(m.lucroBruto)}`;
  else detalhe = fmtMoeda(m.valor);

  return `<article class="item">
    <div class="item-top"><div><div class="item-title">${escapar(produto || m.descricao || rotulo)}</div><div class="meta">${escapar(m.data || "")} · ${escapar(detalhe)}</div></div><span class="badge ${tipo}">${rotulo}</span></div>
  </article>`;
}

function renderMovimentos() {
  const movs = ESTADO.movimentos.slice().sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  const porTipo = (tipo) => movs.filter((m) => m.tipo === tipo);
  const vazio = `<div class="empty">Nenhum registro.</div>`;
  $("listaCompras").innerHTML = porTipo("compra").length ? porTipo("compra").slice(0, 20).map(htmlMovimento).join("") : vazio;
  $("listaVendas").innerHTML = porTipo("venda").length ? porTipo("venda").slice(0, 20).map(htmlMovimento).join("") : vazio;
  $("listaDespesas").innerHTML = porTipo("despesa").length ? porTipo("despesa").slice(0, 20).map(htmlMovimento).join("") : vazio;
  $("listaHistorico").innerHTML = movs.length ? movs.slice(0, 100).map(htmlMovimento).join("") : vazio;
  renderPeriodos();
  renderDashboard();
}

function renderPeriodos() {
  const select = $("periodoDashboard");
  const periodos = new Set([competenciaAtual()]);
  ESTADO.movimentos.forEach((m) => {
    const c = competenciaMovimento(m);
    if (c) periodos.add(c);
  });
  const ordenados = [...periodos].sort().reverse();
  select.innerHTML = `<option value="todos">Todos os períodos</option>${ordenados.map((p) => `<option value="${p}">${rotuloCompetencia(p)}</option>`).join("")}`;
  if ([...select.options].some((o) => o.value === ESTADO.periodo)) select.value = ESTADO.periodo;
  else select.value = competenciaAtual();
}

function renderDashboard() {
  const periodo = ESTADO.periodo;
  const movs = ESTADO.movimentos.filter((m) => periodo === "todos" || competenciaMovimento(m) === periodo);
  const vendas = movs.filter((m) => m.tipo === "venda");
  const despesas = movs.filter((m) => m.tipo === "despesa");

  const receita = vendas.reduce((s, m) => s + moeda(m.receita), 0);
  const custo = vendas.reduce((s, m) => s + moeda(m.custoTotal), 0);
  const lucro = moeda(receita - custo);
  const desp = despesas.reduce((s, m) => s + moeda(m.valor), 0);
  const resultado = moeda(lucro - desp);
  const margem = receita > 0 ? (lucro / receita) * 100 : 0;
  const estoqueCusto = ESTADO.produtos.reduce((s, p) => s + numero(p.estoque) * moeda(p.custoMedio), 0);
  const estoqueVenda = ESTADO.produtos.reduce((s, p) => s + numero(p.estoque) * moeda(p.precoVenda), 0);

  $("kpiReceita").textContent = fmtMoeda(receita);
  $("kpiCusto").textContent = fmtMoeda(custo);
  $("kpiLucro").textContent = fmtMoeda(lucro);
  $("kpiDespesas").textContent = fmtMoeda(desp);
  $("kpiResultado").textContent = fmtMoeda(resultado);
  $("kpiMargem").textContent = `${margem.toFixed(1)}%`;
  $("kpiEstoqueCusto").textContent = fmtMoeda(estoqueCusto);
  $("kpiEstoqueVenda").textContent = fmtMoeda(estoqueVenda);
  $("cardResultado").classList.toggle("neg", resultado < 0);
}

async function cadastrarProduto(evento) {
  evento.preventDefault();
  if (ESTADO.salvando) return;

  const nome = String($("produtoNome").value || "").trim();
  const custo = moeda($("produtoCusto").value);
  const precoVenda = moeda($("produtoVenda").value);
  const estoqueInicial = numero($("produtoEstoque").value);

  if (!nome) return toast("Informe o produto.", "erro");
  if (custo < 0 || precoVenda < 0 || estoqueInicial < 0) return toast("Valores não podem ser negativos.", "erro");

  ESTADO.salvando = true;
  try {
    const { produtos, movimentos } = refs();
    const produtoRef = await addDoc(produtos, {
      nome, custoMedio: custo, precoVenda, estoque: estoqueInicial, ativo: true,
      criadoPor: ESTADO.usuario.uid, criadoEm: serverTimestamp(), atualizadoEm: serverTimestamp()
    });

    if (estoqueInicial > 0) {
      await addDoc(movimentos, {
        tipo: "compra", produtoId: produtoRef.id, produtoNome: nome,
        quantidade: estoqueInicial, custoUnitario: custo,
        valorTotal: moeda(estoqueInicial * custo), data: hoje(), origem: "estoque-inicial",
        criadoPor: ESTADO.usuario.uid, criadoEm: serverTimestamp()
      });
    }

    evento.target.reset();
    $("produtoEstoque").value = "0";
    toast("Produto comercial cadastrado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast("Não foi possível cadastrar o produto.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

async function registrarCompra(evento) {
  evento.preventDefault();
  if (ESTADO.salvando) return;

  const produtoId = $("compraProduto").value;
  const qtd = numero($("compraQtd").value);
  const custo = moeda($("compraCusto").value);
  const data = $("compraData").value || hoje();
  const produtoAtual = produtoPorId(produtoId);

  if (!produtoAtual || qtd <= 0 || custo < 0) return toast("Confira produto, quantidade e custo.", "erro");

  ESTADO.salvando = true;
  try {
    const produtoRef = doc(db, "familias", ESTADO.familiaId, "comercial_produtos", produtoId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(produtoRef);
      if (!snap.exists()) throw new Error("Produto não encontrado.");
      const atual = snap.data();
      const estoqueAntigo = numero(atual.estoque);
      const custoAntigo = moeda(atual.custoMedio);
      const estoqueNovo = estoqueAntigo + qtd;
      const custoNovo = estoqueNovo > 0
        ? moeda(((estoqueAntigo * custoAntigo) + (qtd * custo)) / estoqueNovo)
        : 0;
      tx.update(produtoRef, { estoque: estoqueNovo, custoMedio: custoNovo, atualizadoEm: serverTimestamp() });
    });

    await addDoc(refs().movimentos, {
      tipo: "compra", produtoId, produtoNome: produtoAtual.nome, quantidade: qtd,
      custoUnitario: custo, valorTotal: moeda(qtd * custo), data,
      criadoPor: ESTADO.usuario.uid, criadoEm: serverTimestamp()
    });

    evento.target.reset();
    $("compraData").value = hoje();
    toast("Compra registrada e custo médio atualizado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível registrar a compra.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

async function registrarVenda(evento) {
  evento.preventDefault();
  if (ESTADO.salvando) return;

  const produtoId = $("vendaProduto").value;
  const qtd = numero($("vendaQtd").value);
  const preco = moeda($("vendaValor").value);
  const data = $("vendaData").value || hoje();
  const produtoAtual = produtoPorId(produtoId);

  if (!produtoAtual || qtd <= 0 || preco < 0) return toast("Confira produto, quantidade e preço.", "erro");

  ESTADO.salvando = true;
  try {
    const produtoRef = doc(db, "familias", ESTADO.familiaId, "comercial_produtos", produtoId);
    let custoCongelado = 0;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(produtoRef);
      if (!snap.exists()) throw new Error("Produto não encontrado.");
      const atual = snap.data();
      const estoque = numero(atual.estoque);
      if (qtd > estoque) throw new Error(`Estoque insuficiente. Disponível: ${fmtNumero(estoque)}.`);
      custoCongelado = moeda(atual.custoMedio);
      tx.update(produtoRef, {
        estoque: estoque - qtd,
        precoVenda: preco,
        atualizadoEm: serverTimestamp()
      });
    });

    const receita = moeda(qtd * preco);
    const custoTotal = moeda(qtd * custoCongelado);
    await addDoc(refs().movimentos, {
      tipo: "venda", produtoId, produtoNome: produtoAtual.nome, quantidade: qtd,
      precoUnitario: preco, custoUnitario: custoCongelado, receita, custoTotal,
      lucroBruto: moeda(receita - custoTotal), data,
      criadoPor: ESTADO.usuario.uid, criadoEm: serverTimestamp()
    });

    evento.target.reset();
    $("vendaData").value = hoje();
    toast("Venda registrada e estoque baixado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível registrar a venda.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

async function registrarDespesa(evento) {
  evento.preventDefault();
  if (ESTADO.salvando) return;

  const descricao = String($("despesaDescricao").value || "").trim();
  const valor = moeda($("despesaValor").value);
  const data = $("despesaData").value || hoje();

  if (!descricao || valor <= 0) return toast("Informe descrição e valor da despesa.", "erro");

  ESTADO.salvando = true;
  try {
    await addDoc(refs().movimentos, {
      tipo: "despesa", descricao, valor, data,
      criadoPor: ESTADO.usuario.uid, criadoEm: serverTimestamp()
    });
    evento.target.reset();
    $("despesaData").value = hoje();
    toast("Despesa registrada.", "ok");
  } catch (erro) {
    console.error(erro);
    toast("Não foi possível registrar a despesa.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

function iniciarListeners() {
  ESTADO.unsubscribeProdutos?.();
  ESTADO.unsubscribeMovimentos?.();

  const r = refs();
  ESTADO.unsubscribeProdutos = onSnapshot(query(r.produtos, orderBy("nome")), (snap) => {
    ESTADO.produtos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderProdutos();
    status("");
  }, (erro) => {
    console.error(erro);
    status("Não foi possível carregar os produtos comerciais.", true);
  });

  ESTADO.unsubscribeMovimentos = onSnapshot(query(r.movimentos, orderBy("criadoEm", "desc")), (snap) => {
    ESTADO.movimentos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMovimentos();
    status("");
  }, (erro) => {
    console.error(erro);
    status("Não foi possível carregar as movimentações comerciais.", true);
  });
}

function configurarEventos() {
  configurarNavegacao();
  configurarDatas();
  $("formProduto").addEventListener("submit", cadastrarProduto);
  $("formCompra").addEventListener("submit", registrarCompra);
  $("formVenda").addEventListener("submit", registrarVenda);
  $("formDespesa").addEventListener("submit", registrarDespesa);
  $("periodoDashboard").addEventListener("change", (e) => {
    ESTADO.periodo = e.target.value;
    renderDashboard();
  });
  $("vendaProduto").addEventListener("change", (e) => {
    const p = produtoPorId(e.target.value);
    $("vendaValor").value = p ? moeda(p.precoVenda).toFixed(2).replace(".", ",") : "";
  });
  $("btnAdminComercial").addEventListener("click", () => {
    window.location.href = "./admin-comercial.html";
  });
}

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    window.location.href = "./index.html";
    return;
  }

  ESTADO.usuario = usuario;
  status("Validando acesso ao Comercial...");

  try {
    ESTADO.permitido = await verificarAcesso(usuario);
    if (!ESTADO.permitido) {
      $("appComercial").hidden = true;
      $("acessoNegado").hidden = false;
      return;
    }

    $("acessoNegado").hidden = true;
    $("appComercial").hidden = false;
    $("btnAdminComercial").hidden = !ESTADO.adminSistema;
    configurarEventos();
    renderPeriodos();
    iniciarListeners();
  } catch (erro) {
    console.error(erro);
    $("appComercial").hidden = true;
    $("acessoNegado").hidden = false;
  }
});

window.addEventListener("beforeunload", () => {
  ESTADO.unsubscribeProdutos?.();
  ESTADO.unsubscribeMovimentos?.();
});

console.log(`✅ Comercial independente ${VERSAO}`);
