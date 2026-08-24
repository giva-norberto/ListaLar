// ListaLar Comercial — compactação visual dos cards
// Versão: 1.2.4

(() => {
  'use strict';

  if (document.getElementById('comercialCompactoEstilos')) return;

  const estilo = document.createElement('style');
  estilo.id = 'comercialCompactoEstilos';
  estilo.textContent = `
    /* Mantém a identidade visual nova, reduzindo somente a altura dos blocos. */
    .card{
      padding:13px 14px!important;
      margin-bottom:11px!important;
      border-radius:20px!important;
    }
    .card h2{margin-bottom:9px!important}

    .list{gap:8px!important}
    .item{
      padding:11px!important;
      border-radius:15px!important;
    }
    .item-top{gap:8px!important}
    .item-title{line-height:1.08!important}
    .meta{
      margin-top:5px!important;
      line-height:1.35!important;
    }

    .values{
      gap:6px!important;
      margin-top:8px!important;
    }
    .value{
      padding:7px 8px!important;
      border-radius:10px!important;
    }
    .value span{
      font-size:13px!important;
      line-height:1.1!important;
    }
    .value strong{
      margin-top:3px!important;
      font-size:17px!important;
      line-height:1.08!important;
    }

    .badge{
      padding:6px 9px!important;
      line-height:1!important;
    }

    .kpis{
      gap:8px!important;
      margin-bottom:11px!important;
    }
    .kpi{
      padding:11px 12px!important;
      border-radius:16px!important;
    }
    .kpi span{
      margin-bottom:5px!important;
      line-height:1.1!important;
    }
    .kpi strong{
      font-size:22px!important;
      line-height:1!important;
    }

    .period{margin-bottom:10px!important}

    @media (max-width:760px){
      .shell{padding-top:10px!important}
      .card{
        padding:12px 13px!important;
        margin-bottom:10px!important;
      }
      .card h2{
        font-size:26px!important;
        margin-bottom:8px!important;
      }
      .item{padding:10px!important}
      .item-title{font-size:21px!important}
      .values{
        gap:6px!important;
        margin-top:7px!important;
      }
      .value{padding:7px!important}
      .kpi{padding:10px 11px!important}
      .kpi span{font-size:14px!important}
      .kpi strong{font-size:22px!important}

      /* Editar continua confortável para toque, sem ocupar altura desnecessária. */
      body .comercial-btn-editar{
        min-height:44px!important;
        padding:9px 12px!important;
        font-size:14px!important;
      }
    }
  `;

  document.head.appendChild(estilo);
})();
