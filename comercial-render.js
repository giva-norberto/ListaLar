// ListaLar Comercial 1.3.2 — renderização, navegação, estoque compacto e gráfico do Dashboard
import {
  $, ESTADO, produtoPorId, escapar, moeda,
  fmtMoeda, fmtNumero, competenciaAtual, competenciaMovimento, rotuloCompetencia
} from "./comercial-contexto.js?v=1.2.0";
import { ordenarMovimentosDesc } from "./comercial-calculos.js?v=1.2.0";

function unidadeProduto(produto) {
  return String(produto?.unidade || "UN").trim().toUpperCase() || "UN";
}

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
    .map((p) => `<option value="${escapar(p.id)}">${escapar(p.nome)} — estoque ${fmtNumero(p.estoque)} ${escapar(unidadeProduto(p))}</option>`)
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
  const unidade = unidadeProduto(p);

  return `<article class="item">
    <div class="comercial-produto-descricao">${escapar(p.nome)}</div>
    <div class="comercial-produto-meta">
      <span>Unidade: <b>${escapar(unidade)}</b></span>
      <span aria-hidden="true">•</span>
      <span>Estoque atual: <b>${fmtNumero(p.estoque)}</b></span>
    </div>
    <div class="comercial-produto-acoes">${botaoEditarProduto(p.id)}</div>
    <div class="values">
      <div class="value"><span>Custo médio</span><strong>${fmtMoeda(custo)}</strong></div>
      <div class="value"><span>Preço venda</span><strong>${fmtMoeda(venda)}</strong></div>
      <div class="value"><span>Lucro/${escapar(unidade)}</span><strong>${fmtMoeda(lucro)}</strong></div>
      <div class="value"><span>Margem / markup</span><strong>${margem.toFixed(1)}% / ${markup.toFixed(1)}%</strong></div>
    </div>
  </article>`;
}

function criarEstilosEstoque() {
  if ($("comercialEstoqueCompactoEstilos")) return;
  const style = document.createElement("style");
  style.id = "comercialEstoqueCompactoEstilos";
  style.textContent = `
    #listaEstoque{gap:10px}
    .comercial-estoque-card{
      position:relative;
      overflow:hidden;
      display:grid;
      gap:7px;
      padding:15px 16px 15px 18px;
      border:1.5px solid #bbf7d0;
      border-left:7px solid #16a34a;
      border-radius:17px;
      background:linear-gradient(135deg,#f0fdf4 0%,#ffffff 78%);
      box-shadow:0 6px 16px rgba(15,23,42,.06);
    }
    .comercial-estoque-card.baixo{
      border-color:#fed7aa;
      border-left-color:#f59e0b;
      background:linear-gradient(135deg,#fff7ed 0%,#ffffff 78%);
    }
    .comercial-estoque-card.zerado{
      border-color:#fecaca;
      border-left-color:#dc2626;
      background:linear-gradient(135deg,#fff1f2 0%,#ffffff 78%);
    }
    .comercial-estoque-produto{
      color:#172033;
      font-size:20px;
      line-height:1.18;
      font-weight:850;
      overflow-wrap:anywhere;
    }
    .comercial-estoque-qtd{
      color:#166534;
      font-size:24px;
      line-height:1.08;
      font-weight:950;
    }
    .comercial-estoque-card.baixo .comercial-estoque-qtd{color:#b45309}
    .comercial-estoque-card.zerado .comercial-estoque-qtd{color:#b91c1c}
    @media(max-width:760px){
      .comercial-estoque-card{padding:14px 14px 14px 16px;border-radius:16px}
      .comercial-estoque-produto{font-size:19px}
      .comercial-estoque-qtd{font-size:23px}
    }
  `;
  document.head.appendChild(style);
}

function htmlEstoque(p) {
  const estoque = Number(p.estoque) || 0;
  const classe = estoque <= 0 ? "zerado" : estoque <= 3 ? "baixo" : "ok";
  const unidade = unidadeProduto(p);

  return `<article class="comercial-estoque-card ${classe}">
    <div class="comercial-estoque-produto">${escapar(p.nome)}</div>
    <div class="comercial-estoque-qtd">Estoque: ${fmtNumero(estoque)} ${escapar(unidade)}</div>
  </article>`;
}

