// ListaLar Comercial 1.3.8 — refinamento visual e exclusão segura de Produtos
import { updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  ESTADO, produtoPorId, produtoRef, quantidade, fmtNumero, toast
} from "./comercial-contexto.js?v=1.2.0";

const EXCLUINDO = new Set();

function criarBotaoExcluir(id) {
  const botao = document.createElement("button");
  botao.className = "comercial-btn-excluir";
  botao.type = "button";
  botao.dataset.excluirProduto = id;
  botao.title = "Excluir produto";
  botao.setAttribute("aria-label", "Excluir produto");
  botao.textContent = "🗑️";
  return botao;
}

function produtosAtivos() {
  return ESTADO.produtos.filter((p) => p.ativo !== false);
}

function limparProdutosInativosDaTela() {
  const ativos = produtosAtivos();
  const idsAtivos = new Set(ativos.map((p) => String(p.id)));
  const nomesAtivos = new Set(ativos.map((p) => String(p.nome || "")));

  const listaProdutos = document.getElementById("listaProdutos");
  listaProdutos?.querySelectorAll(":scope > .item").forEach((item) => {
    const id = String(item.querySelector("[data-editar-produto]")?.dataset?.editarProduto || "");
    if (id && !idsAtivos.has(id)) item.remove();
  });

  const listaEstoque = document.getElementById("listaEstoque");
  listaEstoque?.querySelectorAll(".comercial-estoque-card").forEach((card) => {
    const nome = String(card.querySelector(".comercial-estoque-produto")?.textContent || "");
    if (nome && !nomesAtivos.has(nome)) card.remove();
  });

  if (!ativos.length) {
    if (listaProdutos) listaProdutos.innerHTML = `<div class="empty">Nenhum produto comercial cadastrado.</div>`;
    if (listaEstoque) listaEstoque.innerHTML = `<div class="empty">Nenhum produto comercial cadastrado.</div>`;
  }
}

export function garantirAcoesProdutos() {
  limparProdutosInativosDaTela();

  document.querySelectorAll("#listaProdutos > .item").forEach((item) => {
    const editar = item.querySelector("[data-editar-produto]");
    const id = String(editar?.dataset?.editarProduto || "");
    if (!id || item.querySelector("[data-excluir-produto]")) return;

    const acoes = item.querySelector(".comercial-produto-acoes");
    if (!acoes) return;
    acoes.appendChild(criarBotaoExcluir(id));
  });
}

async function excluirProduto(botao) {
  const id = String(botao?.dataset?.excluirProduto || "");
  const produto = produtoPorId(id);
  if (!produto || produto.ativo === false || EXCLUINDO.has(id)) return;

  const saldo = quantidade(produto.estoque);
  if (saldo > 0) {
    toast(`Zere o estoque antes de excluir. Saldo atual: ${fmtNumero(saldo)}.`, "erro");
    return;
  }

  const confirmado = window.confirm(
    `Excluir “${produto.nome}”?\n\nO produto sairá de Produtos, Compras, Vendas e Estoque. O histórico será preservado.`
  );
  if (!confirmado) return;

  EXCLUINDO.add(id);
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");

  try {
    await updateDoc(produtoRef(id), {
      ativo: false,
      excluidoPor: ESTADO.usuario?.uid || "",
      excluidoEm: serverTimestamp(),
      atualizadoPor: ESTADO.usuario?.uid || "",
      atualizadoEm: serverTimestamp()
    });
    toast("Produto excluído. Histórico preservado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível excluir o produto.", "erro");
    botao.disabled = false;
    botao.removeAttribute("aria-busy");
  } finally {
    EXCLUINDO.delete(id);
  }
}

