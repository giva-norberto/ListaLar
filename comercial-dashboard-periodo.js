// ListaLar Comercial 1.3.9 — filtro do Dashboard por intervalo de datas
import {
  $, ESTADO, moeda, fmtMoeda, escapar, hoje, dataValida
} from "./comercial-contexto.js?v=1.2.0";

const ID_AREA = "periodoDashboardDatas";
const ID_INICIO = "periodoDashboardInicio";
const ID_FIM = "periodoDashboardFim";

function inicioMesAtual() {
  return `${hoje().slice(0, 7)}-01`;
}

function garantirPeriodo() {
  if (!dataValida(ESTADO.dataInicioDashboard)) {
    ESTADO.dataInicioDashboard = inicioMesAtual();
  }
  if (!dataValida(ESTADO.dataFimDashboard)) {
    ESTADO.dataFimDashboard = hoje();
  }
  if (ESTADO.dataInicioDashboard > ESTADO.dataFimDashboard) {
    ESTADO.dataFimDashboard = ESTADO.dataInicioDashboard;
  }
}

function dataMovimento(movimento) {
  const informada = String(movimento?.data || "");
  if (dataValida(informada)) return informada;

  const criada = movimento?.criadoEm?.toDate?.();
  if (!criada) return "";

  return `${criada.getFullYear()}-${String(criada.getMonth() + 1).padStart(2, "0")}-${String(criada.getDate()).padStart(2, "0")}`;
}

function noPeriodo(movimento) {
  const data = dataMovimento(movimento);
  if (!data) return false;
  return data >= ESTADO.dataInicioDashboard && data <= ESTADO.dataFimDashboard;
}

function formatarDataCurta(data) {
  const m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}` : data;
}

function formatarDataCompleta(data) {
  const m = String(data).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : data;
}

function criarEstilos() {
  if ($("comercialDashboardPeriodoEstilos")) return;

  const style = document.createElement("style");
  style.id = "comercialDashboardPeriodoEstilos";
  style.textContent = `
    #${ID_AREA}{
      display:grid;
      grid-template-columns:repeat(2,minmax(155px,1fr));
      gap:9px;
      width:min(100%,430px);
    }
    #${ID_AREA} label{
      display:grid;
      gap:5px;
      color:#40536a;
      font-size:13px;
      font-weight:900;
    }
    #${ID_AREA} input{
      width:100%;
      min-height:50px;
      padding:10px 11px;
      border:1.5px solid #cbd9df;
      border-radius:14px;
      background:#fff;
      color:#172033;
      font-size:16px;
      font-weight:900;
      box-shadow:inset 0 1px 2px rgba(15,23,42,.03);
    }
    #${ID_AREA} input:focus{
      outline:none;
      border-color:#0d9488;
      box-shadow:0 0 0 4px rgba(13,148,136,.12);
    }
    .comercial-periodo-resumo{
      grid-column:1/-1;
      color:#607086;
      font-size:13px;
      line-height:1.2;
      font-weight:800;
      text-align:right;
    }
    @media(max-width:760px){
      #${ID_AREA}{width:100%;grid-template-columns:1fr 1fr}
      #${ID_AREA} input{min-height:52px;font-size:15px;padding:9px}
      .comercial-periodo-resumo{text-align:left}
    }
  `;
  document.head.appendChild(style);
}

function atualizarResumoPeriodo() {
  const resumo = document.querySelector(`#${ID_AREA} .comercial-periodo-resumo`);
  if (!resumo) return;

  resumo.textContent = ESTADO.dataInicioDashboard === ESTADO.dataFimDashboard
    ? `Dia: ${formatarDataCompleta(ESTADO.dataInicioDashboard)}`
    : `Período: ${formatarDataCompleta(ESTADO.dataInicioDashboard)} a ${formatarDataCompleta(ESTADO.dataFimDashboard)}`;
}

