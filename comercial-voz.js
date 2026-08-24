// ListaLar Comercial — entrada por voz no cadastro de produto
(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  if (!SpeechRecognition) return;

  let reconhecimentoAtual = null;
  let botaoAtual = null;

  function normalizarTexto(texto) {
    const limpo = String(texto || "")
      .trim()
      .replace(/[.!?]+$/g, "")
      .replace(/\s+/g, " ");
    if (!limpo) return "";
    return limpo.charAt(0).toUpperCase() + limpo.slice(1);
  }

  function restaurarBotao(botao) {
    if (!botao) return;
    botao.textContent = "🎙️";
    botao.title = "Falar nome do produto";
    botao.setAttribute("aria-label", "Falar nome do produto");
    botao.style.background = "#e2e8f0";
    botao.style.color = "#334155";
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
    botao.title = "Falar nome do produto";
    botao.setAttribute("aria-label", "Falar nome do produto");
    botao.style.width = "48px";
    botao.style.minWidth = "48px";
    botao.style.border = "0";
    botao.style.borderRadius = "11px";
    botao.style.background = "#e2e8f0";
    botao.style.color = "#334155";
    botao.style.fontSize = "20px";
    botao.style.cursor = "pointer";
    botao.style.fontWeight = "900";
    wrapper.appendChild(botao);

    botao.addEventListener("click", () => {
      if (reconhecimentoAtual) {
        try { reconhecimentoAtual.abort(); } catch (_) {}
        reconhecimentoAtual = null;
        restaurarBotao(botaoAtual);
        botaoAtual = null;
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
        botao.setAttribute("aria-label", "Ouvindo nome do produto");
        botao.style.background = "#fee2e2";
        botao.style.color = "#991b1b";
      };

      reconhecimento.onresult = (evento) => {
        const texto = normalizarTexto(evento.results?.[0]?.[0]?.transcript);
        if (!texto) return;
        input.value = texto;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.focus();
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
