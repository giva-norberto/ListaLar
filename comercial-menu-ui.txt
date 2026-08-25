// ListaLar Comercial 1.3.14 — estabilidade e responsividade geral no mobile

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
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }

      #periodoDashboardDatas label {
        min-width: 0 !important;
        width: 100% !important;
      }

      #periodoDashboardDatas input[type="date"] {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
        min-height: 46px !important;
        padding: 9px 11px !important;
        font-size: 16px !important;
        text-align: left !important;
      }

      #periodoDashboardDatas input[type="date"]::-webkit-date-and-time-value,
      #tela-relatorios input[type="date"]::-webkit-date-and-time-value {
        text-align: left;
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

      #tela-relatorios input[type="date"] {
        width: 100% !important;
        min-width: 0 !important;
        max-width: 100% !important;
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

configurarMenuResponsivo();
