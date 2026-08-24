// ============================================================
// ListaLar Comercial — edição compacta e inline de produtos
// Arquivo: comercial-edicao-inline.js
// Versão: 1.2.2
// ============================================================

import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  db, ESTADO, refs, produtoRef, produtoPorId,
  normalizarTexto, numeroDigitado, moeda, quantidade,
  hoje, toast, escapar
} from "./comercial-contexto.js?v=1.2.0";

const EDICAO = {
  produtoId: "",
  card: null,
  htmlOriginal: "",
  salvando: false
};

function criarEstilos() {
  if (document.getElementById("comercialEdicaoInlineEstilos")) return;

  const style = document.createElement("style");
  style.id = "comercialEdicaoInlineEstilos";
  style.textContent = `
    body .comercial-btn-editar{
      min-height:44px!important;
      padding:10px 14px!important;
      border-radius:11px!important;
      font-size:14px!important;
      line-height:1!important;
      font-weight:900!important;
    }
    .comercial-inline-edicao{display:grid;gap:12px}
    .comercial-inline-nome{width:100%;min-height:46px;padding:10px 11px;border:1px solid #94a3b8;border-radius:11px;background:#fff;color:#172033;font:inherit;font-size:16px;font-weight:800}
    .comercial-inline-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
    .comercial-inline-campo{display:grid;gap:5px;padding:10px;border:1px solid #dbe4ea;border-radius:11px;background:#fff}
    .comercial-inline-campo label{font-size:13px;color:#64748b;font-weight:900}
    .comercial-inline-campo input{width:100%;min-width:0;min-height:42px;padding:8px 9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#172033;font:inherit;font-size:16px;font-weight:800}
    .comercial-inline-acoes{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .comercial-inline-acoes .btn{min-height:44px;font-size:14px}
    @media(max-width:640px){
      .comercial-inline-grid{grid-template-columns:1fr 1fr}
      .comercial-inline-campo.estoque{grid-column:1/-1}
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

function restaurarCard() {
  if (EDICAO.card?.isConnected && EDICAO.htmlOriginal) {
    EDICAO.card.innerHTML = EDICAO.htmlOriginal;
  }
  EDICAO.produtoId = "";
  EDICAO.card = null;
  EDICAO.htmlOriginal = "";
  EDICAO.salvando = false;
}

function abrirEdicaoInline(botao) {
  const id = String(botao?.dataset?.editarProduto || "");
  const produto = produtoPorId(id);
  const card = botao?.closest(".item");
  if (!produto || !card) return;

  if (EDICAO.card && EDICAO.card !== card) restaurarCard();

  EDICAO.produtoId = id;
  EDICAO.card = card;
  EDICAO.htmlOriginal = card.innerHTML;

  card.innerHTML = `
    <div class="comercial-inline-edicao" data-inline-produto="${escapar(id)}">
      <input class="comercial-inline-nome" data-inline-nome type="text" value="${escapar(produto.nome || "")}" aria-label="Nome do produto">
      <div class="comercial-inline-grid">
        <div class="comercial-inline-campo">
          <label>Custo médio</label>
          <input data-inline-custo type="number" inputmode="decimal" lang="pt-BR" min="0" step="0.01" value="${numeroParaInput(moeda(produto.custoMedio), 2)}">
        </div>
        <div class="comercial-inline-campo">
          <label>Preço de venda</label>
          <input data-inline-venda type="number" inputmode="decimal" lang="pt-BR" min="0" step="0.01" value="${numeroParaInput(moeda(produto.precoVenda), 2)}">
        </div>
        <div class="comercial-inline-campo estoque">
          <label>Estoque atual</label>
          <input data-inline-estoque type="number" inputmode="decimal" lang="pt-BR" min="0" step="0.001" value="${numeroParaInput(quantidade(produto.estoque), 3)}">
        </div>
      </div>
      <div class="comercial-inline-acoes">
        <button class="btn secondary" type="button" data-inline-cancelar>Cancelar</button>
        <button class="btn" type="button" data-inline-salvar>Salvar</button>
      </div>
    </div>
  `;

  configurarCampoDecimal(card.querySelector("[data-inline-custo]"), { min: 0, step: 0.01, casas: 2 });
  configurarCampoDecimal(card.querySelector("[data-inline-venda]"), { min: 0, step: 0.01, casas: 2 });
  configurarCampoDecimal(card.querySelector("[data-inline-estoque]"), { min: 0, step: 0.001, casas: 3 });
  card.querySelector("[data-inline-nome]")?.focus();
}

async function salvarEdicaoInline() {
  if (EDICAO.salvando || !EDICAO.card || !EDICAO.produtoId) return;

  const atual = produtoPorId(EDICAO.produtoId);
  if (!atual) {
    restaurarCard();
    return toast("Produto não encontrado.", "erro");
  }

  const nome = String(EDICAO.card.querySelector("[data-inline-nome]")?.value || "").trim();
  const custo = numeroDigitado(EDICAO.card.querySelector("[data-inline-custo]")?.value);
  const precoVenda = numeroDigitado(EDICAO.card.querySelector("[data-inline-venda]")?.value);
  const estoqueAtual = numeroDigitado(EDICAO.card.querySelector("[data-inline-estoque]")?.value);

  if (!nome) return toast("Informe o produto.", "erro");
  if (![custo, precoVenda, estoqueAtual].every(Number.isFinite)) {
    return toast("Preencha custo, preço e estoque com números válidos.", "erro");
  }
  if (custo < 0 || precoVenda < 0 || estoqueAtual < 0) {
    return toast("Valores não podem ser negativos.", "erro");
  }
  if (ESTADO.produtos.some((p) => p.id !== EDICAO.produtoId && normalizarTexto(p.nome) === normalizarTexto(nome))) {
    return toast("Já existe outro produto comercial com esse nome.", "erro");
  }

  EDICAO.salvando = true;
  const botaoSalvar = EDICAO.card.querySelector("[data-inline-salvar]");
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

    restaurarCard();
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
      abrirEdicaoInline(editar);
      return;
    }

    if (evento.target.closest("[data-inline-cancelar]")) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      restaurarCard();
      return;
    }

    if (evento.target.closest("[data-inline-salvar]")) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      salvarEdicaoInline();
    }
  }, true);
}

instalar();
console.log("✅ Comercial 1.2.2: edição compacta no próprio card do produto");
