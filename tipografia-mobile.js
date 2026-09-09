// ==========================================
// ListaLar - Tipografia mobile
// Versão: 1.0.0
// Aumenta a legibilidade no celular sem alterar a estrutura do layout.
// ==========================================

const ID_ESTILO = "listalar-tipografia-mobile";

function aplicarTipografiaMobile() {
  if (document.getElementById(ID_ESTILO)) return;

  const estilo = document.createElement("style");
  estilo.id = ID_ESTILO;
  estilo.textContent = `
    @media (max-width: 768px) {
      /* Lista de compras */
      .item-name {
        font-size: 20px !important;
        line-height: 1.22 !important;
      }

      .buy-item,
      .buy-item button,
      .buy-item input,
      .buy-item select {
        font-size: 15px;
      }

      .stock-unit,
      .buy-unit,
      .item-unit,
      .unit-label {
        font-size: 13px !important;
      }

      .qty-value,
      .buy-qty,
      .item-qty,
      .quantity-value,
      .quantity-display {
        font-size: 18px !important;
        font-weight: 900 !important;
      }

      /* Resumo da lista */
      .summary .mini-card strong,
      .mini-card strong {
        font-size: 24px !important;
      }

      .summary .mini-card span,
      .mini-card span {
        font-size: 12px !important;
        line-height: 1.2 !important;
      }

      /* Campos e textos auxiliares da tela principal */
      #lista input,
      #lista select,
      #lista textarea,
      #lista button {
        font-size: 15px;
      }

      #lista label,
      #lista small,
      #lista .helper,
      #lista .hint,
      #lista .subtitle,
      #lista .subtitulo {
        font-size: 13px !important;
        line-height: 1.35 !important;
      }

      /* Estimativa da compra */
      #listalar-estimativa-lista .estimativa-titulo {
        font-size: 13px !important;
      }

      #listalar-estimativa-lista .estimativa-valor {
        font-size: 27px !important;
      }

      #listalar-estimativa-lista .estimativa-info {
        font-size: 12.5px !important;
        line-height: 1.35 !important;
      }

      /* Menu inferior */
      .bottom-nav .tab {
        font-size: 12px !important;
        line-height: 1.12 !important;
      }

      .bottom-nav .tab .ico {
        font-size: 24px !important;
      }
    }
  `;

  document.head.appendChild(estilo);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", aplicarTipografiaMobile, { once: true });
} else {
  aplicarTipografiaMobile();
}
