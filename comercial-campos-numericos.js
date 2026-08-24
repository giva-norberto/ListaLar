// ============================================================
// ListaLar Comercial — campos numéricos reais
// Arquivo: comercial-campos-numericos.js
// Versão: 1.2.1
// ============================================================

const CAMPOS = Object.freeze({
  produtoCusto: { min: 0, step: 0.01, casas: 2 },
  produtoVenda: { min: 0, step: 0.01, casas: 2 },
  produtoEstoque: { min: 0, step: 0.001, casas: 3 },
  compraQtd: { min: 0.001, step: 0.001, casas: 3 },
  compraCusto: { min: 0, step: 0.01, casas: 2 },
  vendaQtd: { min: 0.001, step: 0.001, casas: 3 },
  vendaValor: { min: 0, step: 0.01, casas: 2 },
  despesaValor: { min: 0.01, step: 0.01, casas: 2 }
});

const descritorTipo = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  "type"
);

const descritorValor = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  "value"
);

function normalizarNumeroParaInput(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return "";
  }

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? String(valor) : "";
  }

  let texto = String(valor)
    .trim()
    .replace(/\s/g, "")
    .replace(/^R\$/i, "");

  if (!texto) return "";

  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");

  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    texto = ultimaVirgula > ultimoPonto
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(/,/g, "");
  } else if (ultimaVirgula >= 0) {
    texto = texto.replace(",", ".");
  }

  return texto;
}

function instalarAcessores(campo) {
  if (!campo || campo.dataset.numeroRealInstalado === "1") return;

  Object.defineProperty(campo, "type", {
    configurable: true,
    enumerable: true,
    get() {
      return descritorTipo.get.call(this);
    },
    set(valor) {
      const solicitado = String(valor || "").toLowerCase();
      descritorTipo.set.call(
        this,
        CAMPOS[this.id] && solicitado === "text" ? "number" : valor
      );
    }
  });

  Object.defineProperty(campo, "value", {
    configurable: true,
    enumerable: true,
    get() {
      return descritorValor.get.call(this);
    },
    set(valor) {
      const preparado = CAMPOS[this.id]
        ? normalizarNumeroParaInput(valor)
        : valor;
      descritorValor.set.call(this, preparado);
    }
  });

  campo.dataset.numeroRealInstalado = "1";
}

function inserirSeparadorDecimal(campo, evento) {
  if (!campo || evento.defaultPrevented) return;
  if (evento.key !== "," && evento.data !== ",") return;

  evento.preventDefault();

  const atual = campo.value || "";
  if (atual.includes(".")) return;

  campo.value = atual ? `${atual}.` : "0.";
  campo.dispatchEvent(new Event("input", { bubbles: true }));
}

function limitarPrecisao(campo, casas) {
  const valor = campo.valueAsNumber;
  if (!Number.isFinite(valor)) return;

  const fator = 10 ** casas;
  const arredondado = Math.round((valor + Number.EPSILON) * fator) / fator;

  if (arredondado !== valor) {
    campo.value = String(arredondado);
  }
}

function configurarCampo(id, regra) {
  const campo = document.getElementById(id);
  if (!(campo instanceof HTMLInputElement)) return;

  instalarAcessores(campo);

  campo.type = "number";
  campo.inputMode = "decimal";
  campo.lang = "pt-BR";
  campo.autocomplete = "off";
  campo.min = String(regra.min);
  campo.step = String(regra.step);

  campo.addEventListener("keydown", (evento) => {
    inserirSeparadorDecimal(campo, evento);
  });

  campo.addEventListener("beforeinput", (evento) => {
    inserirSeparadorDecimal(campo, evento);
  });

  campo.addEventListener("blur", () => {
    limitarPrecisao(campo, regra.casas);
  });
}

export function instalarCamposNumericosComercial() {
  Object.entries(CAMPOS).forEach(([id, regra]) => {
    configurarCampo(id, regra);
  });
}

instalarCamposNumericosComercial();

console.log("✅ Comercial 1.2.1: campos de valor e quantidade usando input numérico real");