function instalarProdutosUi() {
  if (document.getElementById("comercialProdutosUiEstilos")) return;

  const estilo = document.createElement("style");
  estilo.id = "comercialProdutosUiEstilos";
  estilo.textContent = `
    #tela-produtos>.card>h2{
      font-size:30px!important;
      line-height:1.08!important;
    }

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
      font-size:17px!important;
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
      grid-template-columns:minmax(0,1fr) 136px!important;
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
      align-self:start;
      min-width:0;
      max-width:100%;
      padding-top:5px;
      color:#142033!important;
      font-size:24px!important;
      line-height:1.14!important;
      font-weight:950!important;
      overflow-wrap:anywhere;
      word-break:break-word;
    }
    #listaProdutos .comercial-produto-acoes{
      grid-area:acao;
      align-self:start;
      justify-self:end;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:7px!important;
      width:136px;
      margin:0!important;
    }
    #listaProdutos .comercial-produto-acoes .comercial-btn-editar{
      width:84px!important;
      min-height:44px!important;
      padding:9px 10px!important;
      border:1px solid #cbd5e1!important;
      border-radius:12px!important;
      background:#eef3f7!important;
      color:#31465d!important;
      font-size:15px!important;
      font-weight:900!important;
      box-shadow:none!important;
    }
    #listaProdutos .comercial-btn-excluir{
      flex:0 0 44px;
      width:44px;
      height:44px;
      padding:0;
      border:1px solid #fecaca;
      border-radius:12px;
      background:#fff1f2;
      color:#b91c1c;
      font-size:19px;
      line-height:1;
      cursor:pointer;
      box-shadow:none;
    }
    #listaProdutos .comercial-btn-excluir:disabled{opacity:.55;cursor:wait}
    #listaProdutos .comercial-produto-meta{
      grid-area:meta;
      display:flex!important;
      align-items:center!important;
      gap:7px!important;
      flex-wrap:wrap!important;
      margin:0!important;
      color:#53677d!important;
      font-size:15px!important;
      font-weight:850!important;
    }
    #listaProdutos .comercial-produto-meta>span[aria-hidden="true"]{
      display:none!important;
    }
    #listaProdutos .comercial-produto-meta>span:not([aria-hidden="true"]){
      display:inline-flex!important;
      align-items:center!important;
      min-height:32px!important;
      padding:6px 10px!important;
      border:1px solid #dbe7ea!important;
      border-radius:999px!important;
      background:#f8fbfc!important;
    }
    #listaProdutos .comercial-produto-meta>span:first-child{
      display:none!important;
    }
    #listaProdutos .values{
      grid-area:valores;
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:8px!important;
      margin-top:1px!important;
    }
    #listaProdutos .value{
      min-height:80px!important;
      display:flex!important;
      flex-direction:column!important;
      justify-content:center!important;
      padding:10px 11px!important;
      border-width:1.5px!important;
      border-radius:13px!important;
      box-shadow:0 3px 10px rgba(15,23,42,.035)!important;
    }
    #listaProdutos .value span{
      font-size:15px!important;
      line-height:1.12!important;
      font-weight:900!important;
    }
    #listaProdutos .value strong{
      margin-top:5px!important;
      font-size:20px!important;
      line-height:1.05!important;
      font-weight:950!important;
      color:#172033!important;
    }
    #listaProdutos .value:nth-child(1){background:#f8fafc!important;border-color:#dbe4ea!important}
    #listaProdutos .value:nth-child(2){background:#f0fdfa!important;border-color:#bceee7!important}
    #listaProdutos .value:nth-child(3){background:#f0fdf4!important;border-color:#bbf7d0!important}
    #listaProdutos .value:nth-child(4){background:#f5f3ff!important;border-color:#ddd6fe!important}

    @media(max-width:520px){
      #tela-produtos>.card>h2{font-size:28px!important}
      #formProduto{gap:11px!important}
      #formProduto>.field label{font-size:16px!important}
      #listaProdutos>.item{
        grid-template-columns:minmax(0,1fr) 128px!important;
        padding:13px!important;
        gap:9px 10px!important;
      }
      #listaProdutos .comercial-produto-descricao{
        font-size:23px!important;
        line-height:1.15!important;
        padding-top:4px;
      }
      #listaProdutos .comercial-produto-acoes{width:128px;gap:6px!important}
      #listaProdutos .comercial-produto-acoes .comercial-btn-editar{
        width:78px!important;
        padding:9px 8px!important;
        font-size:14px!important;
      }
      #listaProdutos .comercial-btn-excluir{flex-basis:44px;width:44px;height:44px}
      #listaProdutos .comercial-produto-meta{font-size:14px!important}
      #listaProdutos .comercial-produto-meta>span:not([aria-hidden="true"]){padding:5px 9px!important;min-height:30px!important}
      #listaProdutos .values{gap:7px!important}
      #listaProdutos .value{min-height:76px!important;padding:9px!important}
      #listaProdutos .value span{font-size:14px!important}
      #listaProdutos .value strong{font-size:19px!important}
    }
  `;
  document.head.appendChild(estilo);

  const custo = document.getElementById("produtoCusto")?.closest(".field")?.querySelector("label");
  if (custo) custo.textContent = "Custo unitário";

  document.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-excluir-produto]");
    if (!botao) return;
    evento.preventDefault();
    evento.stopPropagation();
    excluirProduto(botao);
  });

  garantirAcoesProdutos();
}

instalarProdutosUi();
console.log("✅ Comercial 1.3.8: Produtos com lixeira segura e histórico preservado");
