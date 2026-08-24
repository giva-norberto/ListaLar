// ListaLar Comercial — cadastro completo por voz
(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (!SpeechRecognition) return;

  let reconhecimentoAtual = null;
  let botaoAtual = null;

  const NUMEROS = {
    zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
    seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
    treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16,
    dezassete: 17, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20,
    trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
    oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200,
    trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600,
    setecentos: 700, oitocentos: 800, novecentos: 900
  };

  function semAcento(texto) {
    return String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function normalizarTexto(texto) {
    return String(texto || "")
      .trim()
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " ");
  }

  function numeroInteiroPorExtenso(texto) {
    const tokens = semAcento(texto)
      .toLowerCase()
      .replace(/\b(e|de|reais?|centavos?|unidades?)\b/g, " ")
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(Boolean);

    if (!tokens.length) return NaN;

    let total = 0;
    let bloco = 0;
    let reconheceu = false;

    for (const token of tokens) {
      if (/^\d+$/.test(token)) {
        bloco += Number(token);
        reconheceu = true;
        continue;
      }
      if (token === "mil") {
        total += (bloco || 1) * 1000;
        bloco = 0;
        reconheceu = true;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(NUMEROS, token)) {
        bloco += NUMEROS[token];
        reconheceu = true;
      }
    }

    return reconheceu ? total + bloco : NaN;
  }

  function numeroFalado(texto, monetario = false) {
    let bruto = semAcento(texto)
      .toLowerCase()
      .replace(/r\$/g, " ")
      .replace(/\breais?\b/g, " ")
      .replace(/\bcentavos?\b/g, " ")
      .trim();

    const decimalDireto = bruto.match(/-?\d+(?:[.,]\d+)?/);
    if (decimalDireto && /[.,]/.test(decimalDireto[0])) {
      const n = Number(decimalDireto[0].replace(",", "."));
      return Number.isFinite(n) ? n : NaN;
    }

    if (monetario) {
      const partes = bruto.split(/\s+e\s+/);
      if (partes.length >= 2) {
        const direitaTexto = partes.pop();
        const esquerdaTexto = partes.join(" e ");
        const esquerda = numeroInteiroPorExtenso(esquerdaTexto);
        const direita = numeroInteiroPorExtenso(direitaTexto);

        // Ex.: "nove e noventa" => 9,90. Para "vinte e cinco",
        // mantém 25,00 porque a segunda parcela é menor que 10.
        if (Number.isFinite(esquerda) && Number.isFinite(direita)) {
          if (esquerda < 100 && direita >= 10 && direita < 100) {
            return esquerda + (direita / 100);
          }
          return esquerda + direita;
        }
      }
    }

    const inteiro = numeroInteiroPorExtenso(bruto);
    if (Number.isFinite(inteiro)) return inteiro;

    const digito = bruto.match(/-?\d+/);
    return digito ? Number(digito[0]) : NaN;
  }

  function formatarDecimal(valor) {
    return Number(valor).toFixed(2).replace(".", ",");
  }

  function formatarQuantidade(valor) {
    return Number.isInteger(valor) ? String(valor) : String(valor).replace(".", ",");
  }

  function extrairSegmento(texto, inicioRegex, proximosRegex) {
    const match = texto.match(inicioRegex);
    if (!match) return "";
    const inicio = match.index + match[0].length;
    const resto = texto.slice(inicio);
    const fim = resto.search(proximosRegex);
    return normalizarTexto(fim >= 0 ? resto.slice(0, fim) : resto);
  }

  function interpretarCadastro(falaOriginal) {
    const fala = normalizarTexto(falaOriginal);
    const falaBusca = semAcento(fala).toLowerCase();

    const marcador = /\b(custo(?:\s+unitario)?|preco(?:\s+de\s+venda)?|valor(?:\s+de\s+venda)?|estoque(?:\s+inicial)?|quantidade)\b/;
    const primeiroMarcador = falaBusca.search(marcador);

    let nome = primeiroMarcador >= 0 ? fala.slice(0, primeiroMarcador) : fala;
    nome = nome.replace(/^\s*produto\s+/i, "").replace(/[,;:\-]+$/g, "").trim();
    if (nome) nome = nome.charAt(0).toUpperCase() + nome.slice(1);

    const custoTexto = extrairSegmento(
      falaBusca,
      /\bcusto(?:\s+unitario)?\s*(?:e|eh|é|:)?\s*/,
      /\b(preco(?:\s+de\s+venda)?|valor(?:\s+de\s+venda)?|estoque(?:\s+inicial)?|quantidade)\b/
    );

    const precoTexto = extrairSegmento(
      falaBusca,
      /\b(?:preco(?:\s+de\s+venda)?|valor(?:\s+de\s+venda)?)\s*(?:e|eh|é|:)?\s*/,
      /\b(custo(?:\s+unitario)?|estoque(?:\s+inicial)?|quantidade)\b/
    );

    const estoqueTexto = extrairSegmento(
      falaBusca,
      /\b(?:estoque(?:\s+inicial)?|quantidade)\s*(?:e|eh|é|:)?\s*/,
      /\b(custo(?:\s+unitario)?|preco(?:\s+de\s+venda)?|valor(?:\s+de\s+venda)?)\b/
    );

    return {
      nome,
      custo: custoTexto ? numeroFalado(custoTexto, true) : NaN,
      preco: precoTexto ? numeroFalado(precoTexto, true) : NaN,
      estoque: estoqueTexto ? numeroFalado(estoqueTexto, false) : NaN
    };
  }

  function preencherCampo(id, valor) {
    const campo = document.getElementById(id);
    if (!campo) return false;
    campo.value = valor;
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function mostrarResumo(campos) {
    document.querySelector(".toast.voz-comercial")?.remove();
    const toast = document.createElement("div");
    toast.className = "toast ok voz-comercial";
    toast.textContent = campos.length
      ? `Voz preenchida: ${campos.join(", ")}. Confira e toque em Cadastrar.`
      : "Não consegui identificar os dados. Tente falar produto, custo, preço e estoque.";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  function restaurarBotao(botao) {
    if (!botao) return;
    botao.textContent = "🎙️";
    botao.title = "Falar produto, custo, preço e estoque";
    botao.setAttribute("aria-label", "Cadastrar produto por voz");
    botao.style.background = "#e2e8f0";
    botao.style.color = "#334155";
  }

  function aplicarCadastroPorVoz(fala) {
    const dados = interpretarCadastro(fala);
    const preenchidos = [];

    if (dados.nome && preencherCampo("produtoNome", dados.nome)) preenchidos.push("produto");
    if (Number.isFinite(dados.custo) && dados.custo >= 0 && preencherCampo("produtoCusto", formatarDecimal(dados.custo))) preenchidos.push("custo");
    if (Number.isFinite(dados.preco) && dados.preco >= 0 && preencherCampo("produtoVenda", formatarDecimal(dados.preco))) preenchidos.push("preço");
    if (Number.isFinite(dados.estoque) && dados.estoque >= 0 && preencherCampo("produtoEstoque", formatarQuantidade(dados.estoque))) preenchidos.push("estoque");

    document.getElementById("produtoNome")?.focus();
    mostrarResumo(preenchidos);
  }

  function instalarMicrofoneProduto() {
    const input = document.getElementById("produtoNome");
    if (!input || document.getElementById("btnMicProduto")) return;

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "7px";
    wrapper.style.alignItems = "stretch";

    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);
    input.style.flex = "1 1 auto";
    input.style.minWidth = "0";

    const botao = document.createElement("button");
    botao.id = "btnMicProduto";
    botao.type = "button";
    botao.textContent = "🎙️";
    botao.style.width = "48px";
    botao.style.minWidth = "48px";
    botao.style.border = "0";
    botao.style.borderRadius = "11px";
    botao.style.background = "#e2e8f0";
    botao.style.color = "#334155";
    botao.style.fontSize = "20px";
    botao.style.cursor = "pointer";
    botao.style.fontWeight = "900";
    restaurarBotao(botao);
    wrapper.appendChild(botao);

    botao.addEventListener("click", () => {
      if (reconhecimentoAtual) {
        try { reconhecimentoAtual.abort(); } catch (_) {}
        reconhecimentoAtual = null;
        restaurarBotao(botaoAtual);
        botaoAtual = null;
        return;
      }

      const reconhecimento = new SpeechRecognition();
      reconhecimento.lang = "pt-BR";
      reconhecimento.continuous = false;
      reconhecimento.interimResults = false;
      reconhecimento.maxAlternatives = 1;

      reconhecimento.onstart = () => {
        reconhecimentoAtual = reconhecimento;
        botaoAtual = botao;
        botao.textContent = "🔴";
        botao.title = "Ouvindo... toque para cancelar";
        botao.setAttribute("aria-label", "Ouvindo cadastro do produto");
        botao.style.background = "#fee2e2";
        botao.style.color = "#991b1b";
      };

      reconhecimento.onresult = (evento) => {
        const fala = normalizarTexto(evento.results?.[0]?.[0]?.transcript);
        if (fala) aplicarCadastroPorVoz(fala);
      };

      reconhecimento.onerror = (evento) => {
        console.warn("Reconhecimento de voz Comercial:", evento.error);
        if (evento.error === "not-allowed" || evento.error === "service-not-allowed") {
          botao.title = "Permita o acesso ao microfone no navegador";
        }
      };

      reconhecimento.onend = () => {
        if (reconhecimentoAtual === reconhecimento) reconhecimentoAtual = null;
        restaurarBotao(botao);
        if (botaoAtual === botao) botaoAtual = null;
      };

      try {
        reconhecimento.start();
      } catch (erro) {
        console.error("Não foi possível iniciar o microfone:", erro);
        restaurarBotao(botao);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalarMicrofoneProduto, { once: true });
  } else {
    instalarMicrofoneProduto();
  }
})();
