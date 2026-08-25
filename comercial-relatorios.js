// ListaLar Comercial 1.3.12 — relatórios de vendas e compras por período
import {
  $, ESTADO, produtoPorId, escapar, moeda, quantidade,
  fmtMoeda, fmtNumero, hoje, dataValida
} from "./comercial-contexto.js?v=1.2.0";

const ID_TELA = "tela-relatorios";
const ID_INICIO = "relatorioDataInicio";
const ID_FIM = "relatorioDataFim";
const ID_CONTEUDO = "relatorioConteudo";
const ID_RESUMO = "relatorioResumo";
let tipoAtual = "venda";

function inicioMesAtual() {
  return `${hoje().slice(0, 7)}-01`;
}

function dataMovimento(movimento) {
  const informada = String(movimento?.data || "");
  if (dataValida(informada)) return informada;

  const criada = movimento?.criadoEm?.toDate?.();
  if (!criada) return "";
  return `${criada.getFullYear()}-${String(criada.getMonth() + 1).padStart(2, "0")}-${String(criada.getDate()).padStart(2, "0")}`;
}

function produtoNome(movimento) {
  return String(produtoPorId(movimento?.produtoId)?.nome || movimento?.produtoNome || "Produto não encontrado");
}

function movimentosFiltrados() {
  const inicio = $(ID_INICIO)?.value || inicioMesAtual();
  const fim = $(ID_FIM)?.value || hoje();

  return ESTADO.movimentos
    .filter((m) => m.tipo === tipoAtual)
    .filter((m) => {
      const data = dataMovimento(m);
      return data && data >= inicio && data <= fim;
    })
    .sort((a, b) => {
      const porData = dataMovimento(b).localeCompare(dataMovimento(a));
      if (porData) return porData;
      const aMs = a?.criadoEm?.toMillis?.() || 0;
      const bMs = b?.criadoEm?.toMillis?.() || 0;
      return bMs - aMs;
    });
}

function valorCompra(movimento) {
  const registrado = moeda(movimento?.valorTotal);
  if (registrado) return registrado;
  return moeda(quantidade(movimento?.quantidade) * moeda(movimento?.custoUnitario));
}

