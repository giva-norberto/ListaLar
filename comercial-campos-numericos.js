// ============================================================
// ListaLar Comercial — campos numéricos com vírgula
// Arquivo: comercial-campos-numericos.js
// Versão: 1.2.2
// ============================================================

const CAMPOS = Object.freeze({
  produtoCusto: { min: 0, casas: 2 },
  produtoVenda: { min: 0, casas: 2 },
  produtoEstoque: { min: 0, casas: 3 },
  compraQtd: { min: 0.001, casas: 3 },
  compraCusto: { min: 0, casas: 2 },
  vendaQtd: { min: 0.001, casas: 3 },
  vendaValor: { min: 0, casas: 2 },
  despesaValor: { min: 0.01, casas: 2 }
});

function limparCaracteres(valor) {
  return String(valor ?? "")
    .replace(/[^0-9.,]/g, "");
}

function limitarCasasDigitadas(valor, casas) {
  const texto = limparCaracteres(valor);
  if (!texto) return "";

  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");
  const separador = Math.max(ultimaVirgula, ultimoPonto);

  if (separador < 0) return texto;

  const inteiro = texto.slice(0, separador).replace(/[.,]/g, "");
  const decimal = texto.slice(separador + 1).replace(/[.,]/g, "").slice(0, casas);
  const simbolo = texto[separador];

  return `${inteiro || "0"}${simbolo}${decimal}`;
}

function configurarCampo(id, regra) {
  const campo = document.getElementById(id);
  if (!(campo instanceof HTMLInputElement)) return;
  if (campo.dataset.decimalPtBr === "1") return;

  // type=text evita a sanitização do input number no iOS, que zerava
  // valores parciais como "10," antes de o usuário terminar a digitação.
  campo.type = "text";
  campo.inputMode = "decimal";
  campo.lang = "pt-BR";
  campo.autocomplete = "off";
  campo.setAttribute("pattern", "[0-9.,]*");
  campo.dataset.minimo = String(regra.min);
  campo.dataset.casasDecimais = String(regra.casas);
  campo.dataset.decimalPtBr = "1";

  campo.addEventListener("input", () => {
    const atual = campo.value;
    const limpo = limitarCasasDigitadas(atual, regra.casas);
    if (limpo !== atual) {
      const posicao = campo.selectionStart;
      campo.value = limpo;
      const novaPosicao = Math.min(posicao ?? limpo.length, limpo.length);
      campo.setSelectionRange(novaPosicao, novaPosicao);
    }
  });
}

export function instalarCamposNumericosComercial() {
  Object.entries(CAMPOS).forEach(([id, regra]) => {
    configurarCampo(id, regra);
  });
}

instalarCamposNumericosComercial();

console.log("✅ Comercial 1.2.2: valores aceitam vírgula ou ponto sem zerar a digitação");
