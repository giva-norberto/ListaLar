// ListaLar Comercial 1.3.4 — seletores limpos e saldo da venda
import { $, ESTADO, produtoPorId, escapar, fmtNumero } from "./comercial-contexto.js?v=1.2.0";

function produtosAtivosOrdenados() {
  return ESTADO.produtos
    .filter((p) => p.ativo !== false)
    .slice()
    .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}

function htmlOpcoesProdutos() {
  return produtosAtivosOrdenados()
    .map((p) => `<option value="${escapar(p.id)}">${escapar(p.nome)}</option>`)
    .join("");
}

function preencherSelect(id, opcoes) {
  const el = $(id);
  if (!el) return;
  const atual = el.value;
  el.innerHTML = `<option value="">Selecione...</option>${opcoes}`;
  if ([...el.options].some((o) => o.value === atual)) el.value = atual;
}

export function atualizarSaldoVenda() {
  const campo = $("vendaSaldo");
  if (!campo) return;
  const produto = produtoPorId($("vendaProduto")?.value);
  campo.value = produto ? fmtNumero(produto.estoque) : "";
}

export function normalizarSeletoresProdutos() {
  const opcoes = htmlOpcoesProdutos();
  preencherSelect("compraProduto", opcoes);
  preencherSelect("vendaProduto", opcoes);
  atualizarSaldoVenda();
}

function criarEstilosVenda() {
  if ($("comercialVendaUiEstilos")) return;
  const style = document.createElement("style");
  style.id = "comercialVendaUiEstilos";
  style.textContent = `
    #formVenda{grid-template-columns:2fr .7fr .8fr 1fr 1fr auto}
    #vendaSaldo{background:#f1f5f9;color:#334155;border-color:#cbd5e1;font-weight:950;text-align:center;cursor:default}
    @media(max-width:760px){#formVenda{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);
}

function garantirCampoSaldoVenda() {
  const form = $("formVenda");
  const qtd = $("vendaQtd");
  const campoQtd = qtd?.closest(".field");
  if (!form || !campoQtd) return;

  const labelQtd = campoQtd.querySelector("label");
  if (labelQtd) labelQtd.textContent = "Qtd.";

  if (!$("vendaSaldo")) {
    const wrapper = document.createElement("div");
    wrapper.className = "field comercial-venda-saldo";
    wrapper.innerHTML = `<label for="vendaSaldo">Saldo</label><input id="vendaSaldo" class="input" type="text" readonly tabindex="-1" aria-label="Saldo disponível em estoque">`;
    form.insertBefore(wrapper, campoQtd);
  }
}

export function configurarVendaUi() {
  criarEstilosVenda();
  garantirCampoSaldoVenda();

  const venda = $("vendaProduto");
  if (venda && venda.dataset.saldoConfigurado !== "1") {
    venda.dataset.saldoConfigurado = "1";
    venda.addEventListener("change", atualizarSaldoVenda);
  }

  const form = $("formVenda");
  if (form && form.dataset.saldoConfigurado !== "1") {
    form.dataset.saldoConfigurado = "1";
    form.addEventListener("reset", () => queueMicrotask(atualizarSaldoVenda));
  }

  document.addEventListener("click", (evento) => {
    if (evento.target.closest("[data-editar-movimento]")) queueMicrotask(atualizarSaldoVenda);
  });

  normalizarSeletoresProdutos();
}
