// ============================================================
// ListaLar — Módulo Comercial
// Arquivo: comercial.js
// Versão: 1.0.0
// ============================================================

(() => {
  "use strict";

  const VERSAO = "1.0.0";
  const CAMPO_FAMILIAS = "comercialFamiliasHabilitadas";
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
    authDomain: "compras-da-casa.firebaseapp.com",
    projectId: "compras-da-casa",
    storageBucket: "compras-da-casa.firebasestorage.app",
    messagingSenderId: "63765433273",
    appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
  };

  const ESTADO = {
    firebase: null,
    usuario: null,
    dadosUsuario: null,
    familiaId: "",
    habilitado: false,
    adminSistema: false,
    familiasHabilitadas: new Set(),
    familiasAdmin: [],
    produtos: [],
    movimentos: [],
    periodo: competenciaAtual(),
    busca: "",
    unsubscribeProdutos: null,
    unsubscribeMovimentos: null,
    interfaceCriada: false,
    salvando: false
  };

  const $ = (id) => document.getElementById(id);

  function numero(valor, padrao = 0) {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : padrao;
    let texto = String(valor ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
    if (!texto) return padrao;
    if (texto.includes(",") && texto.includes(".")) texto = texto.replace(/\./g, "").replace(",", ".");
    else texto = texto.replace(",", ".");
    const n = Number(texto);
    return Number.isFinite(n) ? n : padrao;
  }

  function moeda(valor) {
    return Math.round((numero(valor) + Number.EPSILON) * 100) / 100;
  }

  function formatarMoeda(valor) {
    return moeda(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatarNumero(valor) {
    return numero(valor).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  }

  function escapar(valor) {
    return String(valor ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizar(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function dataHoje() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function competenciaAtual() {
    return dataHoje().slice(0, 7);
  }

  function rotuloCompetencia(valor) {
    const m = String(valor || "").match(/^(\d{4})-(\d{2})$/);
    if (!m) return valor || "";
    const d = new Date(Number(m[1]), Number(m[2]) - 1, 1);
    const txt = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  async function carregarFirebase() {
    if (ESTADO.firebase) return ESTADO.firebase;
    const [appMod, authMod, fs] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(FIREBASE_CONFIG);
    ESTADO.firebase = {
      auth: authMod.getAuth(app), db: fs.getFirestore(app), onAuthStateChanged: authMod.onAuthStateChanged,
      doc: fs.doc, getDoc: fs.getDoc, setDoc: fs.setDoc, addDoc: fs.addDoc, collection: fs.collection,
      getDocs: fs.getDocs, query: fs.query, orderBy: fs.orderBy, limit: fs.limit, onSnapshot: fs.onSnapshot,
      runTransaction: fs.runTransaction, serverTimestamp: fs.serverTimestamp
    };
    return ESTADO.firebase;
  }

  function familiaRef() {
    if (!ESTADO.firebase || !ESTADO.familiaId) return null;
    return ESTADO.firebase.doc(ESTADO.firebase.db, "familias", ESTADO.familiaId);
  }

  function produtosRef() {
    const ref = familiaRef();
    return ref ? ESTADO.firebase.collection(ref, "comercial_produtos") : null;
  }

  function movimentosRef() {
    const ref = familiaRef();
    return ref ? ESTADO.firebase.collection(ref, "comercial_movimentos") : null;
  }

  function criarEstilos() {
    if ($("listalar-comercial-estilos")) return;
    const style = document.createElement("style");
    style.id = "listalar-comercial-estilos";
    style.textContent = `
      .listalar-menu-comercial{border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:0;min-height:56px;padding:6px 2px;border-radius:15px;flex:1 1 0}.listalar-menu-comercial .ico{font-size:20px}.listalar-menu-comercial .txt{font-size:10px;font-weight:900;white-space:nowrap}
      .bottom-nav:has(#listalar-menu-comercial){display:flex!important;gap:4px!important}.bottom-nav:has(#listalar-menu-comercial)>*{flex:1 1 0!important;width:auto!important;min-width:0!important}
      .listalar-comercial-tela{position:fixed;inset:0;z-index:11000;display:none;background:#f4f7fb;color:#172033;overflow-y:auto}.listalar-comercial-tela.aberta{display:block}.listalar-comercial-tela *{box-sizing:border-box}
      .lc-head{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:max(14px,env(safe-area-inset-top)) 16px 14px;color:#fff;background:linear-gradient(135deg,#0f766e,#0d9488);box-shadow:0 4px 16px rgba(15,23,42,.18)}.lc-head h1{margin:0;font-size:21px}.lc-head p{margin:3px 0 0;font-size:12px;opacity:.9}.lc-close{width:42px;height:42px;border:0;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:25px}
      .lc-main{width:min(100%,960px);margin:auto;padding:14px 12px 110px}.lc-loading{position:sticky;top:70px;z-index:4;margin-bottom:10px;padding:10px;border-radius:12px;background:#ccfbf1;color:#115e59;text-align:center;font-weight:800}.lc-periodo{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.lc-periodo select,.lc-input,.lc-select{width:100%;min-height:44px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:11px;background:#fff;font:inherit}.lc-periodo select{width:auto;font-weight:800}
      .lc-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:12px}.lc-kpi{padding:13px;border:1px solid #dbe4f0;border-radius:15px;background:#fff;box-shadow:0 4px 12px rgba(15,23,42,.05)}.lc-kpi span{display:block;color:#64748b;font-size:10px;font-weight:800;margin-bottom:6px}.lc-kpi strong{display:block;font-size:17px;overflow-wrap:anywhere}.lc-kpi.result{background:#ecfdf5;border-color:#86efac}.lc-kpi.result.neg{background:#fff1f2;border-color:#fecaca}
      .lc-card{margin-bottom:12px;padding:16px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;box-shadow:0 4px 14px rgba(15,23,42,.05)}.lc-card h2{margin:0 0 4px;font-size:17px}.lc-card p{margin:0 0 12px;color:#64748b;font-size:12px;line-height:1.4}.lc-form{display:grid;grid-template-columns:2fr repeat(3,1fr) auto;gap:8px}.lc-btn{min-height:44px;padding:9px 14px;border:0;border-radius:11px;background:#0f766e;color:#fff;font:inherit;font-weight:800;cursor:pointer}.lc-btn:disabled{opacity:.6;cursor:wait}.lc-mov{display:grid;grid-template-columns:1.4fr 1.6fr 1fr 1fr auto;gap:8px;align-items:end}.lc-field{display:grid;gap:5px}.lc-field label{font-size:11px;color:#475569;font-weight:800}
      .lc-list{display:grid;gap:8px}.lc-item{padding:12px;border:1px solid #e2e8f0;border-radius:13px;background:#f8fafc}.lc-top{display:flex;justify-content:space-between;gap:10px;align-items:start}.lc-meta{margin-top:6px;color:#64748b;font-size:11px;line-height:1.5}.lc-values{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin-top:9px}.lc-value{padding:8px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}.lc-value span{display:block;color:#64748b;font-size:9px;font-weight:800}.lc-value strong{display:block;margin-top:3px;font-size:12px}.lc-badge{padding:5px 8px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:10px;font-weight:900;white-space:nowrap}.lc-badge.venda{background:#dcfce7;color:#166534}.lc-badge.compra{background:#e0f2fe;color:#0369a1}.lc-badge.despesa{background:#fee2e2;color:#991b1b}.lc-empty{padding:18px;border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;color:#64748b;text-align:center;font-size:12px}.lc-alert{position:fixed;left:50%;bottom:max(22px,env(safe-area-inset-bottom));z-index:14000;width:min(calc(100% - 32px),480px);transform:translateX(-50%);padding:12px 14px;border-radius:12px;background:#334155;color:#fff;text-align:center;font-size:13px;font-weight:800}.lc-alert.ok{background:#15803d}.lc-alert.erro{background:#b91c1c}
      .lc-admin{border-color:#c4b5fd;background:linear-gradient(145deg,#fff,#faf5ff)}.lc-family{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px;border:1px solid #ddd6fe;border-radius:12px;background:#fff}.lc-family input{width:20px;height:20px}
      @media(max-width:720px){.lc-grid{grid-template-columns:1fr 1fr}.lc-kpi.result{grid-column:1/-1}.lc-form{grid-template-columns:1fr 1fr}.lc-form>:first-child,.lc-form>.lc-btn{grid-column:1/-1}.lc-mov{grid-template-columns:1fr 1fr}.lc-mov>:nth-child(1),.lc-mov>:nth-child(2),.lc-mov>.lc-btn{grid-column:1/-1}.lc-values{grid-template-columns:1fr 1fr}.lc-periodo{align-items:stretch;flex-direction:column}.lc-periodo select{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function localizarMenu() {
    return document.querySelector(".bottom-nav") || document.querySelector("#bottom-nav") || document.querySelector("#bottomNav");
  }

  function criarInterface() {
    if (ESTADO.interfaceCriada) return;
    criarEstilos();

    const botao = document.createElement("button");
    botao.id = "listalar-menu-comercial";
    botao.type = "button";
    botao.className = "listalar-menu-comercial";
    botao.innerHTML = `<span class="ico">📈</span><span class="txt">Comercial</span>`;
    botao.setAttribute("aria-label", "Abrir Comercial");
    botao.addEventListener("click", abrirTela);
    localizarMenu()?.appendChild(botao);

    const tela = document.createElement("section");
    tela.id = "listalar-comercial-tela";
    tela.className = "listalar-comercial-tela";
    tela.innerHTML = `
      <header class="lc-head"><div><h1>📈 Comercial</h1><p>Compras para revenda, vendas, estoque e resultado.</p></div><button id="lc-fechar" class="lc-close" type="button">×</button></header>
      <main class="lc-main">
        <div id="lc-loading" class="lc-loading" hidden>Carregando...</div>
        <div class="lc-periodo"><strong>Visão do negócio</strong><select id="lc-periodo"></select></div>
        <section class="lc-grid">
          <article class="lc-kpi"><span>Faturamento</span><strong id="lc-receita">R$ 0,00</strong></article>
          <article class="lc-kpi"><span>Custo vendido</span><strong id="lc-custo">R$ 0,00</strong></article>
          <article class="lc-kpi"><span>Lucro bruto</span><strong id="lc-lucro">R$ 0,00</strong></article>
          <article class="lc-kpi"><span>Despesas</span><strong id="lc-despesas">R$ 0,00</strong></article>
          <article id="lc-card-resultado" class="lc-kpi result"><span>Resultado</span><strong id="lc-resultado">R$ 0,00</strong></article>
          <article class="lc-kpi"><span>Margem bruta</span><strong id="lc-margem">0%</strong></article>
          <article class="lc-kpi"><span>Estoque a custo</span><strong id="lc-estoque-custo">R$ 0,00</strong></article>
          <article class="lc-kpi"><span>Estoque a venda</span><strong id="lc-estoque-venda">R$ 0,00</strong></article>
        </section>
        <section id="lc-admin" class="lc-card lc-admin" hidden><h2>🔐 Liberação por família</h2><p>O Comercial fica bloqueado por padrão. Plano Full não libera automaticamente. Marque somente as famílias autorizadas.</p><div id="lc-admin-lista" class="lc-list"></div><button id="lc-admin-salvar" class="lc-btn" type="button" style="margin-top:12px">Salvar liberações</button></section>
        <div id="lc-operacao" hidden>
          <section class="lc-card"><h2>Novo produto de revenda</h2><p>Cadastro separado do estoque doméstico.</p><form id="lc-form-produto" class="lc-form"><input id="lc-produto-nome" class="lc-input" placeholder="Produto" required><input id="lc-produto-custo" class="lc-input" type="number" min="0" step="0.01" placeholder="Custo R$" required><input id="lc-produto-venda" class="lc-input" type="number" min="0" step="0.01" placeholder="Venda R$" required><input id="lc-produto-estoque" class="lc-input" type="number" min="0" step="0.001" value="0" placeholder="Estoque inicial"><button class="lc-btn" type="submit">Cadastrar</button></form></section>
          <section class="lc-card"><h2>Registrar movimentação</h2><p>Compra aumenta estoque e recalcula custo médio. Venda baixa estoque e registra o lucro bruto. Despesa entra no resultado.</p><div class="lc-mov"><div class="lc-field"><label>Tipo</label><select id="lc-tipo" class="lc-select"><option value="venda">Venda</option><option value="compra">Compra</option><option value="despesa">Despesa</option></select></div><div id="lc-produto-wrap" class="lc-field"><label>Produto</label><select id="lc-mov-produto" class="lc-select"></select></div><div id="lc-qtd-wrap" class="lc-field"><label>Quantidade</label><input id="lc-mov-qtd" class="lc-input" type="number" min="0.001" step="0.001" value="1"></div><div id="lc-valor-wrap" class="lc-field"><label id="lc-valor-label">Valor unitário</label><input id="lc-mov-valor" class="lc-input" type="number" min="0" step="0.01"></div><div id="lc-despesa-wrap" class="lc-field" hidden><label>Descrição</label><input id="lc-despesa-desc" class="lc-input" placeholder="Frete, embalagem..."></div><button id="lc-salvar-mov" class="lc-btn" type="button">Registrar</button></div></section>
          <section class="lc-card"><h2>Produtos</h2><p>Custo médio, preço de venda, estoque, lucro unitário, margem e markup.</p><input id="lc-busca" class="lc-input" type="search" placeholder="🔎 Buscar produto" style="margin-bottom:10px"><div id="lc-produtos" class="lc-list"></div></section>
          <section class="lc-card"><h2>Histórico</h2><p>Movimentações do período selecionado.</p><div id="lc-historico" class="lc-list"></div></section>
        </div>
      </main>
      <div id="lc-alert" class="lc-alert" hidden></div>
    `;
    document.body.appendChild(tela);

    $("lc-fechar").addEventListener("click", fecharTela);
    $("lc-form-produto").addEventListener("submit", cadastrarProduto);
    $("lc-tipo").addEventListener("change", atualizarCamposMovimento);
    $("lc-mov-produto").addEventListener("change", atualizarCamposMovimento);
    $("lc-salvar-mov").addEventListener("click", registrarMovimento);
    $("lc-periodo").addEventListener("change", (e) => { ESTADO.periodo = e.target.value; renderizar(); });
    $("lc-busca").addEventListener("input", (e) => { ESTADO.busca = e.target.value; renderProdutos(); });
    $("lc-admin-salvar").addEventListener("click", salvarLiberacoes);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && tela.classList.contains("aberta")) fecharTela(); });
    ESTADO.interfaceCriada = true;
  }

  function mostrarAviso(texto, tipo = "") {
    const el = $("lc-alert");
    if (!el) return;
    el.textContent = texto;
    el.className = `lc-alert ${tipo}`;
    el.hidden = false;
    clearTimeout(mostrarAviso.t);
    mostrarAviso.t = setTimeout(() => { el.hidden = true; }, 4200);
  }

  function carregando(ativo, texto = "Carregando...") {
    const el = $("lc-loading");
    if (!el) return;
    el.textContent = texto;
    el.hidden = !ativo;
  }

  function pararListeners() {
    ESTADO.unsubscribeProdutos?.();
    ESTADO.unsubscribeMovimentos?.();
    ESTADO.unsubscribeProdutos = null;
    ESTADO.unsubscribeMovimentos = null;
  }

  async function carregarContexto(usuario) {
    const f = await carregarFirebase();
    const usuarioSnap = await f.getDoc(f.doc(f.db, "usuarios", usuario.uid));
    if (!usuarioSnap.exists()) return aplicarContexto(null, "", false, []);
    const dados = usuarioSnap.data();
    const familiaId = String(dados.familiaId || "").trim();
    const configSnap = await f.getDoc(f.doc(f.db, "configuracoes", "modulos"));
    const config = configSnap.exists() ? configSnap.data() : {};
    const ids = Array.isArray(config[CAMPO_FAMILIAS]) ? config[CAMPO_FAMILIAS].map(String) : [];
    aplicarContexto(dados, familiaId, dados.adminSistema === true, ids);
  }

  function aplicarContexto(dados, familiaId, admin, ids) {
    ESTADO.dadosUsuario = dados;
    ESTADO.familiaId = familiaId;
    ESTADO.adminSistema = admin;
    ESTADO.familiasHabilitadas = new Set(ids);
    ESTADO.habilitado = !!familiaId && ESTADO.familiasHabilitadas.has(familiaId);
    const podeVer = ESTADO.habilitado || ESTADO.adminSistema;
    if (podeVer) criarInterface();
    const menu = $("listalar-menu-comercial");
    if (menu) menu.hidden = !podeVer;
    if (!podeVer) fecharTela();
  }

  async function carregarFamiliasAdmin() {
    if (!ESTADO.adminSistema) return;
    const f = ESTADO.firebase;
    const snap = await f.getDocs(f.collection(f.db, "familias"));
    ESTADO.familiasAdmin = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.nome || a.id).localeCompare(String(b.nome || b.id), "pt-BR"));
    renderAdmin();
  }

  function renderAdmin() {
    const area = $("lc-admin-lista");
    if (!area) return;
    if (!ESTADO.familiasAdmin.length) return area.innerHTML = `<div class="lc-empty">Nenhuma família encontrada.</div>`;
    area.innerHTML = ESTADO.familiasAdmin.map((fam) => `<div class="lc-family"><div><strong>${escapar(fam.nome || "Família sem nome")}</strong><div class="lc-meta">${escapar(fam.criadoPorEmail || fam.donoId || fam.id)}</div></div><label><input type="checkbox" data-lc-familia="${escapar(fam.id)}" ${ESTADO.familiasHabilitadas.has(fam.id) ? "checked" : ""}> Liberar</label></div>`).join("");
  }

  async function salvarLiberacoes() {
    if (!ESTADO.adminSistema) return;
    const ids = [...document.querySelectorAll("[data-lc-familia]:checked")].map((el) => el.dataset.lcFamilia).filter(Boolean);
    const f = ESTADO.firebase;
    const btn = $("lc-admin-salvar");
    try {
      btn.disabled = true;
      await f.setDoc(f.doc(f.db, "configuracoes", "modulos"), {
        [CAMPO_FAMILIAS]: ids,
        comercialAtualizadoEm: f.serverTimestamp(),
        comercialAtualizadoPorUid: ESTADO.usuario?.uid || "",
        comercialAtualizadoPorEmail: ESTADO.usuario?.email || ""
      }, { merge: true });
      ESTADO.familiasHabilitadas = new Set(ids);
      ESTADO.habilitado = !!ESTADO.familiaId && ESTADO.familiasHabilitadas.has(ESTADO.familiaId);
      atualizarModo();
      renderAdmin();
      mostrarAviso("Liberações do Comercial atualizadas.", "ok");
    } catch (erro) {
      console.error(erro);
      mostrarAviso("Não foi possível salvar as liberações.", "erro");
    } finally { btn.disabled = false; }
  }

  function abrirTela() {
    if (!(ESTADO.habilitado || ESTADO.adminSistema)) return;
    criarInterface();
    $("listalar-comercial-tela").classList.add("aberta");
    document.body.style.overflow = "hidden";
    atualizarModo();
    if (ESTADO.adminSistema) carregarFamiliasAdmin().catch(console.error);
    renderizar();
  }

  function fecharTela() {
    $("listalar-comercial-tela")?.classList.remove("aberta");
    document.body.style.overflow = "";
  }

  function atualizarModo() {
    const admin = $("lc-admin");
    const operacao = $("lc-operacao");
    if (admin) admin.hidden = !ESTADO.adminSistema;
    if (operacao) operacao.hidden = !ESTADO.habilitado;
    if (ESTADO.habilitado) iniciarListeners();
    else pararListeners();
  }

  function iniciarListeners() {
    pararListeners();
    if (!ESTADO.habilitado) return;
    const f = ESTADO.firebase;
    carregando(true, "Carregando Comercial...");
    ESTADO.unsubscribeProdutos = f.onSnapshot(f.query(produtosRef(), f.orderBy("nome")), (snap) => {
      ESTADO.produtos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderizar();
    }, (erro) => { console.error(erro); mostrarAviso("Não foi possível carregar os produtos comerciais.", "erro"); });
    ESTADO.unsubscribeMovimentos = f.onSnapshot(f.query(movimentosRef(), f.orderBy("dataMs", "desc"), f.limit(180)), (snap) => {
      ESTADO.movimentos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      carregando(false);
      renderizar();
    }, (erro) => { console.error(erro); carregando(false); mostrarAviso("Não foi possível carregar o histórico comercial.", "erro"); });
  }

  async function cadastrarProduto(e) {
    e.preventDefault();
    if (!ESTADO.habilitado || ESTADO.salvando) return;
    const nome = normalizar($("lc-produto-nome").value);
    const custo = moeda($("lc-produto-custo").value);
    const venda = moeda($("lc-produto-venda").value);
    const estoque = Math.max(0, numero($("lc-produto-estoque").value));
    if (!nome) return mostrarAviso("Informe o nome do produto.", "erro");
    if (ESTADO.produtos.some((p) => normalizar(p.nome).toLowerCase() === nome.toLowerCase())) return mostrarAviso("Produto comercial já cadastrado.", "erro");
    const f = ESTADO.firebase;
    try {
      ESTADO.salvando = true;
      const ref = await f.addDoc(produtosRef(), {
        nome, custoMedio: custo, precoVenda: venda, estoque, ativo: true,
        criadoPorUid: ESTADO.usuario.uid, criadoEm: f.serverTimestamp(), atualizadoEm: f.serverTimestamp()
      });
      if (estoque > 0) await f.addDoc(movimentosRef(), {
        tipo: "compra", origem: "estoque_inicial", produtoId: ref.id, produtoNome: nome,
        quantidade: estoque, custoUnitario: custo, custoTotal: moeda(estoque * custo), valorUnitario: custo,
        valorTotal: moeda(estoque * custo), data: dataHoje(), dataMs: Date.now(), competencia: competenciaAtual(),
        usuarioId: ESTADO.usuario.uid, criadoEm: f.serverTimestamp()
      });
      $("lc-form-produto").reset(); $("lc-produto-estoque").value = "0";
      mostrarAviso("Produto comercial cadastrado.", "ok");
    } catch (erro) { console.error(erro); mostrarAviso("Não foi possível cadastrar o produto.", "erro"); }
    finally { ESTADO.salvando = false; }
  }

  function produtoAtual() {
    return ESTADO.produtos.find((p) => p.id === $("lc-mov-produto")?.value) || null;
  }

  function atualizarCamposMovimento() {
    const tipo = $("lc-tipo")?.value || "venda";
    const despesa = tipo === "despesa";
    $("lc-produto-wrap").hidden = despesa;
    $("lc-qtd-wrap").hidden = despesa;
    $("lc-despesa-wrap").hidden = !despesa;
    $("lc-valor-label").textContent = despesa ? "Valor da despesa" : "Valor unitário";
    const p = produtoAtual();
    if (despesa) $("lc-mov-valor").value = "";
    else if (p) $("lc-mov-valor").value = (tipo === "compra" ? numero(p.custoMedio) : numero(p.precoVenda)).toFixed(2);
  }

  async function registrarMovimento() {
    if (!ESTADO.habilitado || ESTADO.salvando) return;
    const tipo = $("lc-tipo").value;
    const f = ESTADO.firebase;
    const btn = $("lc-salvar-mov");
    try {
      ESTADO.salvando = true; btn.disabled = true; carregando(true, "Registrando movimentação...");
      if (tipo === "despesa") {
        const descricao = normalizar($("lc-despesa-desc").value);
        const valor = moeda($("lc-mov-valor").value);
        if (!descricao || valor <= 0) throw new Error("DESPESA_INVALIDA");
        await f.addDoc(movimentosRef(), { tipo, descricao, valorTotal: valor, data: dataHoje(), dataMs: Date.now(), competencia: competenciaAtual(), usuarioId: ESTADO.usuario.uid, criadoEm: f.serverTimestamp() });
        $("lc-despesa-desc").value = ""; $("lc-mov-valor").value = "";
        mostrarAviso("Despesa registrada.", "ok");
        return;
      }

      const p = produtoAtual();
      const quantidade = numero($("lc-mov-qtd").value);
      const valorUnitario = moeda($("lc-mov-valor").value);
      if (!p || quantidade <= 0 || valorUnitario < 0) throw new Error("MOVIMENTO_INVALIDO");
      const pRef = f.doc(produtosRef(), p.id);
      const mRef = f.doc(movimentosRef());
      await f.runTransaction(f.db, async (tx) => {
        const snap = await tx.get(pRef);
        if (!snap.exists()) throw new Error("PRODUTO_NAO_ENCONTRADO");
        const atual = snap.data();
        const estoqueAtual = numero(atual.estoque);
        const custoAtual = moeda(atual.custoMedio);
        if (tipo === "venda") {
          if (quantidade > estoqueAtual + 1e-9) throw new Error("ESTOQUE_INSUFICIENTE");
          const total = moeda(quantidade * valorUnitario);
          const custoTotal = moeda(quantidade * custoAtual);
          tx.update(pRef, { estoque: Math.max(0, estoqueAtual - quantidade), precoVenda: valorUnitario, atualizadoEm: f.serverTimestamp() });
          tx.set(mRef, { tipo, produtoId: p.id, produtoNome: atual.nome || p.nome, quantidade, custoUnitario: custoAtual, custoTotal, valorUnitario, valorTotal: total, lucroBruto: moeda(total - custoTotal), data: dataHoje(), dataMs: Date.now(), competencia: competenciaAtual(), usuarioId: ESTADO.usuario.uid, criadoEm: f.serverTimestamp() });
        } else {
          const novoEstoque = estoqueAtual + quantidade;
          const novoCusto = novoEstoque > 0 ? moeda((estoqueAtual * custoAtual + quantidade * valorUnitario) / novoEstoque) : valorUnitario;
          const total = moeda(quantidade * valorUnitario);
          tx.update(pRef, { estoque: novoEstoque, custoMedio: novoCusto, atualizadoEm: f.serverTimestamp() });
          tx.set(mRef, { tipo, produtoId: p.id, produtoNome: atual.nome || p.nome, quantidade, custoUnitario: valorUnitario, custoTotal: total, valorUnitario, valorTotal: total, custoMedioAnterior: custoAtual, custoMedioNovo: novoCusto, data: dataHoje(), dataMs: Date.now(), competencia: competenciaAtual(), usuarioId: ESTADO.usuario.uid, criadoEm: f.serverTimestamp() });
        }
      });
      $("lc-mov-qtd").value = "1";
      mostrarAviso(tipo === "venda" ? "Venda registrada." : "Compra para revenda registrada.", "ok");
    } catch (erro) {
      console.error(erro);
      mostrarAviso(erro?.message === "ESTOQUE_INSUFICIENTE" ? "Estoque insuficiente para esta venda." : "Não foi possível registrar a movimentação.", "erro");
    } finally { ESTADO.salvando = false; btn.disabled = false; carregando(false); }
  }

  function competencias() {
    const set = new Set([competenciaAtual()]);
    ESTADO.movimentos.forEach((m) => { if (/^\d{4}-\d{2}$/.test(String(m.competencia || ""))) set.add(m.competencia); });
    return [...set].sort((a, b) => b.localeCompare(a));
  }

  function movimentosFiltrados() {
    return ESTADO.periodo === "todos" ? [...ESTADO.movimentos] : ESTADO.movimentos.filter((m) => m.competencia === ESTADO.periodo);
  }

  function renderResumo() {
    const mov = movimentosFiltrados();
    const vendas = mov.filter((m) => m.tipo === "venda");
    const receita = moeda(vendas.reduce((s, m) => s + numero(m.valorTotal), 0));
    const custo = moeda(vendas.reduce((s, m) => s + numero(m.custoTotal), 0));
    const lucro = moeda(receita - custo);
    const despesas = moeda(mov.filter((m) => m.tipo === "despesa").reduce((s, m) => s + numero(m.valorTotal), 0));
    const resultado = moeda(lucro - despesas);
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;
    const estoqueCusto = moeda(ESTADO.produtos.reduce((s, p) => s + numero(p.estoque) * numero(p.custoMedio), 0));
    const estoqueVenda = moeda(ESTADO.produtos.reduce((s, p) => s + numero(p.estoque) * numero(p.precoVenda), 0));
    $("lc-receita").textContent = formatarMoeda(receita); $("lc-custo").textContent = formatarMoeda(custo); $("lc-lucro").textContent = formatarMoeda(lucro); $("lc-despesas").textContent = formatarMoeda(despesas); $("lc-resultado").textContent = formatarMoeda(resultado); $("lc-margem").textContent = `${margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`; $("lc-estoque-custo").textContent = formatarMoeda(estoqueCusto); $("lc-estoque-venda").textContent = formatarMoeda(estoqueVenda); $("lc-card-resultado").classList.toggle("neg", resultado < 0);
  }

  function renderProdutos() {
    const area = $("lc-produtos"); if (!area) return;
    const termo = normalizar(ESTADO.busca).toLowerCase();
    const lista = ESTADO.produtos.filter((p) => !termo || normalizar(p.nome).toLowerCase().includes(termo));
    if (!lista.length) return area.innerHTML = `<div class="lc-empty">Nenhum produto comercial cadastrado.</div>`;
    area.innerHTML = lista.map((p) => {
      const custo = moeda(p.custoMedio), venda = moeda(p.precoVenda), lucro = moeda(venda - custo);
      const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
      const markup = custo > 0 ? ((venda - custo) / custo) * 100 : 0;
      return `<article class="lc-item"><div class="lc-top"><strong>${escapar(p.nome)}</strong><span class="lc-badge">Estoque ${formatarNumero(p.estoque)}</span></div><div class="lc-values"><div class="lc-value"><span>Custo médio</span><strong>${formatarMoeda(custo)}</strong></div><div class="lc-value"><span>Preço venda</span><strong>${formatarMoeda(venda)}</strong></div><div class="lc-value"><span>Lucro/un.</span><strong>${formatarMoeda(lucro)}</strong></div><div class="lc-value"><span>Margem / Markup</span><strong>${margem.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% / ${markup.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong></div></div></article>`;
    }).join("");
  }

  function renderHistorico() {
    const area = $("lc-historico"); if (!area) return;
    const lista = movimentosFiltrados();
    if (!lista.length) return area.innerHTML = `<div class="lc-empty">Nenhuma movimentação neste período.</div>`;
    area.innerHTML = lista.map((m) => {
      const tipo = m.tipo || "movimento";
      const nome = tipo === "despesa" ? (m.descricao || "Despesa") : (m.produtoNome || "Produto");
      const detalhe = tipo === "despesa" ? formatarMoeda(m.valorTotal) : `${formatarNumero(m.quantidade)} × ${formatarMoeda(m.valorUnitario)} = ${formatarMoeda(m.valorTotal)}`;
      const extra = tipo === "venda" ? ` · lucro ${formatarMoeda(m.lucroBruto)}` : "";
      return `<article class="lc-item"><div class="lc-top"><strong>${escapar(nome)}</strong><span class="lc-badge ${escapar(tipo)}">${tipo === "venda" ? "Venda" : tipo === "compra" ? "Compra" : "Despesa"}</span></div><div class="lc-meta">${escapar(m.data || "")} · ${detalhe}${extra}</div></article>`;
    }).join("");
  }

  function renderSelectProduto() {
    const select = $("lc-mov-produto"); if (!select) return;
    const atual = select.value;
    select.innerHTML = ESTADO.produtos.length ? ESTADO.produtos.map((p) => `<option value="${escapar(p.id)}">${escapar(p.nome)} · ${formatarNumero(p.estoque)}</option>`).join("") : `<option value="">Cadastre um produto</option>`;
    if (ESTADO.produtos.some((p) => p.id === atual)) select.value = atual;
    atualizarCamposMovimento();
  }

  function renderPeriodo() {
    const select = $("lc-periodo"); if (!select) return;
    const comps = competencias();
    if (ESTADO.periodo !== "todos" && !comps.includes(ESTADO.periodo)) ESTADO.periodo = competenciaAtual();
    select.innerHTML = comps.map((c) => `<option value="${c}">${escapar(rotuloCompetencia(c))}</option>`).join("") + `<option value="todos">Todos os meses</option>`;
    select.value = ESTADO.periodo;
  }

  function renderizar() {
    if (!ESTADO.interfaceCriada) return;
    renderPeriodo(); renderResumo(); renderProdutos(); renderSelectProduto(); renderHistorico();
  }

  window.ListaLarComercial = Object.freeze({
    versao: VERSAO,
    abrir: abrirTela,
    fechar: fecharTela,
    estaLiberado: () => ESTADO.habilitado,
    obterFamiliaId: () => ESTADO.familiaId,
    obterProdutos: () => [...ESTADO.produtos],
    obterMovimentos: () => [...ESTADO.movimentos]
  });

  async function iniciar() {
    criarEstilos();
    const f = await carregarFirebase();
    f.onAuthStateChanged(f.auth, async (usuario) => {
      pararListeners();
      ESTADO.usuario = usuario || null;
      if (!usuario) { aplicarContexto(null, "", false, []); return; }
      try { await carregarContexto(usuario); }
      catch (erro) { console.error("ListaLar Comercial: acesso:", erro); aplicarContexto(null, "", false, []); }
    });
    console.log(`✅ Módulo Comercial carregado — versão ${VERSAO}`);
  }

  window.addEventListener("beforeunload", pararListeners);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => iniciar().catch(console.error), { once: true });
  else iniciar().catch(console.error);
})();
