// ListaLar Comercial 1.3.18 — tema visual dos relatórios

const ID_ESTILO = "comercialRelatoriosTemaEstilos";

function instalarEstilos() {
  if (document.getElementById(ID_ESTILO)) return;

  const style = document.createElement("style");
  style.id = ID_ESTILO;
  style.textContent = `
    #tela-relatorios .card::before{
      background:linear-gradient(90deg,#0f766e,#14b8a6,#2563eb);
    }

    #tela-relatorios .comercial-relatorio-tipos button{
      background:#fff;
      border-color:#d6e2e7;
      color:#475569;
      box-shadow:0 2px 7px rgba(15,23,42,.035);
      transition:background .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease,transform .16s ease;
    }

    #tela-relatorios .comercial-relatorio-tipos button:active{
      transform:scale(.98);
    }

    #tela-relatorios .comercial-relatorio-tipos button[data-relatorio-tipo="venda"].active{
      border-color:#60a5fa;
      background:#eff6ff;
      color:#1d4ed8;
      box-shadow:0 5px 14px rgba(37,99,235,.12);
    }

    #tela-relatorios .comercial-relatorio-tipos button[data-relatorio-tipo="compra"].active{
      border-color:#fbbf24;
      background:#fffbeb;
      color:#92400e;
      box-shadow:0 5px 14px rgba(217,119,6,.12);
    }

    #tela-relatorios .comercial-relatorio-tipos button[data-relatorio-tipo="abc"].active{
      border-color:#2dd4bf;
      background:#ccfbf1;
      color:#115e59;
      box-shadow:0 5px 14px rgba(13,148,136,.14);
    }

    #tela-relatorios .comercial-relatorio-filtros .field label{
      color:#475569;
    }

    #tela-relatorios .comercial-relatorio-exportar{
      min-height:46px;
      padding:10px 15px;
      background:linear-gradient(135deg,#0f766e,#0d9488);
      box-shadow:0 5px 13px rgba(15,118,110,.14);
    }

    #tela-relatorios .comercial-relatorio-kpi{
      position:relative;
      overflow:hidden;
      border-left-width:5px;
      box-shadow:0 5px 15px rgba(15,23,42,.055);
    }

    #tela-relatorios[data-relatorio-visual="venda"] .comercial-relatorio-kpi:nth-child(1){
      border-color:#bfdbfe;
      border-left-color:#2563eb;
      background:linear-gradient(135deg,#eff6ff,#fff);
    }
    #tela-relatorios[data-relatorio-visual="venda"] .comercial-relatorio-kpi:nth-child(2){
      border-color:#fed7aa;
      border-left-color:#f59e0b;
      background:linear-gradient(135deg,#fff7ed,#fff);
    }
    #tela-relatorios[data-relatorio-visual="venda"] .comercial-relatorio-kpi:nth-child(3){
      border-color:#bbf7d0;
      border-left-color:#16a34a;
      background:linear-gradient(135deg,#ecfdf5,#fff);
    }

    #tela-relatorios[data-relatorio-visual="compra"] .comercial-relatorio-kpi:nth-child(1){
      border-color:#fde68a;
      border-left-color:#d97706;
      background:linear-gradient(135deg,#fffbeb,#fff);
    }
    #tela-relatorios[data-relatorio-visual="compra"] .comercial-relatorio-kpi:nth-child(2){
      border-color:#bfdbfe;
      border-left-color:#2563eb;
      background:linear-gradient(135deg,#eff6ff,#fff);
    }
    #tela-relatorios[data-relatorio-visual="compra"] .comercial-relatorio-kpi:nth-child(3){
      border-color:#ddd6fe;
      border-left-color:#7c3aed;
      background:linear-gradient(135deg,#f5f3ff,#fff);
    }

    #tela-relatorios[data-relatorio-visual="abc"] .comercial-relatorio-kpi:nth-child(1){
      border-color:#bfdbfe;
      border-left-color:#2563eb;
      background:linear-gradient(135deg,#eff6ff,#fff);
    }
    #tela-relatorios[data-relatorio-visual="abc"] .comercial-relatorio-kpi:nth-child(2){
      border-color:#ddd6fe;
      border-left-color:#7c3aed;
      background:linear-gradient(135deg,#f5f3ff,#fff);
    }
    #tela-relatorios[data-relatorio-visual="abc"] .comercial-relatorio-kpi:nth-child(3){
      border-color:#bbf7d0;
      border-left-color:#16a34a;
      background:linear-gradient(135deg,#ecfdf5,#fff);
    }

    #tela-relatorios[data-relatorio-visual="venda"] th{
      background:#eff6ff;
      color:#1e40af;
    }
    #tela-relatorios[data-relatorio-visual="compra"] th{
      background:#fffbeb;
      color:#92400e;
    }
    #tela-relatorios[data-relatorio-visual="abc"] th{
      background:#f0fdfa;
      color:#115e59;
    }

    #tela-relatorios[data-relatorio-visual="abc"] .comercial-abc-explicacao{
      border-color:#99f6e4;
      background:linear-gradient(135deg,#f0fdfa,#f8fafc);
      color:#3f5f62;
    }

    #tela-relatorios .comercial-abc-classe.a{
      border:1px solid #86efac;
      background:#dcfce7;
      color:#166534;
      box-shadow:0 2px 7px rgba(22,163,74,.10);
    }
    #tela-relatorios .comercial-abc-classe.b{
      border:1px solid #fcd34d;
      background:#fef3c7;
      color:#92400e;
      box-shadow:0 2px 7px rgba(202,138,4,.10);
    }
    #tela-relatorios .comercial-abc-classe.c{
      border:1px solid #fca5a5;
      background:#fee2e2;
      color:#991b1b;
      box-shadow:0 2px 7px rgba(220,38,38,.10);
    }

    .comercial-data-compacta-valor::after{
      content:"" !important;
      width:16px;
      height:15px;
      right:10px !important;
      border:2px solid #0d9488;
      border-radius:3px;
      box-sizing:border-box;
      background:linear-gradient(to bottom,#0d9488 0 4px,#ffffff 4px 100%);
      box-shadow:none;
    }

    @media(max-width:760px){
      #tela-relatorios .comercial-relatorio-tipos{
        gap:7px;
      }
      #tela-relatorios .comercial-relatorio-tipos button{
        min-height:40px;
        padding:8px 12px;
      }
      #tela-relatorios .comercial-relatorio-exportar{
        min-height:46px !important;
        font-size:15px !important;
      }
      #tela-relatorios .comercial-relatorio-kpi{
        padding:12px 13px;
      }
    }
  `;

  document.head.appendChild(style);
}

function tipoAtivo() {
  return document.querySelector('#tela-relatorios [data-relatorio-tipo].active')?.dataset?.relatorioTipo || "venda";
}

function aplicarTema(tipo = tipoAtivo()) {
  const tela = document.getElementById("tela-relatorios");
  if (!tela) return;
  tela.dataset.relatorioVisual = ["venda", "compra", "abc"].includes(tipo) ? tipo : "venda";
}

function iniciarTema(tentativa = 0) {
  instalarEstilos();
  const tela = document.getElementById("tela-relatorios");
  if (!tela) {
    if (tentativa < 24) setTimeout(() => iniciarTema(tentativa + 1), 250);
    return;
  }
  aplicarTema();
}

iniciarTema();

document.addEventListener("click", (evento) => {
  const botaoTipo = evento.target?.closest?.("[data-relatorio-tipo]");
  if (botaoTipo) {
    aplicarTema(botaoTipo.dataset.relatorioTipo);
    return;
  }

  if (evento.target?.closest?.('button[data-tela="relatorios"]')) {
    setTimeout(() => aplicarTema(), 0);
  }
});
