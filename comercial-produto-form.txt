// ============================================================
// ListaLar Comercial — cadastro de produto com descrição livre
// Arquivo: comercial-produto-form.js
// Versão: 1.3.0
// ============================================================

import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  $, ESTADO, db, refs, normalizarTexto,
  numeroDigitado, moeda, quantidade, hoje, toast
} from "./comercial-contexto.js?v=1.2.0";

const UNIDADES = ["UN", "PCT", "CX", "KG", "G", "L", "ML"];

function criarEstilos() {
  if (document.getElementById("comercialProdutoFormEstilos")) return;
  const style = document.createElement("style");
  style.id = "comercialProdutoFormEstilos";
  style.textContent = `
    #formProduto{
      grid-template-columns:1fr 1fr!important;
      align-items:end;
    }
    #formProduto>.wide,
    #formProduto>.form-actions{
      grid-column:1/-1!important;
    }
    #produtoNome{
      min-height:74px;
      max-height:210px;
      resize:none;
      overflow-y:auto;
      line-height:1.35;
      white-space:pre-wrap;
    }
    #produtoUnidade{
      width:100%;
      min-height:52px;
      padding:11px 12px;
      border:1.5px solid #cbd9df;
      border-radius:14px;
      background:#fff;
      color:#172033;
      font-size:18px;
      font-weight:800;
      outline:none;
    }
    #produtoUnidade:focus{
      border-color:#0d9488;
      box-shadow:0 0 0 4px rgba(13,148,136,.12);
    }
    @media(max-width:520px){
      #produtoNome{min-height:70px}
      #produtoUnidade{min-height:54px;font-size:18px}
    }
  `;
  document.head.appendChild(style);
}

function ajustarDescricao(campo) {
  if (!(campo instanceof HTMLTextAreaElement)) return;
  campo.style.height = "auto";
  campo.style.height = `${Math.min(Math.max(campo.scrollHeight, 70), 210)}px`;
}

function prepararDescricaoLivre() {
  const atual = $("produtoNome");
  if (!atual) return null;

  let campo = atual;
  if (!(atual instanceof HTMLTextAreaElement)) {
    const textarea = document.createElement("textarea");
    textarea.id = atual.id;
    textarea.className = atual.className;
    textarea.required = atual.required;
    textarea.placeholder = atual.placeholder || "Ex.: Café 500 g tradicional, pacote vermelho";
    textarea.autocomplete = "off";
    textarea.rows = 2;
    textarea.value = atual.value || "";
    atual.replaceWith(textarea);
    campo = textarea;
  }

  const label = campo.closest(".field")?.querySelector("label");
  if (label) label.textContent = "Descrição";

  ajustarDescricao(campo);
  campo.addEventListener("input", () => ajustarDescricao(campo));
  return campo;
}

function inserirCampoUnidade() {
  if ($("produtoUnidade")) return $("produtoUnidade");
  const estoque = $("produtoEstoque")?.closest(".field");
  if (!estoque?.parentElement) return null;

  const campo = document.createElement("div");
  campo.className = "field";
  campo.innerHTML = `
    <label for="produtoUnidade">Unidade</label>
    <select id="produtoUnidade" aria-label="Unidade do produto">
      ${UNIDADES.map((u) => `<option value="${u}">${u}</option>`).join("")}
    </select>
  `;
  estoque.parentElement.insertBefore(campo, estoque);
  return campo.querySelector("select");
}

function limparCadastro() {
  const form = $("formProduto");
  form?.reset();
  if ($("produtoEstoque")) $("produtoEstoque").value = "0";
  if ($("produtoUnidade")) $("produtoUnidade").value = "UN";
  const descricao = $("produtoNome");
  if (descricao instanceof HTMLTextAreaElement) ajustarDescricao(descricao);
}

async function cadastrarProdutoComUnidade(evento) {
  if (ESTADO.edicao.produtoId) return;

  evento.preventDefault();
  evento.stopImmediatePropagation();
  if (ESTADO.salvando) return;

  const nome = String($("produtoNome")?.value || "").trim();
  const unidade = String($("produtoUnidade")?.value || "UN").trim().toUpperCase();
  const custoTexto = String($("produtoCusto")?.value || "").trim();
  const vendaTexto = String($("produtoVenda")?.value || "").trim();
  const estoqueTexto = String($("produtoEstoque")?.value || "").trim();
  const custo = custoTexto ? numeroDigitado(custoTexto) : 0;
  const precoVenda = vendaTexto ? numeroDigitado(vendaTexto) : 0;
  const estoqueInicial = estoqueTexto ? numeroDigitado(estoqueTexto) : 0;

  if (!nome) return toast("Informe a descrição do produto.", "erro");
  if (!UNIDADES.includes(unidade)) return toast("Selecione uma unidade válida.", "erro");
  if (![custo, precoVenda, estoqueInicial].every(Number.isFinite)) {
    return toast("Digite valores numéricos válidos. Ex.: 10,50.", "erro");
  }
  if (custo < 0 || precoVenda < 0 || estoqueInicial < 0) {
    return toast("Valores não podem ser negativos.", "erro");
  }
  if (ESTADO.produtos.some((p) => normalizarTexto(p.nome) === normalizarTexto(nome))) {
    return toast("Já existe um produto comercial com essa descrição.", "erro");
  }

  ESTADO.salvando = true;
  const botao = $("btnSalvarProduto");
  if (botao) {
    botao.disabled = true;
    botao.textContent = "Cadastrando...";
  }

  try {
    const produtoNovoRef = doc(refs().produtos);
    const movimentoNovoRef = estoqueInicial > 0 ? doc(refs().movimentos) : null;

    await runTransaction(db, async (tx) => {
      tx.set(produtoNovoRef, {
        nome,
        unidade,
        custoMedio: moeda(custo),
        precoVenda: moeda(precoVenda),
        estoque: quantidade(estoqueInicial),
        ativo: true,
        criadoPor: ESTADO.usuario.uid,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });

      if (movimentoNovoRef) {
        tx.set(movimentoNovoRef, {
          tipo: "compra",
          produtoId: produtoNovoRef.id,
          produtoNome: nome,
          unidade,
          quantidade: quantidade(estoqueInicial),
          custoUnitario: moeda(custo),
          valorTotal: moeda(estoqueInicial * custo),
          data: hoje(),
          origem: "estoque-inicial",
          criadoPor: ESTADO.usuario.uid,
          criadoEm: serverTimestamp()
        });
      }
    });

    limparCadastro();
    toast("Produto comercial cadastrado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível cadastrar o produto.", "erro");
  } finally {
    ESTADO.salvando = false;
    if (botao) {
      botao.disabled = false;
      botao.textContent = "Cadastrar";
    }
  }
}

function instalar() {
  criarEstilos();
  prepararDescricaoLivre();
  inserirCampoUnidade();

  $("formProduto")?.addEventListener("submit", cadastrarProdutoComUnidade, true);
}

instalar();
console.log("✅ Comercial 1.3.0: cadastro com descrição livre e unidade explícita");