function montarFiltro() {
  garantirPeriodo();
  criarEstilos();

  let area = $(ID_AREA);
  if (!area) {
    const selectAntigo = $("periodoDashboard");
    if (!selectAntigo) return false;

    area = document.createElement("div");
    area.id = ID_AREA;
    area.innerHTML = `
      <label>De
        <input id="${ID_INICIO}" type="date" aria-label="Data inicial do Dashboard">
      </label>
      <label>Até
        <input id="${ID_FIM}" type="date" aria-label="Data final do Dashboard">
      </label>
      <div class="comercial-periodo-resumo" aria-live="polite"></div>
    `;
    selectAntigo.replaceWith(area);
  }

  const inicio = $(ID_INICIO);
  const fim = $(ID_FIM);
  if (!inicio || !fim) return false;

  inicio.value = ESTADO.dataInicioDashboard;
  fim.value = ESTADO.dataFimDashboard;
  atualizarResumoPeriodo();
  return true;
}

function atualizarPeriodo(alterado) {
  const inicio = $(ID_INICIO);
  const fim = $(ID_FIM);
  if (!inicio || !fim || !dataValida(inicio.value) || !dataValida(fim.value)) return;

  let dataInicio = inicio.value;
  let dataFim = fim.value;

  if (dataInicio > dataFim) {
    if (alterado === "inicio") {
      dataFim = dataInicio;
      fim.value = dataFim;
    } else {
      dataInicio = dataFim;
      inicio.value = dataInicio;
    }
  }

  ESTADO.dataInicioDashboard = dataInicio;
  ESTADO.dataFimDashboard = dataFim;
  atualizarResumoPeriodo();
  renderDashboardPorDatas();
}

function dadosGrafico(movimentos) {
  const grupos = new Map();

  movimentos.forEach((m) => {
    const chave = dataMovimento(m);
    if (!chave) return;
    if (!grupos.has(chave)) {
      grupos.set(chave, { chave, faturamento: 0, custo: 0, despesas: 0 });
    }

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
      rotulo: formatarDataCurta(g.chave)
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
    return `<div class="comercial-grafico-vazio">Ainda não há vendas ou despesas nas datas selecionadas.</div>`;
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
      <svg viewBox="0 0 ${largura} ${altura}" role="img" aria-label="Gráfico diário de faturamento, despesas e resultado">
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

export function renderDashboardPorDatas() {
  garantirPeriodo();
  if (!$(ID_AREA)) montarFiltro();

  const movs = ESTADO.movimentos.filter(noPeriodo);
  const vendas = movs.filter((m) => m.tipo === "venda");
  const despesas = movs.filter((m) => m.tipo === "despesa");
  const receita = vendas.reduce((s, m) => s + moeda(m.receita), 0);
  const custo = vendas.reduce((s, m) => s + moeda(m.custoTotal), 0);
  const lucro = moeda(receita - custo);
  const desp = despesas.reduce((s, m) => s + moeda(m.valor), 0);
  const resultado = moeda(lucro - desp);
  const margem = receita > 0 ? (lucro / receita) * 100 : 0;

  if ($("kpiReceita")) $("kpiReceita").textContent = fmtMoeda(receita);
  if ($("kpiCusto")) $("kpiCusto").textContent = fmtMoeda(custo);
  if ($("kpiLucro")) $("kpiLucro").textContent = fmtMoeda(lucro);
  if ($("kpiDespesas")) $("kpiDespesas").textContent = fmtMoeda(desp);
  if ($("kpiResultado")) $("kpiResultado").textContent = fmtMoeda(resultado);
  if ($("kpiMargem")) $("kpiMargem").textContent = `${margem.toFixed(1)}%`;
  $("cardResultado")?.classList.toggle("neg", resultado < 0);

  const grafico = $("dashboardProdutos");
  if (grafico) {
    const titulo = grafico.closest(".card")?.querySelector("h2");
    if (titulo) titulo.textContent = "Evolução do negócio";
    grafico.classList.remove("list");
    grafico.classList.add("comercial-dashboard-grafico");
    grafico.innerHTML = htmlGrafico(dadosGrafico(movs));
  }
}

export function configurarFiltroDashboardDatas() {
  if (!montarFiltro()) return;

  const inicio = $(ID_INICIO);
  const fim = $(ID_FIM);
  if (inicio?.dataset.periodoConfigurado === "1") return;

  inicio.dataset.periodoConfigurado = "1";
  fim.dataset.periodoConfigurado = "1";
  inicio.addEventListener("change", () => atualizarPeriodo("inicio"));
  fim.addEventListener("change", () => atualizarPeriodo("fim"));
  renderDashboardPorDatas();
}
