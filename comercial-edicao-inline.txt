// ============================================================
// ListaLar Comercial — edição de produto em modal compacto
// Arquivo: comercial-edicao-inline.js
// Versão: 1.3.0
// ============================================================

import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  db, ESTADO, refs, produtoRef, produtoPorId,
  normalizarTexto, numeroDigitado, moeda, quantidade,
  hoje, toast, escapar
} from "./comercial-contexto.js?v=1.2.0";

const UNIDADES = ["UN", "PCT", "CX", "KG", "G", "L", "ML"];

const EDICAO = {
  produtoId: "",
  salvando: false,
  overflowAnterior: ""
};

function unidadeProduto(produto) {
  const unidade = String(produto?.unidade || "UN").trim().toUpperCase();
  return UNIDADES.includes(unidade) ? unidade : "UN";
}

function criarEstilos() {
  if (document.getElementById("comercialEdicaoModalEstilos")) return;

  const style = document.createElement("style");
  style.id = "comercialEdicaoModalEstilos";
  style.textContent = `
    body .comercial-btn-editar{
      min-height:44px!important;
      padding:9px 14px!important;
      border-radius:12px!important;
      font-size:14px!important;
      line-height:1!important;
      font-weight:900!important;
    }

    .comercial-produto-descricao{
      display:block;
      width:100%;
      white-space:pre-wrap;
      overflow-wrap:anywhere;
      font-size:21px;
      line-height:1.18;
      font-weight:900;
      color:#152239;
    }
    .comercial-produto-meta{
      display:flex;
      align-items:center;
      gap:8px;
      flex-wrap:wrap;
      margin-top:6px;
      color:#607086;
      font-size:14px;
      font-weight:850;
      line-height:1.25;
    }
    .comercial-produto-meta b{color:#334155}
    .comercial-produto-acoes{
      display:flex;
      align-items:center;
      gap:8px;
      margin-top:8px;
    }

    .comercial-modal-bg{
      position:fixed;
      inset:0;
      z-index:10000;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:18px;
      background:rgba(15,23,42,.58);
      backdrop-filter:blur(4px);
    }
    .comercial-modal-box{
      width:min(100%,520px);
      max-height:calc(100dvh - 36px);
      overflow:auto;
      padding:20px;
      border:1px solid rgba(15,118,110,.18);
      border-radius:22px;
      background:#fff;
      color:#172033;
      box-shadow:0 24px 70px rgba(15,23,42,.30);
    }
    .comercial-modal-box h2{
      margin:0 0 18px;
      font-size:27px;
      line-height:1.1;
      color:#152239;
    }
    .comercial-modal-campo{
      display:grid;
      gap:6px;
      min-width:0;
    }
    .comercial-modal-campo>label{
      color:#40536a;
      font-size:15px;
      line-height:1.15;
      font-weight:900;
    }
    .comercial-modal-campo textarea,
    .comercial-modal-campo input,
    .comercial-modal-campo select{
      width:100%;
      min-width:0;
      min-height:48px;
      padding:10px 12px;
      border:1.5px solid #cbd9df;
      border-radius:13px;
      outline:none;
      background:#fff;
      color:#172033;
      font:inherit;
      font-size:18px;
      font-weight:800;
    }
    .comercial-modal-campo textarea{
      min-height:76px;
      max-height:220px;
      resize:none;
      overflow-y:auto;
      line-height:1.35;
      white-space:pre-wrap;
    }
    .comercial-modal-campo textarea:focus,
    .comercial-modal-campo input:focus,
    .comercial-modal-campo select:focus{
      border-color:#0d9488;
      box-shadow:0 0 0 4px rgba(13,148,136,.12);
    }
    .comercial-modal-descricao{margin-bottom:15px}
    .comercial-modal-linha{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-bottom:15px;
    }
    .comercial-modal-acoes{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
      margin-top:4px;
    }
    .comercial-modal-acoes button{
      min-height:50px;
      border:0;
      border-radius:14px;
      padding:10px 12px;
      font:inherit;
      font-size:16px;
      font-weight:900;
      cursor:pointer;
    }
    .comercial-modal-cancelar{background:#e8eef3;color:#334155}
    .comercial-modal-salvar{
      background:linear-gradient(135deg,#0f766e,#0d9488);
      color:#fff;
      box-shadow:0 7px 16px rgba(13,148,136,.20);
    }
    .comercial-modal-acoes button:disabled{opacity:.6;cursor:wait}

    @media(max-width:520px){
      .comercial-modal-bg{padding:12px;align-items:center}
      .comercial-modal-box{padding:17px 15px;border-radius:20px}
      .comercial-modal-box h2{font-size:25px;margin-bottom:16px}
      .comercial-modal-linha{gap:10px;margin-bottom:13px}
      .comercial-modal-campo>label{font-size:14px}
      .comercial-modal-campo textarea,
      .comercial-modal-campo input,
      .comercial-modal-campo select{font-size:17px;min-height:46px;padding:9px 10px}
      .comercial-modal-campo textarea{min-height:72px}
      .comercial-modal-acoes{gap:10px}
      .comercial-modal-acoes button{min-height:48px;font-size:15px}
    }
  `;
  document.head.appendChild(style);
}

