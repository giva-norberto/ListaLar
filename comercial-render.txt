// ListaLar Comercial 1.2.0 — renderização e navegação
import {
  $, ESTADO, produtoPorId, escapar, moeda, numero,
  fmtMoeda, fmtNumero, competenciaAtual, competenciaMovimento, rotuloCompetencia
} from "./comercial-contexto.js?v=1.2.0";
import { ordenarMovimentosDesc } from "./comercial-calculos.js?v=1.2.0";

export function abrirTela(tela) {
  document.querySelectorAll(".nav button[data-tela]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tela === tela);
  });
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.toggle("active", s.id === `tela-${tela}`);
  });
}

export function configurarNavegacao() {
  document.querySelectorAll(".nav button[data-tela]").forEach((btn) => {
    btn.addEventListener("click", () => abrirTela(btn.dataset.tela));
  });
}

export function renderSelectProdutos() {
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
}

function botaoEditarProduto(id) {
  return `<button class="btn secondary comercial-btn-editar" type="button" data-editar-produto="${escapar(id)}">Editar</button>`;
}

function htmlProduto(p) {
  const custo = moeda(p.custoMedio);
  const venda = moeda(p.precoVenda);
  const lucro = moeda(venda - custo);
  const margem = venda > 0 ? (lucro / venda) * 100 : 0;
  const markup = custo > 0 ? (lucro / custo) * 100 : 0;
  return `<article class="item">
    <div class="item-top">
      <div class="item-title">${escapar(p.nome)}</div>
      <div class="comercial-item-acoes"><span class="badge">${fmtNumero(p.estoque)} un</span>${botaoEditarProduto(p.id)}</div>
    </div>
    <div class="values">
      <div class="value"><span>Custo médio</span><strong>${fmtMoeda(custo)}</strong></div>
      <div class="value"><span>Preço venda</span><strong>${fmtMoeda(venda)}</strong></div>
      <div class="value"><span>Lucro/un</span><strong>${fmtMoeda(lucro)}</strong></div>
      <div class="value"><span>Margem / markup</span><strong>${margem.toFixed(1)}% / ${markup.toFixed(1)}%</strong></div>
    </div>
  </article>`;
}

export function renderProdutos() {
  const lista = ESTADO.produtos.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const html = lista.length ? lista.map(htmlProduto).join("") : `<div class="empty">Nenhum produto comercial cadastrado.</div>`;
  $("listaProdutos").innerHTML = html;
  $("listaEstoque").innerHTML = html;
  $("dashboardProdutos").innerHTML = lista.length ? lista.slice(0, 6).map(htmlProduto).join("") : html;
  renderSelectProdutos();
  renderDashboard();
}

function botaoEditarMovimento(m) {
  if (!["compra", "venda", "despesa"].includes(m.tipo)) return "";
  return `<button class="btn secondary comercial-btn-editar" type="button" data-editar-movimento="${escapar(m.id)}">Editar</button>`;
}

function htmlMovimento(m) {
  const tipo = String(m.tipo || "");
  const rotulo = tipo === "venda" ? "Venda" : tipo === "compra" ? "Compra" : tipo === "ajuste" ? "Ajuste" : "Despesa";
  const produto = produtoPorId(m.produtoId)?.nome || m.produtoNome || "";
  let detalhe = "";

  if (tipo === "compra") detalhe = `${fmtNumero(m.quantidade)} un × ${fmtMoeda(m.custoUnitario)} = ${fmtMoeda(m.valorTotal)}`;
  else if (tipo === "venda") detalhe = `${fmtNumero(m.quantidade)} un × ${fmtMoeda(m.precoUnitario)} = ${fmtMoeda(m.receita)} · lucro bruto ${fmtMoeda(m.lucroBruto)}`;
  else if (tipo === "ajuste") detalhe = `Estoque ${fmtNumero(m.estoqueAnterior)} → ${fmtNumero(m.estoqueNovo)} · custo ${fmtMoeda(m.custoAnterior)} → ${fmtMoeda(m.custoNovo)}`;
  else detalhe = fmtMoeda(m.valor);

  return `<article class="item">
    <div class="item-top">
      <div><div class="item-title">${escapar(produto || m.descricao || rotulo)}</div><div class="meta">${escapar(m.data || "")} · ${escapar(detalhe)}</div></div>
      <div class="comercial-item-acoes"><span class="badge ${tipo}">${rotulo}</span>${botaoEditarMovimento(m)}</div>
    </div>
  </article>`;
}

export function renderMovimentos() {
  const movs = ESTADO.movimentos.slice().sort(ordenarMovimentosDesc);
  const porTipo = (tipo) => movs.filter((m) => m.tipo === tipo);
  const vazio = `<div class="empty">Nenhum registro.</div>`;
  const compras = porTipo("compra");
  const vendas = porTipo("venda");
  const despesas = porTipo("despesa");
  $("listaCompras").innerHTML = compras.length ? compras.slice(0, 20).map(htmlMovimento).join("") : vazio;
  $("listaVendas").innerHTML = vendas.length ? vendas.slice(0, 20).map(htmlMovimento).join("") : vazio;
  $("listaDespesas").innerHTML = despesas.length ? despesas.slice(0, 20).map(htmlMovimento).join("") : vazio;
  $("listaHistorico").innerHTML = movs.length ? movs.slice(0, 100).map(htmlMovimento).join("") : vazio;
  renderPeriodos();
  renderDashboard();
}

export function renderPeriodos() {
  const select = $("periodoDashboard");
  if (!select) return;
  const periodos = new Set([competenciaAtual()]);
  ESTADO.movimentos.forEach((m) => {
    const c = competenciaMovimento(m);
    if (c) periodos.add(c);
  });
  const ordenados = [...periodos].sort().reverse();
  select.innerHTML = `<option value="todos">Todos os períodos</option>${ordenados.map((p) => `<option value="${p}">${rotuloCompetencia(p)}</option>`).join("")}`;
  select.value = [...select.options].some((o) => o.value === ESTADO.periodo)
    ? ESTADO.periodo
    : competenciaAtual();
}

export function renderDashboard() {
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
