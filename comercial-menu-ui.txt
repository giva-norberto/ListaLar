// ListaLar Comercial 1.3.13 — ajuste responsivo do menu principal

function configurarMenuResponsivo() {
  if (document.getElementById("comercialMenuResponsivoEstilos")) return;

  const style = document.createElement("style");
  style.id = "comercialMenuResponsivoEstilos";
  style.textContent = `
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
      }
      .nav button[data-tela] {
        flex: 0 0 auto !important;
      }
    }
  `;

  document.head.appendChild(style);
}

configurarMenuResponsivo();
