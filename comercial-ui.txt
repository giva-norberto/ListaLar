// ============================================================
// ListaLar — Ajuste de interface do módulo Comercial
// Arquivo: comercial-ui.js
// Versão: 1.0.1
// ============================================================

(() => {
  "use strict";

  const VERSAO = "1.0.1";
  const $ = (id) => document.getElementById(id);
  let instalado = false;
  let abaAtual = "negocio";

  function estilos() {
    if ($("listalar-comercial-ui-estilos")) return;
    const style = document.createElement("style");
    style.id = "listalar-comercial-ui-estilos";
    style.textContent = `
      .lc-tabs{display:flex;gap:8px;margin:0 0 12px;padding:5px;border:1px solid #dbe4f0;border-radius:14px;background:#fff;box-shadow:0 4px 12px rgba(15,23,42,.05)}
      .lc-tab{flex:1;min-height:42px;border:0;border-radius:10px;background:transparent;color:#475569;font:inherit;font-weight:900;cursor:pointer}.lc-tab.ativa{background:#0f766e;color:#fff}.lc-tab[hidden]{display:none!important}
      .lc-painel[hidden]{display:none!important}
      .lc-bloqueio{margin-bottom:12px;padding:16px;border:1px solid #fdba74;border-radius:18px;background:#fff7ed;box-shadow:0 4px 14px rgba(15,23,42,.05)}
      .lc-bloqueio h2{margin:0 0 5px;font-size:17px;color:#9a3412}.lc-bloqueio p{margin:0 0 12px;color:#7c2d12;font-size:12px;line-height:1.45}.lc-bloqueio .lc-btn{background:#ea580c}
      .lc-bloqueio-status{margin-top:9px;color:#7c2d12;font-size:11px;font-weight:800}
      .lc-admin-resumo{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;padding:12px 14px;border:1px solid #c4b5fd;border-radius:14px;background:#faf5ff}.lc-admin-resumo strong{font-size:13px}.lc-admin-resumo span{display:block;margin-top:3px;color:#6d28d9;font-size:11px;font-weight:700}
      @media(max-width:720px){.lc-tabs{position:sticky;top:76px;z-index:4}.lc-admin-resumo{align-items:stretch;flex-direction:column}.lc-admin-resumo .lc-btn{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function estaLiberado() {
    return Boolean(window.ListaLarComercial?.estaLiberado?.());
  }

  function familiaAtual() {
    return String(window.ListaLarComercial?.obterFamiliaId?.() || "");
  }

  function ehAdminVisivel() {
    const admin = $("lc-admin");
    return Boolean(admin && !admin.hidden);
  }

  function mostrarAba(nome) {
    abaAtual = nome === "admin" ? "admin" : "negocio";
    const negocio = $("lc-painel-negocio");
    const admin = $("lc-painel-admin");
    const btnNegocio = $("lc-tab-negocio");
    const btnAdmin = $("lc-tab-admin");
    if (negocio) negocio.hidden = abaAtual !== "negocio";
    if (admin) admin.hidden = abaAtual !== "admin";
    btnNegocio?.classList.toggle("ativa", abaAtual === "negocio");
    btnAdmin?.classList.toggle("ativa", abaAtual === "admin");
  }

  function montarEstrutura() {
    if (instalado) return true;
    const main = document.querySelector("#listalar-comercial-tela .lc-main");
    const loading = $("lc-loading");
    const periodo = $("lc-periodo")?.parentElement;
    const grid = document.querySelector("#listalar-comercial-tela .lc-grid");
    const admin = $("lc-admin");
    const operacao = $("lc-operacao");
    if (!main || !loading || !periodo || !grid || !admin || !operacao) return false;

    estilos();

    const tabs = document.createElement("nav");
    tabs.className = "lc-tabs";
    tabs.id = "lc-tabs";
    tabs.innerHTML = `
      <button id="lc-tab-negocio" class="lc-tab ativa" type="button">📊 Negócio</button>
      <button id="lc-tab-admin" class="lc-tab" type="button">🔐 Liberações</button>
    `;

    const painelNegocio = document.createElement("div");
    painelNegocio.id = "lc-painel-negocio";
    painelNegocio.className = "lc-painel";

    const bloqueio = document.createElement("section");
    bloqueio.id = "lc-bloqueio-familia";
    bloqueio.className = "lc-bloqueio";
    bloqueio.hidden = true;
    bloqueio.innerHTML = `
      <h2>Comercial ainda não liberado para esta família</h2>
      <p>A tela operacional já está pronta, mas esta família precisa ser liberada explicitamente. O plano Full não ativa o Comercial sozinho.</p>
      <button id="lc-liberar-atual" class="lc-btn" type="button">Liberar esta família e abrir o Comercial</button>
      <div id="lc-bloqueio-status" class="lc-bloqueio-status"></div>
    `;

    const painelAdmin = document.createElement("div");
    painelAdmin.id = "lc-painel-admin";
    painelAdmin.className = "lc-painel";
    painelAdmin.hidden = true;

    main.insertBefore(tabs, loading.nextSibling);
    painelNegocio.append(periodo, grid, bloqueio, operacao);
    painelAdmin.appendChild(admin);
    main.insertBefore(painelNegocio, tabs.nextSibling);
    main.insertBefore(painelAdmin, painelNegocio.nextSibling);

    $("lc-tab-negocio").addEventListener("click", () => mostrarAba("negocio"));
    $("lc-tab-admin").addEventListener("click", () => mostrarAba("admin"));
    $("lc-liberar-atual").addEventListener("click", liberarFamiliaAtual);

    instalado = true;
    sincronizar();
    return true;
  }

  async function liberarFamiliaAtual() {
    const id = familiaAtual();
    const botao = $("lc-liberar-atual");
    const status = $("lc-bloqueio-status");
    if (!id || !ehAdminVisivel()) return;

    mostrarAba("admin");
    if (status) status.textContent = "Localizando a família...";

    for (let tentativa = 0; tentativa < 30; tentativa += 1) {
      const seletor = `[data-lc-familia="${CSS.escape(id)}"]`;
      const check = document.querySelector(seletor);
      if (check) {
        check.checked = true;
        const salvar = $("lc-admin-salvar");
        if (!salvar) return;
        if (botao) botao.disabled = true;
        salvar.click();
        if (status) status.textContent = "Salvando liberação...";

        for (let espera = 0; espera < 50; espera += 1) {
          await new Promise((resolve) => setTimeout(resolve, 120));
          if (estaLiberado()) {
            if (status) status.textContent = "Família liberada.";
            sincronizar();
            mostrarAba("negocio");
            if (botao) botao.disabled = false;
            return;
          }
        }
        if (status) status.textContent = "A liberação não foi confirmada. Verifique a mensagem exibida pelo aplicativo.";
        if (botao) botao.disabled = false;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    if (status) status.textContent = "Não foi possível localizar esta família na lista administrativa.";
  }

  function sincronizar() {
    if (!instalado) return;
    const admin = ehAdminVisivel();
    const liberado = estaLiberado();
    const tabAdmin = $("lc-tab-admin");
    const bloqueio = $("lc-bloqueio-familia");
    const operacao = $("lc-operacao");
    const periodo = $("lc-periodo")?.parentElement;
    const grid = document.querySelector("#listalar-comercial-tela .lc-grid");

    if (tabAdmin) tabAdmin.hidden = !admin;
    if (!admin && abaAtual === "admin") mostrarAba("negocio");

    if (bloqueio) bloqueio.hidden = liberado;
    if (operacao) operacao.hidden = !liberado;
    if (periodo) periodo.hidden = !liberado;
    if (grid) grid.hidden = !liberado;

    if (!liberado && admin) {
      const status = $("lc-bloqueio-status");
      if (status && !status.textContent) status.textContent = "Você pode liberar somente esta família pelo botão acima, ou gerenciar todas na aba Liberações.";
    }
  }

  function observar() {
    const observer = new MutationObserver(() => {
      if (!instalado) montarEstrutura();
      if (instalado) sincronizar();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class"] });

    const timer = setInterval(() => {
      if (!instalado) montarEstrutura();
      if (instalado) sincronizar();
    }, 700);

    window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
  }

  observar();
  montarEstrutura();
  console.log(`✅ Interface Comercial ajustada — versão ${VERSAO}`);
})();
