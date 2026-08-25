// ListaLar Comercial 1.3.5 — ajustes visuais do Dashboard

function ocultarCustoVendido() {
  const campo = document.getElementById("kpiCusto");
  const card = campo?.closest(".kpi");
  if (!card) return;

  card.hidden = true;
  card.setAttribute("aria-hidden", "true");
}

export function configurarDashboardUi() {
  ocultarCustoVendido();
}

configurarDashboardUi();
