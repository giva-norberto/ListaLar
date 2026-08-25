// ListaLar Comercial 1.3.16 — Curva ABC de vendas por faturamento
import {
  $, ESTADO, produtoPorId, escapar, moeda, quantidade,
  fmtMoeda, fmtNumero, hoje, dataValida
} from "./comercial-contexto.js?v=1.2.0";

const ID_INICIO = "relatorioDataInicio";
const ID_FIM = "relatorioDataFim";
const ID_CONTEUDO = "relatorioConteudo";
const ID_RESUMO = "relatorioResumo";
let abcAtivo = false;

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

function vendasPeriodo() {
  const inicio = $(ID_INICIO)?.value || inicioMesAtual();
  const fim = $(ID_FIM)?.value || hoje();

  return ESTADO.movimentos.filter((movimento) => {
    if (movimento.tipo !== "venda") return false;
    const data = dataMovimento(movimento);
    return data && data >= inicio && data <= fim;
  });
}

function dadosCurvaABC() {
  const grupos = new Map();

  vendasPeriodo().forEach((movimento) => {
    const nome = produtoNome(movimento);
    const chave = String(movimento.produtoId || nome);
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        produto: nome,
        quantidade: 0,
        faturamento: 0,
        custo: 0,
        lucro: 0
      });
    }

    const grupo = grupos.get(chave);
    grupo.quantidade += quantidade(movimento.quantidade);
    grupo.faturamento += moeda(movimento.receita);
    grupo.custo += moeda(movimento.custoTotal);
    grupo.lucro += moeda(movimento.lucroBruto);
  });

  const ordenados = [...grupos.values()].sort((a, b) => {
    const porFaturamento = b.faturamento - a.faturamento;
    if (porFaturamento) return porFaturamento;
    const porQuantidade = b.quantidade - a.quantidade;
    if (porQuantidade) return porQuantidade;
    return a.produto.localeCompare(b.produto, "pt-BR");
  });

  const faturamentoTotal = ordenados.reduce((soma, item) => soma + item.faturamento, 0);
  let acumulado = 0;

  return ordenados.map((item, indice) => {
    const participacao = faturamentoTotal > 0 ? (item.faturamento / faturamentoTotal) * 100 : 0;
    const acumuladoAntes = acumulado;
    acumulado += participacao;
    const classe = faturamentoTotal <= 0
      ? "C"
      : acumuladoAntes < 80
        ? "A"
        : acumuladoAntes < 95
          ? "B"
          : "C";

    return {
      ...item,
      posicao: indice + 1,
      participacao,
      acumulado: Math.min(acumulado, 100),
      classe
    };
  });
}

function pct(valor) {
  return `${Number(valor || 0).toFixed(1).replace(".", ",")}%`;
}

function criarEstilosABC() {
  if ($("comercialRelatoriosAbcEstilos")) return;
  const style = document.createElement("style");
  style.id = "comercialRelatoriosAbcEstilos";
  style.textContent = `
    #tela-relatorios .comercial-abc-explicacao{
      margin:0 0 12px;
      padding:10px 12px;
      border:1px solid #dbe7ea;
      border-radius:12px;
      background:#f8fafc;
      color:#52657b;
      font-size:13px;
      line-height:1.35;
      font-weight:750;
    }
    #tela-relatorios .comercial-abc-classe{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:32px;
      min-height:28px;
      padding:3px 9px;
      border-radius:999px;
      font-weight:950;
    }
    #tela-relatorios .comercial-abc-classe.a{background:#dcfce7;color:#166534}
    #tela-relatorios .comercial-abc-classe.b{background:#fef3c7;color:#92400e}
    #tela-relatorios .comercial-abc-classe.c{background:#fee2e2;color:#991b1b}
    #tela-relatorios .comercial-abc-posicao{font-weight:950;color:#0f766e}
    @media(max-width:760px){
      #tela-relatorios .comercial-abc-explicacao{font-size:12px;padding:9px 10px}
    }
  `;
  document.head.appendChild(style);
}

function htmlResumoABC(dados) {
  const faturamento = dados.reduce((soma, item) => soma + item.faturamento, 0);
  const qtdVendida = dados.reduce((soma, item) => soma + item.quantidade, 0);
  const classeA = dados.filter((item) => item.classe === "A").length;

  return `
    <div class="comercial-relatorio-kpi"><span>Faturamento</span><strong>${fmtMoeda(faturamento)}</strong></div>
    <div class="comercial-relatorio-kpi"><span>Qtd. vendida</span><strong>${fmtNumero(qtdVendida)}</strong></div>
    <div class="comercial-relatorio-kpi"><span>Produtos Classe A</span><strong>${fmtNumero(classeA)}</strong></div>`;
}