function numeroParaInput(valor, casas) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "0";
  const fator = 10 ** casas;
  return String(Math.round((n + Number.EPSILON) * fator) / fator);
}

function tratarVirgula(campo, evento) {
  if (!campo || evento.defaultPrevented) return;
  if (evento.key !== "," && evento.data !== ",") return;

  evento.preventDefault();
  const atual = String(campo.value || "");
  if (atual.includes(".")) return;
  campo.value = atual ? `${atual}.` : "0.";
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}

function configurarCampoDecimal(campo, { min = 0, step = 0.01, casas = 2 } = {}) {
  if (!(campo instanceof HTMLInputElement)) return;
  campo.type = "number";
  campo.inputMode = "decimal";
  campo.lang = "pt-BR";
  campo.min = String(min);
  campo.step = String(step);
  campo.autocomplete = "off";

  campo.addEventListener("keydown", (evento) => tratarVirgula(campo, evento));
  campo.addEventListener("beforeinput", (evento) => tratarVirgula(campo, evento));
  campo.addEventListener("blur", () => {
    const valor = campo.valueAsNumber;
    if (!Number.isFinite(valor)) return;
    const fator = 10 ** casas;
    campo.value = String(Math.round((valor + Number.EPSILON) * fator) / fator);
  });
}

function ajustarTextarea(campo) {
  if (!(campo instanceof HTMLTextAreaElement)) return;
  campo.style.height = "auto";
  campo.style.height = `${Math.min(Math.max(campo.scrollHeight, 72), 220)}px`;
}

function fecharModal() {
  document.getElementById("comercialModalEditarProduto")?.remove();
  document.body.style.overflow = EDICAO.overflowAnterior;
  EDICAO.produtoId = "";
  EDICAO.salvando = false;
}

function opcoesUnidade(selecionada) {
  return UNIDADES.map((unidade) => (
    `<option value="${unidade}"${unidade === selecionada ? " selected" : ""}>${unidade}</option>`
  )).join("");
}

function abrirModalEdicao(botao) {
  const id = String(botao?.dataset?.editarProduto || "");
  const produto = produtoPorId(id);
  if (!produto) return;

  fecharModal();
  EDICAO.produtoId = id;
  EDICAO.overflowAnterior = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const unidade = unidadeProduto(produto);
  const modal = document.createElement("div");
  modal.id = "comercialModalEditarProduto";
  modal.className = "comercial-modal-bg";
  modal.innerHTML = `
    <section class="comercial-modal-box" role="dialog" aria-modal="true" aria-labelledby="comercialModalEditarTitulo">
      <h2 id="comercialModalEditarTitulo">Editar produto</h2>

      <div class="comercial-modal-campo comercial-modal-descricao">
        <label for="comercialEditarDescricao">Descrição</label>
        <textarea id="comercialEditarDescricao" data-modal-descricao rows="2" aria-label="Descrição livre do produto">${escapar(produto.nome || "")}</textarea>
      </div>

      <div class="comercial-modal-linha">
        <div class="comercial-modal-campo">
          <label for="comercialEditarUnidade">Unidade</label>
          <select id="comercialEditarUnidade" data-modal-unidade>${opcoesUnidade(unidade)}</select>
        </div>
        <div class="comercial-modal-campo">
          <label for="comercialEditarEstoque">Estoque atual</label>
          <input id="comercialEditarEstoque" data-modal-estoque type="number" inputmode="decimal" lang="pt-BR" min="0" step="0.001" value="${numeroParaInput(quantidade(produto.estoque), 3)}">
        </div>
      </div>

      <div class="comercial-modal-linha">
        <div class="comercial-modal-campo">
          <label for="comercialEditarCusto">Custo médio</label>
          <input id="comercialEditarCusto" data-modal-custo type="number" inputmode="decimal" lang="pt-BR" min="0" step="0.01" value="${numeroParaInput(moeda(produto.custoMedio), 2)}">
        </div>
        <div class="comercial-modal-campo">
          <label for="comercialEditarVenda">Preço de venda</label>
          <input id="comercialEditarVenda" data-modal-venda type="number" inputmode="decimal" lang="pt-BR" min="0" step="0.01" value="${numeroParaInput(moeda(produto.precoVenda), 2)}">
        </div>
      </div>

      <div class="comercial-modal-acoes">
        <button class="comercial-modal-cancelar" type="button" data-modal-cancelar>Cancelar</button>
        <button class="comercial-modal-salvar" type="button" data-modal-salvar>Salvar</button>
      </div>
    </section>
  `;

  document.body.appendChild(modal);

  const descricao = modal.querySelector("[data-modal-descricao]");
  ajustarTextarea(descricao);
  descricao?.addEventListener("input", () => ajustarTextarea(descricao));
  configurarCampoDecimal(modal.querySelector("[data-modal-custo]"), { min: 0, step: 0.01, casas: 2 });
  configurarCampoDecimal(modal.querySelector("[data-modal-venda]"), { min: 0, step: 0.01, casas: 2 });
  configurarCampoDecimal(modal.querySelector("[data-modal-estoque]"), { min: 0, step: 0.001, casas: 3 });
  descricao?.focus();
}

