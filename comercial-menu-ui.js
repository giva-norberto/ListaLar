// ListaLar Comercial 1.3.15 — estabilidade mobile e datas compactas no iPhone

function configurarMenuResponsivo() {
  if (document.getElementById("comercialMenuResponsivoEstilos")) return;

  const style = document.createElement("style");
  style.id = "comercialMenuResponsivoEstilos";
  style.textContent = `
    html, body {
      max-width: 100%;
      overflow-x: hidden;
    }

    #appComercial,
    .shell,
    .screen,
    .card,
    .period,
    .kpis,
    .form,
    .list,
    .item {
      min-width: 0;
      max-width: 100%;
    }

    .screen.active {
      width: 100%;
    }

    .nav,
    .comercial-grafico-wrap,
    .comercial-relatorio-tabela-wrap {
      max-width: 100%;
      min-width: 0;
      overscroll-behavior-x: contain;
      -webkit-overflow-scrolling: touch;
    }

    input,
    select,
    textarea,
    button {
      max-width: 100%;
      min-width: 0;
    }

    @media (min-width: 900px) {
      .nav {
        gap: 5px !important;
        overflow-x: hidden !important;
      }
      .nav button[data-tela] {
        flex: 1 1 0 !important;
        min-width: 0 !important;
        padding: 11px 8px !important;
        font-size: 14px !important;
        white-space: nowrap !important;
      }
    }

    @media (max-width: 899px) {
      .nav {
        overflow-x: auto !important;
        gap: 7px !important;
        scroll-behavior: smooth;
      }
      .nav button[data-tela] {
        flex: 0 0 auto !important;
        white-space: nowrap !important;
      }
    }

    @media (max-width: 760px) {
      body {
        width: 100%;
        overscroll-behavior-x: none;
      }

      .shell {
        width: 100% !important;
        overflow-x: hidden;
      }

      .nav {
        width: 100%;
        padding: 6px !important;
      }

      .nav button[data-tela] {
        padding: 10px 12px !important;
        font-size: 14px !important;
      }

      .period,
      #periodoDashboardDatas {
        width: 100% !important;
      }

      #periodoDashboardDatas {
        grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important;
        gap: 8px !important;
      }

      #periodoDashboardDatas label {
        min-width: 0 !important;
        width: 100% !important;
        gap: 4px !important;
        font-size: 13px !important;
      }

      .comercial-data-compacta {
        position: relative;
        width: 100%;
        min-width: 0;
        min-height: 46px;
        border: 1.5px solid #cbd9df;
        border-radius: 13px;
        background: #fff;
        box-shadow: inset 0 1px 2px rgba(15,23,42,.03);
        overflow: hidden;
      }

      .comercial-data-compacta:focus-within {
        border-color: #0d9488;
        box-shadow: 0 0 0 3px rgba(13,148,136,.12);
      }

      .comercial-data-compacta-valor {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        padding: 0 36px 0 11px;
        color: #172033;
        font-size: 15px;
        line-height: 1;
        font-weight: 900;
        white-space: nowrap;
        pointer-events: none;
      }

      .comercial-data-compacta-valor::after {
        content: "📅";
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 15px;
      }

      .comercial-data-compacta input[type="date"] {
        position: absolute !important;
        inset: 0 !important;
        z-index: 2 !important;
        width: 100% !important;
        height: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        min-height: 46px !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        opacity: .01 !important;
        cursor: pointer !important;
      }

      .comercial-periodo-resumo {
        margin-top: 1px !important;
        font-size: 12px !important;
        line-height: 1.25 !important;
        text-align: left !important;
      }

      .kpis {
        width: 100%;
        grid-template-columns: minmax(0,1fr) minmax(0,1fr) !important;
        gap: 8px !important;
      }

      .kpi {
        min-width: 0 !important;
        padding: 12px !important;
      }

      .kpi span {
        font-size: 13px !important;
        line-height: 1.15 !important;
      }

      .kpi strong {
        font-size: 21px !important;
        line-height: 1.08 !important;
        overflow-wrap: anywhere;
      }

      .comercial-dashboard-grafico {
        min-width: 0 !important;
        width: 100% !important;
      }

      .comercial-grafico-legenda {
        gap: 8px !important;
        font-size: 12px !important;
      }

      .comercial-grafico-wrap {
        width: 100% !important;
        overflow-x: hidden !important;
        padding: 6px 4px 2px !important;
      }

      .comercial-grafico-wrap svg {
        display: block !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: auto !important;
      }

      #tela-relatorios,
      #tela-relatorios .card,
      #tela-relatorios .comercial-relatorio-filtros,
      #tela-relatorios .comercial-relatorio-resumo,
      #tela-relatorios .comercial-relatorio-tabela-wrap {
        min-width: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }

      #tela-relatorios .comercial-relatorio-filtros {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }

      #tela-relatorios .comercial-relatorio-exportar {
        grid-column: 1 !important;
        width: 100% !important;
      }

      #tela-relatorios .comercial-relatorio-resumo {
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }

      #tela-relatorios .comercial-relatorio-tabela-wrap {
        overflow-x: auto !important;
      }
    }
  `;

  document.head.appendChild(style);
}

function formatarDataIsoCompleta(valor) {
  const partes = String(valor || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "--/--/----";
}

function sincronizarCampoDataCompacta(input) {
  const wrapper = input?.closest?.(".comercial-data-compacta");
  const valor = wrapper?.querySelector?.(".comercial-data-compacta-valor");
  if (valor) valor.textContent = formatarDataIsoCompleta(input.value);
}

function prepararCampoDataCompacta(input) {
  if (!input || input.dataset.dataCompacta === "1") return false;

  const wrapper = document.createElement("div");
  wrapper.className = "comercial-data-compacta";

  const valor = document.createElement("span");
  valor.className = "comercial-data-compacta-valor";
  valor.setAttribute("aria-hidden", "true");

  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(valor);
  wrapper.appendChild(input);
  input.dataset.dataCompacta = "1";

  const sincronizarDepois = () => setTimeout(() => {
    document.querySelectorAll('.comercial-data-compacta input[type="date"]').forEach(sincronizarCampoDataCompacta);
  }, 0);

  input.addEventListener("change", sincronizarDepois);
  input.addEventListener("input", sincronizarDepois);
  sincronizarCampoDataCompacta(input);
  return true;
}

function configurarDatasCompactas(tentativa = 0) {
  if (!window.matchMedia("(max-width: 760px)").matches) return;

  const campos = document.querySelectorAll(
    '#periodoDashboardDatas input[type="date"], #tela-relatorios input[type="date"]'
  );

  campos.forEach(prepararCampoDataCompacta);

  const dashboardPronto = document.querySelectorAll('#periodoDashboardDatas input[type="date"]').length >= 2;
  const relatoriosPronto = document.querySelectorAll('#tela-relatorios input[type="date"]').length >= 2;
  if (tentativa < 24 && (!dashboardPronto || !relatoriosPronto)) {
    setTimeout(() => configurarDatasCompactas(tentativa + 1), 250);
  }
}

configurarMenuResponsivo();
setTimeout(() => configurarDatasCompactas(), 0);
document.addEventListener("click", (evento) => {
  if (evento.target?.closest?.('button[data-tela="relatorios"], button[data-tela="dashboard"]')) {
    setTimeout(() => configurarDatasCompactas(), 0);
  }
});