function htmlCurvaABC(dados) {
  if (!dados.length) {
    return `<div class="comercial-relatorio-vazio">Nenhuma venda encontrada no período para montar a Curva ABC.</div>`;
  }

  const linhas = dados.map((item) => `
    <tr>
      <td class="comercial-abc-posicao">${item.posicao}º</td>
      <td class="produto">${escapar(item.produto)}</td>
      <td>${fmtNumero(item.quantidade)}</td>
      <td>${fmtMoeda(item.faturamento)}</td>
      <td>${pct(item.participacao)}</td>
      <td>${pct(item.acumulado)}</td>
      <td><span class="comercial-abc-classe ${item.classe.toLowerCase()}">${item.classe}</span></td>
    </tr>`).join("");

  return `
    <div class="comercial-abc-explicacao">
      Ranking do maior para o menor faturamento no período. Classe A concentra aproximadamente os primeiros 80% do faturamento, Classe B os 15% seguintes e Classe C o restante.
    </div>
    <div class="comercial-relatorio-tabela-wrap"><table>
      <thead><tr><th>#</th><th>Produto</th><th>Qtd. vendida</th><th>Faturamento</th><th>Participação</th><th>Acumulado</th><th>Classe</th></tr></thead>
      <tbody>${linhas}</tbody>
    </table></div>`;
}

function renderABC() {
  if (!abcAtivo || !$(ID_CONTEUDO) || !$(ID_RESUMO)) return;
  const dados = dadosCurvaABC();
  $(ID_RESUMO).innerHTML = htmlResumoABC(dados);
  $(ID_CONTEUDO).innerHTML = htmlCurvaABC(dados);
}

function numeroCsv(valor, casas = 2) {
  return Number(valor || 0).toFixed(casas).replace(".", ",");
}

function campoCsv(valor) {
  const texto = String(valor ?? "").replace(/"/g, '""');
  return `"${texto}"`;
}

function csvABC() {
  const cabecalho = ["Posição", "Produto", "Quantidade vendida", "Faturamento", "Participação %", "Acumulado %", "Classe"];
  const linhas = dadosCurvaABC().map((item) => [
    item.posicao,
    item.produto,
    numeroCsv(item.quantidade, 3),
    numeroCsv(item.faturamento),
    numeroCsv(item.participacao),
    numeroCsv(item.acumulado),
    item.classe
  ]);
  return [cabecalho, ...linhas].map((linha) => linha.map(campoCsv).join(";")).join("\r\n");
}

function exportarABC() {
  const inicio = $(ID_INICIO)?.value || inicioMesAtual();
  const fim = $(ID_FIM)?.value || hoje();
  const blob = new Blob(["\uFEFF", csvABC()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-curva-abc-${inicio}-a-${fim}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function selecionarABC(botao) {
  abcAtivo = true;
  document.querySelectorAll("[data-relatorio-tipo]").forEach((item) => {
    item.classList.toggle("active", item === botao);
  });
  renderABC();
}

function montarOpcaoABC(tentativa = 0) {
  criarEstilosABC();
  const tipos = document.querySelector("#tela-relatorios .comercial-relatorio-tipos");
  if (!tipos) {
    if (tentativa < 24) setTimeout(() => montarOpcaoABC(tentativa + 1), 250);
    return;
  }

  if (!tipos.querySelector('[data-relatorio-tipo="abc"]')) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.dataset.relatorioTipo = "abc";
    botao.textContent = "Curva ABC";
    tipos.appendChild(botao);
  }
}

montarOpcaoABC();

document.addEventListener("click", (evento) => {
  const tipo = evento.target?.closest?.("[data-relatorio-tipo]");
  if (tipo) {
    if (tipo.dataset.relatorioTipo === "abc") selecionarABC(tipo);
    else abcAtivo = false;
  }

  const navRelatorios = evento.target?.closest?.('button[data-tela="relatorios"]');
  if (navRelatorios && abcAtivo) setTimeout(renderABC, 0);
});

document.addEventListener("change", (evento) => {
  if (!abcAtivo) return;
  if (evento.target?.id === ID_INICIO || evento.target?.id === ID_FIM) {
    setTimeout(renderABC, 0);
  }
});

document.addEventListener("click", (evento) => {
  if (!abcAtivo || !evento.target?.closest?.("#btnExportarRelatorio")) return;
  evento.preventDefault();
  evento.stopPropagation();
  evento.stopImmediatePropagation();
  exportarABC();
}, true);
