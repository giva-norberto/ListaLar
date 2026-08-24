// ============================================================
// ListaLar Comercial — cadastro completo por voz
// Versão: 1.1.1
//
// Após a fala, separa visualmente as informações reconhecidas
// em Produto, Custo, Preço e Estoque, no mesmo princípio de
// revisão usado pela entrada por voz da ListaLar.
// ============================================================
(() => {
  "use strict";

  const SpeechRecognition =
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    null;

  if (!SpeechRecognition) return;

  const VERSAO = "1.1.1";

  let reconhecimentoAtual = null;
  let botaoAtual = null;

  const NUMEROS = {
    zero: 0,
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
    treze: 13,
    catorze: 14,
    quatorze: 14,
    quinze: 15,
    dezesseis: 16,
    dezassete: 17,
    dezessete: 17,
    dezoito: 18,
    dezenove: 19,
    vinte: 20,
    trinta: 30,
    quarenta: 40,
    cinquenta: 50,
    sessenta: 60,
    setenta: 70,
    oitenta: 80,
    noventa: 90,
    cem: 100,
    cento: 100,
    duzentos: 200,
    trezentos: 300,
    quatrocentos: 400,
    quinhentos: 500,
    seiscentos: 600,
    setecentos: 700,
    oitocentos: 800,
    novecentos: 900
  };

  function semAcento(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function normalizarTexto(texto) {
    return String(texto || "")
      .trim()
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " ");
  }

  function escaparHtml(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
    const bruto = semAcento(texto)
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

        // Ex.: "nove e noventa" => 9,90.
        // "vinte e cinco" permanece 25,00.
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
    return Number(valor)
      .toFixed(2)
      .replace(".", ",");
  }

  function formatarMoeda(valor) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function formatarQuantidade(valor) {
    return Number.isInteger(valor)
      ? String(valor)
      : String(valor).replace(".", ",");
  }

  function extrairSegmento(texto, inicioRegex, proximosRegex) {
    const match = texto.match(inicioRegex);
    if (!match) return "";

    const inicio = match.index + match[0].length;
    const resto = texto.slice(inicio);
    const fim = resto.search(proximosRegex);

    return normalizarTexto(
      fim >= 0 ? resto.slice(0, fim) : resto
    )
      .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, "")
      .trim();
  }

  function interpretarCadastro(falaOriginal) {
    const fala = normalizarTexto(falaOriginal);
    const falaBusca = semAcento(fala).toLowerCase();

    const marcador = /\b(custo(?:\s+unitario)?|paguei|comprei\s+por|preco(?:\s+de\s+venda)?|valor(?:\s+de\s+venda)?|vender(?:\s+por|\s+a)?|estoque(?:\s+inicial)?|quantidade|tenho)\b/;
    const primeiroMarcador = falaBusca.search(marcador);

    let nome =
      primeiroMarcador >= 0
        ? fala.slice(0, primeiroMarcador)
        : fala;

    nome = nome
      .replace(/^\s*(produto|cadastrar|cadastre|cadastra)\s+/i, "")
      .replace(/[,;:\-]+$/g, "")
      .trim();

    if (nome) {
      nome = nome.charAt(0).toUpperCase() + nome.slice(1);
    }

    const custoTexto = extrairSegmento(
      falaBusca,
      /\b(?:custo(?:\s+unitario)?|paguei|comprei\s+por)\s*(?:e|eh|é|:|de|foi)?\s*/,
      /\b(preco(?:\s+de\s+venda)?|valor(?:\s+de\s+venda)?|vender(?:\s+por|\s+a)?|estoque(?:\s+inicial)?|quantidade|tenho)\b/
    );

    const precoTexto = extrairSegmento(
      falaBusca,
      /\b(?:preco(?:\s+de\s+venda)?|valor(?:\s+de\s+venda)?|vender(?:\s+por|\s+a)?)\s*(?:e|eh|é|:|de|foi)?\s*/,
      /\b(custo(?:\s+unitario)?|paguei|comprei\s+por|estoque(?:\s+inicial)?|quantidade|tenho)\b/
    );

    const estoqueTexto = extrairSegmento(
      falaBusca,
      /\b(?:estoque(?:\s+inicial)?|quantidade|tenho)\s*(?:e|eh|é|:|de|foi)?\s*/,
      /\b(custo(?:\s+unitario)?|paguei|comprei\s+por|preco(?:\s+de\s+venda)?|valor(?:\s+de\s+venda)?|vender(?:\s+por|\s+a)?)\b/
    );

    return {
      nome,
      custo: custoTexto
        ? numeroFalado(custoTexto, true)
        : NaN,
      preco: precoTexto
        ? numeroFalado(precoTexto, true)
        : NaN,
      estoque: estoqueTexto
        ? numeroFalado(estoqueTexto, false)
        : NaN
    };
  }

  function preencherCampo(id, valor) {
    const campo = document.getElementById(id);
    if (!campo) return false;

    campo.value = valor;
    campo.dispatchEvent(
      new Event("input", { bubbles: true })
    );
    campo.dispatchEvent(
      new Event("change", { bubbles: true })
    );

    return true;
  }

  function garantirPainelQuebra() {
    let painel = document.getElementById("vozComercialQuebra");
    if (painel) return painel;

    const formulario = document.getElementById("formProduto");
    if (!formulario) return null;

    painel = document.createElement("section");
    painel.id = "vozComercialQuebra";
    painel.hidden = true;
    painel.setAttribute("aria-live", "polite");
    painel.style.marginTop = "12px";
    painel.style.padding = "12px";
    painel.style.border = "1px solid #99f6e4";
    painel.style.borderRadius = "14px";
    painel.style.background = "#f0fdfa";

    painel.innerHTML = `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:9px">
        <div>
          <strong style="display:block;font-size:13px;color:#115e59">🎙️ Dados separados da fala</strong>
          <small style="display:block;margin-top:3px;color:#64748b;line-height:1.35">Confira cada informação antes de cadastrar.</small>
        </div>
        <span style="padding:4px 7px;border-radius:999px;background:#ccfbf1;color:#115e59;font-size:9px;font-weight:900">REVISÃO</span>
      </div>
      <div id="vozComercialFrase" style="margin-bottom:9px;padding:8px 9px;border-radius:9px;background:#fff;color:#64748b;font-size:10px;line-height:1.4"></div>
      <div id="vozComercialCampos" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px"></div>
    `;

    formulario.insertAdjacentElement("afterend", painel);
    return painel;
  }

  function blocoResumo(rotulo, valor, reconhecido) {
    const fundo = reconhecido ? "#ffffff" : "#fff7ed";
    const borda = reconhecido ? "#dbe4ea" : "#fed7aa";
    const corValor = reconhecido ? "#172033" : "#9a3412";

    return `
      <article style="min-width:0;padding:9px;border:1px solid ${borda};border-radius:10px;background:${fundo}">
        <span style="display:block;color:#64748b;font-size:9px;font-weight:900;margin-bottom:4px">${escaparHtml(rotulo)}</span>
        <strong style="display:block;color:${corValor};font-size:12px;overflow-wrap:anywhere">${escaparHtml(valor)}</strong>
      </article>
    `;
  }

  function mostrarQuebraDaFala(fala, dados) {
    const painel = garantirPainelQuebra();
    if (!painel) return;

    const nomeOk = Boolean(dados.nome);
    const custoOk = Number.isFinite(dados.custo) && dados.custo >= 0;
    const precoOk = Number.isFinite(dados.preco) && dados.preco >= 0;
    const estoqueOk = Number.isFinite(dados.estoque) && dados.estoque >= 0;

    const frase = document.getElementById("vozComercialFrase");
    const campos = document.getElementById("vozComercialCampos");

    if (frase) {
      frase.innerHTML = `<strong style="color:#475569">Fala:</strong> ${escaparHtml(fala)}`;
    }

    if (campos) {
      campos.innerHTML = [
        blocoResumo(
          "Produto",
          nomeOk ? dados.nome : "Não identificado",
          nomeOk
        ),
        blocoResumo(
          "Custo unitário",
          custoOk ? formatarMoeda(dados.custo) : "Não identificado",
          custoOk
        ),
        blocoResumo(
          "Preço de venda",
          precoOk ? formatarMoeda(dados.preco) : "Não identificado",
          precoOk
        ),
        blocoResumo(
          "Estoque inicial",
          estoqueOk ? formatarQuantidade(dados.estoque) : "Não identificado",
          estoqueOk
        )
      ].join("");
    }

    painel.hidden = false;
    painel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function mostrarResumo(campos) {
    document.querySelector(".toast.voz-comercial")?.remove();

    const toast = document.createElement("div");
    toast.className = "toast ok voz-comercial";
    toast.textContent = campos.length
      ? "Separei os dados da fala abaixo. Confira os campos e toque em Cadastrar."
      : "Não consegui separar os dados. Fale produto, custo, preço e estoque.";

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  function restaurarBotao(botao) {
    if (!botao) return;

    botao.textContent = "🎙️";
    botao.title = "Falar produto, custo, preço e estoque";
    botao.setAttribute(
      "aria-label",
      "Cadastrar produto por voz"
    );
    botao.style.background = "#e2e8f0";
    botao.style.color = "#334155";
  }

  function aplicarCadastroPorVoz(fala) {
    const dados = interpretarCadastro(fala);
    const preenchidos = [];

    if (
      dados.nome &&
      preencherCampo("produtoNome", dados.nome)
    ) {
      preenchidos.push("produto");
    }

    if (
      Number.isFinite(dados.custo) &&
      dados.custo >= 0 &&
      preencherCampo(
        "produtoCusto",
        formatarDecimal(dados.custo)
      )
    ) {
      preenchidos.push("custo");
    }

    if (
      Number.isFinite(dados.preco) &&
      dados.preco >= 0 &&
      preencherCampo(
        "produtoVenda",
        formatarDecimal(dados.preco)
      )
    ) {
      preenchidos.push("preço");
    }

    if (
      Number.isFinite(dados.estoque) &&
      dados.estoque >= 0 &&
      preencherCampo(
        "produtoEstoque",
        formatarQuantidade(dados.estoque)
      )
    ) {
      preenchidos.push("estoque");
    }

    // Igual ao princípio da Lista: a fala é primeiro interpretada
    // e quebrada em informações visíveis para conferência.
    mostrarQuebraDaFala(fala, dados);
    mostrarResumo(preenchidos);

    document.getElementById("produtoNome")?.focus();
  }

  function instalarMicrofoneProduto() {
    const input = document.getElementById("produtoNome");

    if (
      !input ||
      document.getElementById("btnMicProduto")
    ) {
      return;
    }

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

    garantirPainelQuebra();

    botao.addEventListener("click", () => {
      if (reconhecimentoAtual) {
        try {
          reconhecimentoAtual.abort();
        } catch (_) {
          // O reconhecimento já pode ter sido encerrado pelo navegador.
        }

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
        botao.setAttribute(
          "aria-label",
          "Ouvindo cadastro do produto"
        );
        botao.style.background = "#fee2e2";
        botao.style.color = "#991b1b";
      };

      reconhecimento.onresult = (evento) => {
        const fala = normalizarTexto(
          evento.results?.[0]?.[0]?.transcript
        );

        if (fala) {
          aplicarCadastroPorVoz(fala);
        }
      };

      reconhecimento.onerror = (evento) => {
        console.warn(
          "Reconhecimento de voz Comercial:",
          evento.error
        );

        if (
          evento.error === "not-allowed" ||
          evento.error === "service-not-allowed"
        ) {
          botao.title =
            "Permita o acesso ao microfone no navegador";
        }
      };

      reconhecimento.onend = () => {
        if (reconhecimentoAtual === reconhecimento) {
          reconhecimentoAtual = null;
        }

        restaurarBotao(botao);

        if (botaoAtual === botao) {
          botaoAtual = null;
        }
      };

      try {
        reconhecimento.start();
      } catch (erro) {
        console.error(
          "Não foi possível iniciar o microfone:",
          erro
        );
        restaurarBotao(botao);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      instalarMicrofoneProduto,
      { once: true }
    );
  } else {
    instalarMicrofoneProduto();
  }

  console.log(`✅ Comercial voz ${VERSAO}`);
})();