export function renderProdutos() {
  const lista = ESTADO.produtos.slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const html = lista.length ? lista.map(htmlProduto).join("") : `<div class="empty">Nenhum produto comercial cadastrado.</div>`;
  const htmlEstoqueLista = lista.length ? lista.map(htmlEstoque).join("") : `<div class="empty">Nenhum produto comercial cadastrado.</div>`;
  $("listaProdutos").innerHTML = html;
  criarEstilosEstoque();
  $("listaEstoque").innerHTML = htmlEstoqueLista;
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
  const produtoAtual = produtoPorId(m.produtoId);
  const produto = produtoAtual?.nome || m.produtoNome || "";
  const unidade = String(m.unidade || produtoAtual?.unidade || "UN").trim().toUpperCase() || "UN";
  let detalhe = "";

  if (tipo === "compra") detalhe = `${fmtNumero(m.quantidade)} ${unidade} × ${fmtMoeda(m.custoUnitario)} = ${fmtMoeda(m.valorTotal)}`;
  else if (tipo === "venda") detalhe = `${fmtNumero(m.quantidade)} ${unidade} × ${fmtMoeda(m.precoUnitario)} = ${fmtMoeda(m.receita)} · lucro bruto ${fmtMoeda(m.lucroBruto)}`;
  else if (tipo === "ajuste") detalhe = `Estoque ${fmtNumero(m.estoqueAnterior)} → ${fmtNumero(m.estoqueNovo)} ${unidade} · custo ${fmtMoeda(m.custoAnterior)} → ${fmtMoeda(m.custoNovo)}`;
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

function criarEstilosDashboard() {
  if ($("comercialDashboardGraficoEstilos")) return;
  const style = document.createElement("style");
  style.id = "comercialDashboardGraficoEstilos";
  style.textContent = `
    .comercial-dashboard-grafico{display:block!important;min-height:270px}
    .comercial-grafico-legenda{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 10px;color:#52657b;font-size:14px;font-weight:900}
    .comercial-grafico-legenda span{display:flex;align-items:center;gap:6px}
    .comercial-grafico-legenda i{display:inline-block;width:11px;height:11px;border-radius:999px}
    .comercial-grafico-wrap{width:100%;overflow-x:auto;border:1px solid #e1eaee;border-radius:15px;background:linear-gradient(180deg,#fff,#f8fbfc);padding:8px 8px 2px}
    .comercial-grafico-wrap svg{display:block;width:100%;min-width:620px;height:auto}
    .comercial-grafico-vazio{padding:48px 18px;border:1.5px dashed #bfcfd6;border-radius:14px;background:#f8fafc;color:#607086;text-align:center;font-weight:800}
    @media(max-width:760px){.comercial-dashboard-grafico{min-height:230px}.comercial-grafico-legenda{gap:10px;font-size:13px}.comercial-grafico-wrap svg{min-width:560px}}
  `;
  document.head.appendChild(style);
}

function prepararDashboardVisual() {
  $("kpiEstoqueCusto")?.closest(".kpi")?.remove();
  $("kpiEstoqueVenda")?.closest(".kpi")?.remove();

  const alvo = $("dashboardProdutos");
  if (!alvo) return null;
  const card = alvo.closest(".card");
  const titulo = card?.querySelector("h2");
  if (titulo) titulo.textContent = "Evolução do negócio";
  alvo.classList.remove("list");
  alvo.classList.add("comercial-dashboard-grafico");
  criarEstilosDashboard();
  return alvo;
}

function chaveGrafico(movimento, periodo) {
  const data = String(movimento.data || "");
  if (periodo === "todos") return competenciaMovimento(movimento);
  if (/^\d{4}-\d{2}-\d{2}$/.test(data) && data.startsWith(`${periodo}-`)) return data;
  return "";
}

function rotuloChaveGrafico(chave, periodo) {
  if (periodo === "todos") {
    const m = String(chave).match(/^(\d{4})-(\d{2})$/);
    return m ? `${m[2]}/${String(m[1]).slice(2)}` : chave;
  }
  const m = String(chave).match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : chave;
}

function dadosGrafico(movimentos, periodo) {
  const grupos = new Map();

  movimentos.forEach((m) => {
    const chave = chaveGrafico(m, periodo);
    if (!chave) return;
    if (!grupos.has(chave)) grupos.set(chave, { chave, faturamento: 0, custo: 0, despesas: 0 });
    const grupo = grupos.get(chave);

    if (m.tipo === "venda") {
      grupo.faturamento += moeda(m.receita);
      grupo.custo += moeda(m.custoTotal);
    } else if (m.tipo === "despesa") {
      grupo.despesas += moeda(m.valor);
    }
  });

  return [...grupos.values()]
    .sort((a, b) => a.chave.localeCompare(b.chave))
    .map((g) => ({
      ...g,
      resultado: moeda(g.faturamento - g.custo - g.despesas),
      rotulo: rotuloChaveGrafico(g.chave, periodo)
    }));
}

function fmtEixo(valor) {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1000000) return `R$ ${(valor / 1000000).toFixed(1).replace(".", ",")} mi`;
  if (absoluto >= 1000) return `R$ ${(valor / 1000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${Math.round(valor).toLocaleString("pt-BR")}`;
}

