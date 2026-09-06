// ==========================================
// ListaLar - Menu Administrativo
// Mostra o botão Admin somente para usuários
// que possuem adminSistema: true no Firestore.
//
// Evita que o menu comum apareça antes do menu
// administrativo estar completamente definido.
// ==========================================

import "./avisos.js?v=1.0.64";
import "./estimativa-lista.js?v=1.0.67";

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
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ID_BOTAO_ADMIN = "tab-admin";
const ID_ESTILO_BLOQUEIO = "admin-menu-bloqueio";
const PAGINA_ADMIN = "./admin.html";

const MAXIMO_TENTATIVAS_FIREBASE = 100;
const INTERVALO_FIREBASE = 50;
const TEMPO_MAXIMO_MENU_OCULTO = 8000;

let observadorIniciado = false;
let menuLiberado = false;
let numeroVerificacao = 0;

function bloquearExibicaoInicialMenu() {
  if (document.getElementById(ID_ESTILO_BLOQUEIO)) return;

  const estilo = document.createElement("style");
  estilo.id = ID_ESTILO_BLOQUEIO;
  estilo.textContent = `
    .bottom-nav {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(estilo);
}

function liberarExibicaoMenu() {
  if (menuLiberado) return;
  menuLiberado = true;

  const estilo = document.getElementById(ID_ESTILO_BLOQUEIO);
  if (estilo) estilo.remove();

  const menu = obterMenuInferior();
  if (menu) {
    menu.style.visibility = "visible";
    menu.style.opacity = "1";
    menu.style.pointerEvents = "auto";
  }
}

function iniciarProtecaoDeTempo() {
  window.setTimeout(() => {
    if (!menuLiberado) {
      console.warn(
        "A verificação administrativa demorou. " +
        "O menu comum será exibido."
      );
      removerBotaoAdmin();
      liberarExibicaoMenu();
    }
  }, TEMPO_MAXIMO_MENU_OCULTO);
}

async function aguardarFirebase(
  tentativas = MAXIMO_TENTATIVAS_FIREBASE,
  intervalo = INTERVALO_FIREBASE
) {
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    if (getApps().length > 0) return getApp();
    await new Promise((resolve) => window.setTimeout(resolve, intervalo));
  }

  throw new Error("O Firebase do ListaLar não foi inicializado.");
}

function obterMenuInferior() {
  return document.querySelector(".bottom-nav");
}

async function aguardarMenuInferior(tentativas = 100, intervalo = 30) {
  for (let tentativa = 0; tentativa < tentativas; tentativa++) {
    const menu = obterMenuInferior();
    if (menu) return menu;
    await new Promise((resolve) => window.setTimeout(resolve, intervalo));
  }
  return null;
}

function ajustarColunasMenu() {
  const menu = obterMenuInferior();
  if (!menu) return;

  const quantidadeBotoes = menu.querySelectorAll(".tab").length;
  menu.style.gridTemplateColumns =
    `repeat(${Math.max(quantidadeBotoes, 1)}, minmax(0, 1fr))`;
}

function removerBotaoAdmin() {
  const botao = document.getElementById(ID_BOTAO_ADMIN);
  if (botao) botao.remove();
  ajustarColunasMenu();
}

function abrirPainelAdmin() {
  window.location.href = PAGINA_ADMIN;
}

function criarBotaoAdmin() {
  if (document.getElementById(ID_BOTAO_ADMIN)) {
    ajustarColunasMenu();
    return;
  }

  const menu = obterMenuInferior();
  if (!menu) {
    console.warn("Menu inferior não encontrado. O botão Admin não foi criado.");
    return;
  }

  const botao = document.createElement("button");
  botao.id = ID_BOTAO_ADMIN;
  botao.type = "button";
  botao.className = "tab";
  botao.setAttribute("aria-label", "Abrir painel administrativo");
  botao.innerHTML = `
    <span class="ico">⚙️</span>
    <span>Admin</span>
  `;
  botao.addEventListener("click", abrirPainelAdmin);
  menu.appendChild(botao);
  ajustarColunasMenu();
}

async function usuarioEhAdmin(usuario) {
  if (!usuario?.uid) return false;

  try {
    const aplicativo = getApp();
    const db = getFirestore(aplicativo);
    const referenciaUsuario = doc(db, "usuarios", usuario.uid);
    const snapshotUsuario = await getDoc(referenciaUsuario);
    if (!snapshotUsuario.exists()) return false;

    return snapshotUsuario.data().adminSistema === true;
  } catch (erro) {
    console.error("Erro ao verificar permissão administrativa:", erro);
    return false;
  }
}

async function verificarAcessoAdmin(usuario) {
  const verificacaoAtual = ++numeroVerificacao;
  removerBotaoAdmin();

  try {
    if (!usuario) return;

    const possuiAcesso = await usuarioEhAdmin(usuario);
    if (verificacaoAtual !== numeroVerificacao) return;
    if (possuiAcesso) criarBotaoAdmin();
  } catch (erro) {
    console.error("Erro durante a montagem do menu administrativo:", erro);
    removerBotaoAdmin();
  } finally {
    if (verificacaoAtual === numeroVerificacao) {
      ajustarColunasMenu();
      liberarExibicaoMenu();
    }
  }
}

async function inicializarMenuAdmin() {
  if (observadorIniciado) return;
  observadorIniciado = true;

  try {
    const menu = await aguardarMenuInferior();
    if (!menu) throw new Error("O menu inferior do ListaLar não foi encontrado.");

    await aguardarFirebase();
    const aplicativo = getApp();
    const auth = getAuth(aplicativo);

    onAuthStateChanged(
      auth,
      async (usuario) => {
        await verificarAcessoAdmin(usuario);
      },
      (erro) => {
        console.error("Erro ao observar o usuário autenticado:", erro);
        removerBotaoAdmin();
        liberarExibicaoMenu();
      }
    );
  } catch (erro) {
    console.error("Não foi possível iniciar o menu administrativo:", erro);
    removerBotaoAdmin();
    liberarExibicaoMenu();
  }
}

bloquearExibicaoInicialMenu();
iniciarProtecaoDeTempo();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarMenuAdmin, { once: true });
} else {
  inicializarMenuAdmin();
}
