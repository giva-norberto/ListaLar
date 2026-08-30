// ==========================================
// ListaLar - Avisos globais em tempo real
// Arquivo: avisos.js
// ==========================================

import {
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const REFERENCIA_COMUNICADO = [
  "configuracoes",
  "comunicadoGeral"
];

const ID_ESTILO = "listalar-aviso-global-estilos";
const ID_MODAL = "listalar-aviso-global";
const PREFIXO_ULTIMO_LIDO = "listalarUltimoComunicadoLido";
const MAXIMO_TENTATIVAS_FIREBASE = 100;
const INTERVALO_FIREBASE = 50;

let unsubscribeComunicado = null;
let uidAtual = "";
let chaveEmExibicao = "";
let obrigatorioEmExibicao = false;
let eventosGlobaisConfigurados = false;

function obterAplicativo() {
  if (getApps().length === 0) {
    return null;
  }

  return getApp();
}

async function aguardarAplicativo() {
  for (
    let tentativa = 0;
    tentativa < MAXIMO_TENTATIVAS_FIREBASE;
    tentativa += 1
  ) {
    const aplicativo = obterAplicativo();

    if (aplicativo) {
      return aplicativo;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, INTERVALO_FIREBASE);
    });
  }

  throw new Error("Firebase do ListaLar não foi inicializado.");
}

function normalizarTipo(tipo) {
  const valor = String(tipo || "info").trim().toLowerCase();

  if (["info", "success", "warning", "maintenance"].includes(valor)) {
    return valor;
  }

  return "info";
}

function iconePorTipo(tipo) {
  const mapa = {
    info: "ℹ️",
    success: "✅",
    warning: "⚠️",
    maintenance: "🛠️"
  };

  return mapa[normalizarTipo(tipo)] || mapa.info;
}

function chaveStorage(uid) {
  return `${PREFIXO_ULTIMO_LIDO}:${uid}`;
}

function lerUltimoComunicadoLido(uid) {
  if (!uid) {
    return "";
  }

  try {
    return localStorage.getItem(chaveStorage(uid)) || "";
  } catch (erro) {
    console.warn("Avisos: não foi possível ler o histórico local.", erro);
    return "";
  }
}

function marcarComoLido(uid, chave) {
  if (!uid || !chave) {
    return;
  }

  try {
    localStorage.setItem(chaveStorage(uid), chave);
  } catch (erro) {
    console.warn("Avisos: não foi possível registrar a leitura local.", erro);
  }
}

