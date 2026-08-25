// ListaLar Comercial 1.3.6 — organização visual de Produtos

function instalarProdutosUi() {
  if (document.getElementById("comercialProdutosUiEstilos")) return;

  const estilo = document.createElement("style");
  estilo.id = "comercialProdutosUiEstilos";
  estilo.textContent = `
    #formProduto{
      grid-template-columns:1fr 1fr!important;
      gap:12px!important;
      align-items:end!important;
    }
    #formProduto>.wide,
    #formProduto>.form-actions{
      grid-column:1/-1!important;
    }
    #formProduto>.field label{
      min-height:22px;
      display:flex;
      align-items:flex-end;
    }
    #formProduto>.form-actions{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:10px!important;
      margin-top:2px!important;
    }
    #formProduto>.form-actions .btn:only-child{
      grid-column:1/-1!important;
    }
    #formProduto #btnSalvarProduto{
      width:100%!important;
      min-height:54px!important;
    }

    #listaProdutos>.item{
      display:grid!important;
      grid-template-columns:minmax(0,1fr) auto!important;
      grid-template-areas:"titulo acao" "meta meta" "valores valores"!important;
      gap:10px 12px!important;
      padding:14px!important;
      border:1.5px solid #cfe7e4!important;
      border-left:6px solid #0d9488!important;
      border-radius:18px!important;
      background:linear-gradient(135deg,#f3fffc 0%,#ffffff 58%,#f8fafc 100%)!important;
      box-shadow:0 8px 20px rgba(15,118,110,.08)!important;
    }
    #listaProdutos .comercial-produto-descricao{
      grid-area:titulo;
      align-self:center;
      min-width:0;
      color:#142033!important;
      font-size:22px!important;
      line-height:1.12!important;
      font-weight:950!important;
      overflow-wrap:anywhere;
    }
    #listaProdutos .comercial-produto-acoes{
      grid-area:acao;
      align-self:start;
      justify-self:end;
      margin:0!important;
    }
    #listaProdutos .comercial-produto-acoes .comercial-btn-editar{
      min-height:44px!important;
      padding:9px 13px!important;
      border:1px solid #cbd5e1!important;
      border-radius:12px!important;
      background:#eef3f7!important;
      color:#31465d!important;
      font-size:14px!important;
      box-shadow:none!important;
    }
    #listaProdutos .comercial-produto-meta{
      grid-area:meta;
      display:flex!important;
      align-items:center!important;
      gap:7px!important;
      flex-wrap:wrap!important;
      margin:0!important;
      color:#53677d!important;
      font-size:14px!important;
      font-weight:800!important;
    }
    #listaProdutos .comercial-produto-meta>span[aria-hidden="true"]{
      display:none!important;
    }
    #listaProdutos .comercial-produto-meta>span:not([aria-hidden="true"]){
      display:inline-flex!important;
      align-items:center!important;
      min-height:31px!important;
      padding:6px 9px!important;
      border:1px solid #dbe7ea!important;
      border-radius:999px!important;
      background:#f8fbfc!important;
    }
    #listaProdutos .values{
      grid-area:valores;
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:8px!important;
      margin-top:1px!important;
    }
    #listaProdutos .value{
      min-height:76px!important;
      display:flex!important;
      flex-direction:column!important;
      justify-content:center!important;
      padding:10px 11px!important;
      border-width:1.5px!important;
      border-radius:13px!important;
      box-shadow:0 3px 10px rgba(15,23,42,.035)!important;
    }
    #listaProdutos .value span{
      font-size:13px!important;
      line-height:1.1!important;
      font-weight:900!important;
    }
    #listaProdutos .value strong{
      margin-top:4px!important;
      font-size:19px!important;
      line-height:1.05!important;
      font-weight:950!important;
      color:#172033!important;
    }
    #listaProdutos .value:nth-child(1){background:#f8fafc!important;border-color:#dbe4ea!important}
    #listaProdutos .value:nth-child(2){background:#f0fdfa!important;border-color:#bceee7!important}
    #listaProdutos .value:nth-child(3){background:#f0fdf4!important;border-color:#bbf7d0!important}
    #listaProdutos .value:nth-child(4){background:#f5f3ff!important;border-color:#ddd6fe!important}

    @media(max-width:520px){
      #formProduto{gap:11px!important}
      #listaProdutos>.item{padding:13px!important;gap:9px 10px!important}
      #listaProdutos .comercial-produto-descricao{font-size:21px!important}
      #listaProdutos .comercial-produto-meta{font-size:13px!important}
      #listaProdutos .comercial-produto-meta>span:not([aria-hidden="true"]){padding:5px 8px!important;min-height:29px!important}
      #listaProdutos .values{gap:7px!important}
      #listaProdutos .value{min-height:72px!important;padding:9px!important}
      #listaProdutos .value strong{font-size:18px!important}
    }
  `;
  document.head.appendChild(estilo);

  const custo = document.getElementById("produtoCusto")?.closest(".field")?.querySelector("label");
  if (custo) custo.textContent = "Custo unitário";
}

instalarProdutosUi();
console.log("✅ Comercial 1.3.6: Produtos reorganizado visualmente");
