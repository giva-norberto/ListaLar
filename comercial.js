// ============================================================
// ListaLar — Lançador do módulo Comercial
// Arquivo: comercial.js
// Versão: 1.1.0
// ============================================================

(() => {
  "use strict";

  const VERSAO = "1.1.0";
  const ID_BOTAO = "tab-comercial";
  const CAMPO_FAMILIAS = "comercialFamiliasHabilitadas";
  const PAGINA_COMERCIAL = "./comercial.html";
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
    authDomain: "compras-da-casa.firebaseapp.com",
    projectId: "compras-da-casa",
    storageBucket: "compras-da-casa.firebasestorage.app",
    messagingSenderId: "63765433273",
    appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
  };

  let firebase = null;

  async function carregarFirebase() {
    if (firebase) return firebase;

    const [appMod, authMod, fs] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);

    const app = appMod.getApps().length
      ? appMod.getApp()
      : appMod.initializeApp(FIREBASE_CONFIG);

    firebase = {
      auth: authMod.getAuth(app),
      db: fs.getFirestore(app),
      onAuthStateChanged: authMod.onAuthStateChanged,
      doc: fs.doc,
      getDoc: fs.getDoc
    };

    return firebase;
  }

  function menuInferior() {
    return document.querySelector(".bottom-nav");
  }

  async function aguardarMenu() {
    for (let i = 0; i < 120; i += 1) {
      const menu = menuInferior();
      if (menu) return menu;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return null;
  }

  function ajustarColunasMenu() {
    const menu = menuInferior();
    if (!menu) return;

    const quantidade = menu.querySelectorAll(".tab").length;
    menu.style.gridTemplateColumns =
      `repeat(${Math.max(quantidade, 1)}, minmax(0, 1fr))`;
  }

  function removerBotao() {
    document.getElementById(ID_BOTAO)?.remove();
    ajustarColunasMenu();
  }

  async function criarBotao() {
    if (document.getElementById(ID_BOTAO)) {
      ajustarColunasMenu();
      return;
    }

    const menu = await aguardarMenu();
    if (!menu) return;

    const botao = document.createElement("button");
    botao.id = ID_BOTAO;
    botao.type = "button";
    botao.className = "tab";
    botao.setAttribute("aria-label", "Abrir módulo Comercial");
    botao.innerHTML = `
      <span class="ico">📈</span>
      <span>Comercial</span>
    `;
    botao.addEventListener("click", () => {
      window.location.href = PAGINA_COMERCIAL;
    });

    menu.appendChild(botao);
    ajustarColunasMenu();
  }

  async function verificarAcesso(usuario) {
    if (!usuario?.uid) return false;

    const f = await carregarFirebase();
    const usuarioSnap = await f.getDoc(
      f.doc(f.db, "usuarios", usuario.uid)
    );

    if (!usuarioSnap.exists()) return false;

    const dados = usuarioSnap.data() || {};
    const adminSistema = dados.adminSistema === true;
    const familiaId = String(dados.familiaId || "").trim();

    if (adminSistema) return true;
    if (!familiaId) return false;

    const configSnap = await f.getDoc(
      f.doc(f.db, "configuracoes", "modulos")
    );

    const liberadas = configSnap.exists()
      && Array.isArray(configSnap.data()?.[CAMPO_FAMILIAS])
      ? configSnap.data()[CAMPO_FAMILIAS]
      : [];

    return liberadas.includes(familiaId);
  }

  async function iniciar() {
    try {
      const f = await carregarFirebase();

      f.onAuthStateChanged(f.auth, async (usuario) => {
        try {
          const permitido = await verificarAcesso(usuario);
          if (permitido) await criarBotao();
          else removerBotao();
        } catch (erro) {
          console.warn("Não foi possível verificar acesso ao Comercial:", erro);
          removerBotao();
        }
      });
    } catch (erro) {
      console.warn("Módulo Comercial indisponível:", erro);
      removerBotao();
    }
  }

  iniciar();
  console.log(`✅ Lançador Comercial ${VERSAO}`);
})();