function hashTexto(texto) {
  let hash = 2166136261;

  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function chaveDoComunicado(dados) {
  if (!dados) {
    return "";
  }

  if (dados.versao !== undefined && dados.versao !== null) {
    return `v:${String(dados.versao)}`;
  }

  const timestamp = dados.atualizadoEm;

  if (timestamp) {
    const segundos =
      typeof timestamp.seconds === "number"
        ? timestamp.seconds
        : typeof timestamp._seconds === "number"
          ? timestamp._seconds
          : null;

    const nanos =
      typeof timestamp.nanoseconds === "number"
        ? timestamp.nanoseconds
        : typeof timestamp._nanoseconds === "number"
          ? timestamp._nanoseconds
          : 0;

    if (segundos !== null) {
      return `t:${segundos}:${nanos}`;
    }

    if (typeof timestamp.toMillis === "function") {
      return `m:${timestamp.toMillis()}`;
    }
  }

  const conteudo = JSON.stringify({
    titulo: String(dados.titulo || ""),
    mensagem: String(dados.mensagem || ""),
    tipo: normalizarTipo(dados.tipo),
    obrigatorio: dados.obrigatorio === true,
    ativo: dados.ativo === true
  });

  return `h:${hashTexto(conteudo)}`;
}

function criarEstilos() {
  if (document.getElementById(ID_ESTILO)) {
    return;
  }

  const estilo = document.createElement("style");
  estilo.id = ID_ESTILO;
  estilo.textContent = `
    #${ID_MODAL} {
      position: fixed;
      inset: 0;
      z-index: 2000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(15, 23, 42, 0.64);
      backdrop-filter: blur(5px);
    }

    #${ID_MODAL}.active {
      display: flex;
    }

    #${ID_MODAL} .listalar-aviso-card {
      width: 100%;
      max-width: 420px;
      border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 26px 70px rgba(15, 23, 42, 0.32);
      padding: 24px 20px 18px;
      text-align: center;
      animation: listalarAvisoEntrada 0.18s ease-out;
    }

    #${ID_MODAL} .listalar-aviso-icone {
      width: 62px;
      height: 62px;
      margin: 0 auto 13px;
      border-radius: 19px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 31px;
      background: #dbeafe;
    }

    #${ID_MODAL}[data-tipo="success"] .listalar-aviso-icone {
      background: #dcfce7;
    }

    #${ID_MODAL}[data-tipo="warning"] .listalar-aviso-icone,
    #${ID_MODAL}[data-tipo="maintenance"] .listalar-aviso-icone {
      background: #fef3c7;
    }

    #${ID_MODAL} .listalar-aviso-titulo {
      margin: 0 0 9px;
      color: #172033;
      font-size: 22px;
      font-weight: 900;
      line-height: 1.2;
    }

    #${ID_MODAL} .listalar-aviso-mensagem {
      margin: 0;
      color: #64748b;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.5;
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    #${ID_MODAL} .listalar-aviso-obrigatorio {
      display: none;
      margin: 14px 0 0;
      padding: 9px 11px;
      border-radius: 12px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 12px;
      font-weight: 900;
    }

    #${ID_MODAL}[data-obrigatorio="true"] .listalar-aviso-obrigatorio {
      display: block;
    }

    #${ID_MODAL} .listalar-aviso-botao {
      width: 100%;
      min-height: 49px;
      margin-top: 18px;
      border: 0;
      border-radius: 15px;
      background: linear-gradient(135deg, #2563eb, #06b6d4);
      color: #ffffff;
      font: inherit;
      font-size: 15px;
      font-weight: 900;
      cursor: pointer;
    }

    @keyframes listalarAvisoEntrada {
      from {
        opacity: 0;
        transform: translateY(10px) scale(0.98);
      }

      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `;

  document.head.appendChild(estilo);
}

function garantirModal() {
  criarEstilos();

  let modal = document.getElementById(ID_MODAL);

  if (modal) {
    return modal;
  }

  modal = document.createElement("div");
  modal.id = ID_MODAL;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "listalarAvisoTitulo");

  modal.innerHTML = `
    <div class="listalar-aviso-card">
      <div class="listalar-aviso-icone" id="listalarAvisoIcone">ℹ️</div>
      <h3 class="listalar-aviso-titulo" id="listalarAvisoTitulo">Aviso ListaLar</h3>
      <p class="listalar-aviso-mensagem" id="listalarAvisoMensagem"></p>
      <div class="listalar-aviso-obrigatorio">Confirme a leitura para continuar.</div>
      <button type="button" class="listalar-aviso-botao" id="listalarAvisoConfirmar">Entendi</button>
    </div>
  `;

  document.body.appendChild(modal);

  modal
    .querySelector("#listalarAvisoConfirmar")
    ?.addEventListener("click", () => {
      confirmarLeituraAtual();
    });

  modal.addEventListener("click", (evento) => {
    if (
      evento.target === modal &&
      obrigatorioEmExibicao !== true
    ) {
      confirmarLeituraAtual();
    }
  });

  return modal;
}

function fecharModal({ marcarLido = false } = {}) {
  const modal = document.getElementById(ID_MODAL);

  if (marcarLido && uidAtual && chaveEmExibicao) {
    marcarComoLido(uidAtual, chaveEmExibicao);
  }

  modal?.classList.remove("active");
  chaveEmExibicao = "";
  obrigatorioEmExibicao = false;
}

function confirmarLeituraAtual() {
  fecharModal({ marcarLido: true });
}