async function salvarModal() {
  const modal = document.getElementById("comercialModalEditarProduto");
  if (EDICAO.salvando || !modal || !EDICAO.produtoId) return;

  const atual = produtoPorId(EDICAO.produtoId);
  if (!atual) {
    fecharModal();
    return toast("Produto não encontrado.", "erro");
  }

  const nome = String(modal.querySelector("[data-modal-descricao]")?.value || "").trim();
  const unidade = String(modal.querySelector("[data-modal-unidade]")?.value || "UN").trim().toUpperCase();
  const custo = numeroDigitado(modal.querySelector("[data-modal-custo]")?.value);
  const precoVenda = numeroDigitado(modal.querySelector("[data-modal-venda]")?.value);
  const estoqueAtual = numeroDigitado(modal.querySelector("[data-modal-estoque]")?.value);

  if (!nome) return toast("Informe a descrição do produto.", "erro");
  if (!UNIDADES.includes(unidade)) return toast("Selecione uma unidade válida.", "erro");
  if (![custo, precoVenda, estoqueAtual].every(Number.isFinite)) {
    return toast("Preencha custo, preço e estoque com números válidos.", "erro");
  }
  if (custo < 0 || precoVenda < 0 || estoqueAtual < 0) {
    return toast("Valores não podem ser negativos.", "erro");
  }
  if (ESTADO.produtos.some((p) => p.id !== EDICAO.produtoId && normalizarTexto(p.nome) === normalizarTexto(nome))) {
    return toast("Já existe outro produto comercial com essa descrição.", "erro");
  }

  EDICAO.salvando = true;
  const botaoSalvar = modal.querySelector("[data-modal-salvar]");
  if (botaoSalvar) {
    botaoSalvar.disabled = true;
    botaoSalvar.textContent = "Salvando...";
  }

  try {
    const pRef = produtoRef(EDICAO.produtoId);
    const ajusteNecessario = quantidade(atual.estoque) !== quantidade(estoqueAtual)
      || moeda(atual.custoMedio) !== moeda(custo);
    const ajusteRef = ajusteNecessario ? doc(refs().movimentos) : null;

    await runTransaction(db, async (tx) => {
      const snap = await tx.get(pRef);
      if (!snap.exists()) throw new Error("Produto não encontrado.");
      const salvo = snap.data();

      tx.update(pRef, {
        nome,
        unidade,
        custoMedio: moeda(custo),
        precoVenda: moeda(precoVenda),
        estoque: quantidade(estoqueAtual),
        atualizadoPor: ESTADO.usuario.uid,
        atualizadoEm: serverTimestamp()
      });

      if (ajusteRef) {
        tx.set(ajusteRef, {
          tipo: "ajuste",
          produtoId: EDICAO.produtoId,
          produtoNome: nome,
          unidade,
          descricao: "Correção manual do cadastro",
          estoqueAnterior: quantidade(salvo.estoque),
          estoqueNovo: quantidade(estoqueAtual),
          custoAnterior: moeda(salvo.custoMedio),
          custoNovo: moeda(custo),
          data: hoje(),
          origem: "correcao-cadastro",
          criadoPor: ESTADO.usuario.uid,
          criadoEm: serverTimestamp()
        });
      }
    });

    fecharModal();
    toast(ajusteNecessario ? "Produto atualizado e ajuste registrado no Histórico." : "Produto atualizado.", "ok");
  } catch (erro) {
    console.error(erro);
    EDICAO.salvando = false;
    if (botaoSalvar) {
      botaoSalvar.disabled = false;
      botaoSalvar.textContent = "Salvar";
    }
    toast(erro?.message || "Não foi possível atualizar o produto.", "erro");
  }
}

function instalar() {
  criarEstilos();

  document.addEventListener("click", (evento) => {
    const editar = evento.target.closest("[data-editar-produto]");
    if (editar) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      abrirModalEdicao(editar);
      return;
    }

    if (evento.target.closest("[data-modal-cancelar]")) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      fecharModal();
      return;
    }

    if (evento.target.closest("[data-modal-salvar]")) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      salvarModal();
      return;
    }

    const fundo = evento.target.closest(".comercial-modal-bg");
    if (fundo && evento.target === fundo) {
      evento.preventDefault();
      fecharModal();
    }
  }, true);

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape" && document.getElementById("comercialModalEditarProduto")) {
      evento.preventDefault();
      fecharModal();
    }
  });
}

instalar();
console.log("✅ Comercial 1.3.0: edição de produto em modal compacto com descrição livre e unidade");