function criarEstilos() {
  if ($("comercialRelatoriosEstilos")) return;
  const style = document.createElement("style");
  style.id = "comercialRelatoriosEstilos";
  style.textContent = `
    #${ID_TELA} .comercial-relatorio-filtros{
      display:grid;
      grid-template-columns:1fr 1fr auto;
      gap:10px;
      align-items:end;
      margin-bottom:14px;
    }
    #${ID_TELA} .comercial-relatorio-tipos{
      display:flex;
      gap:8px;
      margin-bottom:14px;
      overflow-x:auto;
    }
    #${ID_TELA} .comercial-relatorio-tipos button{
      flex:0 0 auto;
      min-height:42px;
      padding:9px 14px;
      border:1.5px solid #cbd9df;
      border-radius:12px;
      background:#f8fafc;
      color:#334155;
      font-weight:900;
      cursor:pointer;
    }
    #${ID_TELA} .comercial-relatorio-tipos button.active{
      border-color:#0d9488;
      background:#ccfbf1;
      color:#115e59;
    }
    #${ID_TELA} .comercial-relatorio-resumo{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:10px;
      margin-bottom:14px;
    }
    #${ID_TELA} .comercial-relatorio-kpi{
      padding:13px 14px;
      border:1.5px solid #dbe7ea;
      border-radius:15px;
      background:#fff;
      box-shadow:0 4px 12px rgba(15,23,42,.05);
    }
    #${ID_TELA} .comercial-relatorio-kpi span{
      display:block;
      color:#64748b;
      font-size:13px;
      font-weight:900;
      margin-bottom:5px;
    }
    #${ID_TELA} .comercial-relatorio-kpi strong{
      display:block;
      color:#172033;
      font-size:20px;
      line-height:1.1;
    }
    #${ID_TELA} .comercial-relatorio-tabela-wrap{
      overflow-x:auto;
      border:1px solid #dbe7ea;
      border-radius:15px;
      background:#fff;
    }
    #${ID_TELA} table{
      width:100%;
      min-width:760px;
      border-collapse:collapse;
    }
    #${ID_TELA} th,#${ID_TELA} td{
      padding:11px 12px;
      border-bottom:1px solid #e7eef0;
      text-align:left;
      white-space:nowrap;
      font-size:14px;
    }
    #${ID_TELA} th{
      background:#f1f5f9;
      color:#475569;
      font-weight:900;
      position:sticky;
      top:0;
    }
    #${ID_TELA} td{
      color:#334155;
      font-weight:700;
    }
    #${ID_TELA} td.produto{
      max-width:290px;
      white-space:normal;
      font-weight:900;
      color:#172033;
    }
    #${ID_TELA} .comercial-relatorio-vazio{
      padding:24px;
      text-align:center;
      color:#64748b;
      font-weight:800;
    }
    #${ID_TELA} .comercial-relatorio-exportar{white-space:nowrap}
    @media(max-width:760px){
      #${ID_TELA} .comercial-relatorio-filtros{grid-template-columns:1fr 1fr}
      #${ID_TELA} .comercial-relatorio-exportar{grid-column:1/-1;width:100%}
      #${ID_TELA} .comercial-relatorio-resumo{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);
}

function montarInterface() {
  criarEstilos();

  const nav = document.querySelector(".nav");
  const historicoBtn = nav?.querySelector('button[data-tela="historico"]');
  if (nav && historicoBtn && !nav.querySelector('button[data-tela="relatorios"]')) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.dataset.tela = "relatorios";
    botao.textContent = "📑 Relatórios";
    historicoBtn.before(botao);
  }

  const historico = $("tela-historico");
  if (historico && !$(ID_TELA)) {
    const tela = document.createElement("section");
    tela.id = ID_TELA;
    tela.className = "screen";
    tela.innerHTML = `
      <div class="card">
        <h2>Relatórios</h2>
        <div class="comercial-relatorio-tipos" role="tablist" aria-label="Tipo de relatório">
          <button type="button" class="active" data-relatorio-tipo="venda">Vendas</button>
          <button type="button" data-relatorio-tipo="compra">Compras</button>
        </div>
        <div class="comercial-relatorio-filtros">
          <div class="field"><label>De</label><input id="${ID_INICIO}" class="input" type="date"></div>
          <div class="field"><label>Até</label><input id="${ID_FIM}" class="input" type="date"></div>
          <button id="btnExportarRelatorio" class="btn comercial-relatorio-exportar" type="button">Exportar CSV</button>
        </div>
        <div id="${ID_RESUMO}" class="comercial-relatorio-resumo"></div>
        <div id="${ID_CONTEUDO}"></div>
      </div>`;
    historico.before(tela);
  }

  if ($(ID_INICIO) && !$(ID_INICIO).value) $(ID_INICIO).value = inicioMesAtual();
  if ($(ID_FIM) && !$(ID_FIM).value) $(ID_FIM).value = hoje();
}

function htmlResumoVendas(lista) {
  const faturamento = lista.reduce((s, m) => s + moeda(m.receita), 0);
  const custo = lista.reduce((s, m) => s + moeda(m.custoTotal), 0);
  const lucro = moeda(faturamento - custo);
  return `
    <div class="comercial-relatorio-kpi"><span>Faturamento</span><strong>${fmtMoeda(faturamento)}</strong></div>
    <div class="comercial-relatorio-kpi"><span>Custo das vendas</span><strong>${fmtMoeda(custo)}</strong></div>
    <div class="comercial-relatorio-kpi"><span>Lucro bruto</span><strong>${fmtMoeda(lucro)}</strong></div>`;
}

function htmlResumoCompras(lista) {
  const total = lista.reduce((s, m) => s + valorCompra(m), 0);
  const produtos = new Set(lista.map((m) => String(m.produtoId || "")).filter(Boolean)).size;
  return `
    <div class="comercial-relatorio-kpi"><span>Total em compras</span><strong>${fmtMoeda(total)}</strong></div>
    <div class="comercial-relatorio-kpi"><span>Lançamentos</span><strong>${fmtNumero(lista.length)}</strong></div>
    <div class="comercial-relatorio-kpi"><span>Produtos distintos</span><strong>${fmtNumero(produtos)}</strong></div>`;
}

function htmlVendas(lista) {
  if (!lista.length) return `<div class="comercial-relatorio-vazio">Nenhuma venda encontrada no período.</div>`;
  const linhas = lista.map((m) => `
    <tr>
      <td>${escapar(dataMovimento(m))}</td>
      <td class="produto">${escapar(produtoNome(m))}</td>
      <td>${fmtNumero(m.quantidade)}</td>
      <td>${fmtMoeda(m.precoUnitario)}</td>
      <td>${fmtMoeda(m.receita)}</td>
      <td>${fmtMoeda(m.custoTotal)}</td>
      <td>${fmtMoeda(m.lucroBruto)}</td>
    </tr>`).join("");
  return `<div class="comercial-relatorio-tabela-wrap"><table>
    <thead><tr><th>Data</th><th>Produto</th><th>Qtd.</th><th>Preço unit.</th><th>Faturamento</th><th>Custo venda</th><th>Lucro bruto</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table></div>`;
}

function htmlCompras(lista) {
  if (!lista.length) return `<div class="comercial-relatorio-vazio">Nenhuma compra encontrada no período.</div>`;
  const linhas = lista.map((m) => `
    <tr>
      <td>${escapar(dataMovimento(m))}</td>
      <td class="produto">${escapar(produtoNome(m))}</td>
      <td>${fmtNumero(m.quantidade)}</td>
      <td>${fmtMoeda(m.custoUnitario)}</td>
      <td>${fmtMoeda(valorCompra(m))}</td>
    </tr>`).join("");
  return `<div class="comercial-relatorio-tabela-wrap"><table>
    <thead><tr><th>Data</th><th>Produto</th><th>Qtd.</th><th>Custo unit.</th><th>Total</th></tr></thead>
    <tbody>${linhas}</tbody>
  </table></div>`;
}

export function renderRelatorios() {
  if (!$(ID_CONTEUDO) || !$(ID_RESUMO)) return;
  const lista = movimentosFiltrados();
  $(ID_RESUMO).innerHTML = tipoAtual === "venda" ? htmlResumoVendas(lista) : htmlResumoCompras(lista);
  $(ID_CONTEUDO).innerHTML = tipoAtual === "venda" ? htmlVendas(lista) : htmlCompras(lista);
}

function numeroCsv(valor, casas = 2) {
  return Number(valor || 0).toFixed(casas).replace(".", ",");
}

function campoCsv(valor) {
  const texto = String(valor ?? "").replace(/"/g, '""');
  return `"${texto}"`;
}

function csvAtual() {
  const lista = movimentosFiltrados();
  if (tipoAtual === "venda") {
    const cabecalho = ["Data", "Produto", "Quantidade", "Preço unitário", "Faturamento", "Custo da venda", "Lucro bruto"];
    const linhas = lista.map((m) => [
      dataMovimento(m), produtoNome(m), numeroCsv(quantidade(m.quantidade), 3),
      numeroCsv(moeda(m.precoUnitario)), numeroCsv(moeda(m.receita)),
      numeroCsv(moeda(m.custoTotal)), numeroCsv(moeda(m.lucroBruto))
    ]);
    return [cabecalho, ...linhas].map((linha) => linha.map(campoCsv).join(";")).join("\r\n");
  }

  const cabecalho = ["Data", "Produto", "Quantidade", "Custo unitário", "Total da compra"];
  const linhas = lista.map((m) => [
    dataMovimento(m), produtoNome(m), numeroCsv(quantidade(m.quantidade), 3),
    numeroCsv(moeda(m.custoUnitario)), numeroCsv(valorCompra(m))
  ]);
  return [cabecalho, ...linhas].map((linha) => linha.map(campoCsv).join(";")).join("\r\n");
}

function exportarCsv() {
  const inicio = $(ID_INICIO)?.value || inicioMesAtual();
  const fim = $(ID_FIM)?.value || hoje();
  const nome = `relatorio-${tipoAtual === "venda" ? "vendas" : "compras"}-${inicio}-a-${fim}.csv`;
  const blob = new Blob(["\uFEFF", csvAtual()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ajustarDatas(alterado) {
  const inicio = $(ID_INICIO);
  const fim = $(ID_FIM);
  if (!inicio || !fim || !dataValida(inicio.value) || !dataValida(fim.value)) return;
  if (inicio.value > fim.value) {
    if (alterado === "inicio") fim.value = inicio.value;
    else inicio.value = fim.value;
  }
  renderRelatorios();
}

function configurarEventos() {
  const navRelatorios = document.querySelector('.nav button[data-tela="relatorios"]');
  navRelatorios?.addEventListener("click", renderRelatorios);

  document.querySelectorAll("[data-relatorio-tipo]").forEach((botao) => {
    botao.addEventListener("click", () => {
      tipoAtual = botao.dataset.relatorioTipo === "compra" ? "compra" : "venda";
      document.querySelectorAll("[data-relatorio-tipo]").forEach((b) => b.classList.toggle("active", b === botao));
      renderRelatorios();
    });
  });

  $(ID_INICIO)?.addEventListener("change", () => ajustarDatas("inicio"));
  $(ID_FIM)?.addEventListener("change", () => ajustarDatas("fim"));
  $("btnExportarRelatorio")?.addEventListener("click", exportarCsv);
}

montarInterface();
configurarEventos();