function pontosSerie(dados, campo, x, y) {
  return dados.map((d, i) => `${x(i)},${y(d[campo])}`).join(" ");
}

function circulosSerie(dados, campo, x, y, cor) {
  return dados.map((d, i) => `<circle cx="${x(i)}" cy="${y(d[campo])}" r="4" fill="${cor}"><title>${escapar(d.rotulo)} · ${escapar(fmtMoeda(d[campo]))}</title></circle>`).join("");
}

function htmlGrafico(dados) {
  if (!dados.length) {
    return `<div class="comercial-grafico-vazio">Ainda não há vendas ou despesas no período selecionado.</div>`;
  }

  const largura = 900;
  const altura = 300;
  const esquerda = 78;
  const direita = 24;
  const topo = 22;
  const fundo = 48;
  const larguraUtil = largura - esquerda - direita;
  const alturaUtil = altura - topo - fundo;
  const valores = dados.flatMap((d) => [d.faturamento, d.despesas, d.resultado]);
  let minimo = Math.min(0, ...valores);
  let maximo = Math.max(0, ...valores);
  if (maximo === minimo) maximo = minimo + 1;
  const margem = Math.max((maximo - minimo) * 0.08, 1);
  maximo += margem;
  minimo -= minimo < 0 ? margem : 0;

  const x = (indice) => dados.length === 1
    ? esquerda + larguraUtil / 2
    : esquerda + (indice / (dados.length - 1)) * larguraUtil;
  const y = (valor) => topo + ((maximo - valor) / (maximo - minimo)) * alturaUtil;
  const linhas = 4;
  const grade = Array.from({ length: linhas + 1 }, (_, i) => {
    const valor = maximo - ((maximo - minimo) * i / linhas);
    const yy = y(valor);
    return `<line x1="${esquerda}" y1="${yy}" x2="${largura - direita}" y2="${yy}" stroke="#e2e8f0" stroke-width="1"/><text x="${esquerda - 10}" y="${yy + 4}" text-anchor="end" fill="#64748b" font-size="12" font-weight="700">${escapar(fmtEixo(valor))}</text>`;
  }).join("");
  const passoRotulo = Math.max(1, Math.ceil(dados.length / 9));
  const rotulos = dados.map((d, i) => {
    if (i % passoRotulo !== 0 && i !== dados.length - 1) return "";
    return `<text x="${x(i)}" y="${altura - 17}" text-anchor="middle" fill="#64748b" font-size="12" font-weight="800">${escapar(d.rotulo)}</text>`;
  }).join("");
  const zeroY = y(0);

  return `
    <div class="comercial-grafico-legenda" aria-label="Legenda do gráfico">
      <span><i style="background:#2563eb"></i>Faturamento</span>
      <span><i style="background:#e11d48"></i>Despesas</span>
      <span><i style="background:#16a34a"></i>Resultado</span>
    </div>
    <div class="comercial-grafico-wrap">
      <svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico de evolução do faturamento, despesas e resultado">
        ${grade}
        <line x1="${esquerda}" y1="${zeroY}" x2="${largura - direita}" y2="${zeroY}" stroke="#94a3b8" stroke-width="1.5"/>
        <polyline points="${pontosSerie(dados, "faturamento", x, y)}" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="${pontosSerie(dados, "despesas", x, y)}" fill="none" stroke="#e11d48" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        <polyline points="${pontosSerie(dados, "resultado", x, y)}" fill="none" stroke="#16a34a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${circulosSerie(dados, "faturamento", x, y, "#2563eb")}
        ${circulosSerie(dados, "despesas", x, y, "#e11d48")}
        ${circulosSerie(dados, "resultado", x, y, "#16a34a")}
        ${rotulos}
      </svg>
    </div>`;
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

  $("kpiReceita").textContent = fmtMoeda(receita);
  $("kpiCusto").textContent = fmtMoeda(custo);
  $("kpiLucro").textContent = fmtMoeda(lucro);
  $("kpiDespesas").textContent = fmtMoeda(desp);
  $("kpiResultado").textContent = fmtMoeda(resultado);
  $("kpiMargem").textContent = `${margem.toFixed(1)}%`;
  $("cardResultado").classList.toggle("neg", resultado < 0);

  const grafico = prepararDashboardVisual();
  if (grafico) grafico.innerHTML = htmlGrafico(dadosGrafico(movs, periodo));
}