function exibirComunicado(dados, chave) {
  const modal = garantirModal();
  const tipo = normalizarTipo(dados.tipo);
  const obrigatorio = dados.obrigatorio === true;

  modal.dataset.tipo = tipo;
  modal.dataset.obrigatorio = String(obrigatorio);

  const titulo = modal.querySelector("#listalarAvisoTitulo");
  const mensagem = modal.querySelector("#listalarAvisoMensagem");
  const icone = modal.querySelector("#listalarAvisoIcone");
  const botao = modal.querySelector("#listalarAvisoConfirmar");

  if (titulo) {
    titulo.textContent = String(dados.titulo || "Aviso ListaLar");
  }

  if (mensagem) {
    mensagem.textContent = String(dados.mensagem || "");
  }

  if (icone) {
    icone.textContent = iconePorTipo(tipo);
  }

  if (botao) {
    botao.textContent = obrigatorio
      ? "Confirmar leitura"
      : "Entendi";
  }

  chaveEmExibicao = chave;
  obrigatorioEmExibicao = obrigatorio;
  modal.classList.add("active");
}

function processarSnapshot(snapshot) {
  if (!uidAtual) {
    fecharModal();
    return;
  }

  if (!snapshot.exists()) {
    fecharModal();
    return;
  }

  const dados = snapshot.data();

  if (
    dados.ativo !== true ||
    !String(dados.titulo || "").trim() ||
    !String(dados.mensagem || "").trim()
  ) {
    fecharModal();
    return;
  }

  const chave = chaveDoComunicado(dados);

  if (!chave) {
    return;
  }

  const ultimoLido = lerUltimoComunicadoLido(uidAtual);

  if (ultimoLido === chave) {
    if (chaveEmExibicao === chave) {
      fecharModal();
    }
    return;
  }

  if (chaveEmExibicao === chave) {
    return;
  }

  exibirComunicado(dados, chave);
}

function pararObservacaoComunicado() {
  if (typeof unsubscribeComunicado === "function") {
    unsubscribeComunicado();
  }

  unsubscribeComunicado = null;
  fecharModal();
}

function iniciarObservacaoComunicado(usuario) {
  pararObservacaoComunicado();

  if (!usuario?.uid) {
    uidAtual = "";
    return;
  }

  const aplicativo = obterAplicativo();

  if (!aplicativo) {
    console.warn("Avisos: Firebase ainda não foi inicializado.");
    return;
  }

  uidAtual = usuario.uid;

  const db = getFirestore(aplicativo);
  const referencia = doc(db, ...REFERENCIA_COMUNICADO);

  unsubscribeComunicado = onSnapshot(
    referencia,
    processarSnapshot,
    (erro) => {
      console.error(
        "Avisos: não foi possível acompanhar o comunicado geral no Firestore.",
        erro
      );
    }
  );
}

function configurarEventosGlobais() {
  if (eventosGlobaisConfigurados) {
    return;
  }

  eventosGlobaisConfigurados = true;

  document.addEventListener("keydown", (evento) => {
    if (
      evento.key === "Escape" &&
      chaveEmExibicao &&
      obrigatorioEmExibicao !== true
    ) {
      confirmarLeituraAtual();
    }
  });
}

async function iniciarAvisos() {
  try {
    const aplicativo = await aguardarAplicativo();

    configurarEventosGlobais();

    const auth = getAuth(aplicativo);

    onAuthStateChanged(
      auth,
      (usuario) => {
        if (!usuario) {
          uidAtual = "";
          pararObservacaoComunicado();
          return;
        }

        iniciarObservacaoComunicado(usuario);
      },
      (erro) => {
        console.error("Avisos: erro ao observar autenticação.", erro);
        uidAtual = "";
        pararObservacaoComunicado();
      }
    );
  } catch (erro) {
    console.error("Avisos: não foi possível iniciar o módulo.", erro);
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    iniciarAvisos,
    { once: true }
  );
} else {
  iniciarAvisos();
}
