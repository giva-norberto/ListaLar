// ListaLar Comercial 1.3.12 — ajustes visuais do Dashboard

function ocultarCustoVendido() {
  const campo = document.getElementById("kpiCusto");
  const card = campo?.closest(".kpi");
  if (!card) return;

  card.hidden = true;
  card.setAttribute("aria-hidden", "true");
}

function configurarCustoLiquido() {
  const campo = document.getElementById("kpiDespesas");
  const card = campo?.closest(".kpi");
  const rotulo = card?.querySelector("span");
  if (!campo || !card || !rotulo) return;

  rotulo.textContent = "Custo líquido";
  card.title = "Compras de produtos + despesas no período";
  card.setAttribute("aria-label", "Custo líquido: compras de produtos mais despesas do período");
}

export function configurarDashboardUi() {
  ocultarCustoVendido();
  configurarCustoLiquido();
}

configurarDashboardUi();
