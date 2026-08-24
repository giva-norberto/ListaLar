// ============================================================
// ListaLar — Manual do módulo Comercial
// Arquivo: comercial-ajuda.js
// Versão: 1.1.1
// ============================================================

(() => {
  "use strict";

  const VERSAO = "1.1.1";
  const ID_MODAL = "comercial-ajuda-modal";
  const ID_ESTILO = "comercial-ajuda-estilos";

  const TOPICOS = [
    {
      id: "visao-geral",
      icone: "📈",
      titulo: "Visão geral",
      descricao: "Entenda a área Comercial e o que fica separado do uso doméstico.",
      palavras: "comercial modulo separado lista estoque casa domestico",
      conteudo: `
        <h2>📈 Visão geral do Comercial</h2>
        <p>O Comercial é uma área independente do ListaLar doméstico. Ele serve para controlar produtos comprados para revenda, vendas, despesas, estoque comercial e resultado do negócio.</p>
        <div class="caj-destaque"><strong>Importante:</strong> produtos e movimentações do Comercial não alteram a Lista nem o Estoque da casa.</div>
        <h3>Abas disponíveis</h3>
        <ul>
          <li><strong>Dashboard:</strong> visão financeira do negócio.</li>
          <li><strong>Produtos:</strong> cadastro dos itens de revenda.</li>
          <li><strong>Compras:</strong> entrada de mercadoria e atualização do custo médio.</li>
          <li><strong>Vendas:</strong> saída de estoque e cálculo de lucro.</li>
          <li><strong>Despesas:</strong> gastos do negócio, como frete e taxas.</li>
          <li><strong>Estoque:</strong> quantidade disponível dos produtos comerciais.</li>
          <li><strong>Histórico:</strong> compras, vendas e despesas registradas.</li>
        </ul>
      `
    },
    {
      id: "dashboard",
      icone: "📊",
      titulo: "Dashboard",
      descricao: "Veja faturamento, lucro, despesas, margem e valor do estoque.",
      palavras: "dashboard faturamento custo lucro despesas resultado margem estoque valor",
      conteudo: `
        <h2>📊 Dashboard</h2>
        <p>O Dashboard resume o desempenho do Comercial no período selecionado.</p>
        <div class="caj-cards">
          <div><strong>Faturamento</strong><span>Total vendido no período.</span></div>
          <div><strong>Custo vendido</strong><span>Custo histórico dos produtos que saíram nas vendas.</span></div>
          <div><strong>Lucro bruto</strong><span>Faturamento menos custo vendido.</span></div>
          <div><strong>Despesas</strong><span>Fretes, taxas, combustível, embalagens e outros gastos registrados.</span></div>
          <div><strong>Resultado</strong><span>Lucro bruto menos despesas.</span></div>
          <div><strong>Margem bruta</strong><span>Percentual do lucro bruto sobre o faturamento.</span></div>
          <div><strong>Estoque a custo</strong><span>Valor atual do estoque usando o custo médio.</span></div>
          <div><strong>Estoque a venda</strong><span>Valor potencial do estoque usando o preço de venda cadastrado.</span></div>
        </div>
        <p>Use o seletor de período para consultar um mês específico ou todos os períodos disponíveis.</p>
      `
    },
    {
      id: "produtos",
      icone: "🏷️",
      titulo: "Cadastrar produtos",
      descricao: "Cadastre nome, custo inicial, preço de venda e estoque inicial.",
      palavras: "produto cadastro custo preco venda estoque inicial nome",
      conteudo: `
        <h2>🏷️ Cadastro de produtos</h2>
        <p>Abra <strong>Produtos</strong> para cadastrar um item de revenda.</p>
        <ol>
          <li>Informe o <strong>nome do produto</strong>.</li>
          <li>Informe o <strong>custo unitário inicial</strong>.</li>
          <li>Informe o <strong>preço de venda de referência</strong>.</li>
          <li>Informe o <strong>estoque inicial</strong>, se já houver mercadoria.</li>
          <li>Confira os dados e toque em <strong>Cadastrar</strong>.</li>
        </ol>
        <div class="caj-aviso">O preço cadastrado é uma referência. O valor real de uma compra ou venda pode ser diferente e deve ser informado na própria operação.</div>
        <p>Quando existe estoque inicial, o sistema registra essa entrada para que estoque e histórico permaneçam coerentes.</p>
      `
    },
    {
      id: "voz",
      icone: "🎙️",
      titulo: "Cadastro por voz",
      descricao: "Fale produto, custo, preço e estoque em uma única frase.",
      palavras: "voz microfone falar produto custo preco estoque reconhecimento",
      conteudo: `
        <h2>🎙️ Cadastro por voz</h2>
        <p>Na tela de Produtos, toque no microfone ao lado do nome do produto e fale os dados naturalmente.</p>
        <div class="caj-exemplo">“Produto Coca-Cola 2 litros, custo 6 e 50, preço 9 e 90, estoque 12.”</div>
        <p>O Comercial tenta separar a fala em:</p>
        <ul>
          <li>Produto</li>
          <li>Custo unitário</li>
          <li>Preço de venda</li>
          <li>Estoque inicial</li>
        </ul>
        <div class="caj-destaque"><strong>Segurança:</strong> o microfone não cadastra sozinho. Ele preenche os campos para conferência e você decide quando tocar em Cadastrar.</div>
        <p>Pesos e tamanhos que fazem parte do nome, como “800 g” ou “2 litros”, podem permanecer no nome do produto.</p>
      `
    },
    {
      id: "compras",
      icone: "📥",
      titulo: "Registrar compras",
      descricao: "Dê entrada na mercadoria e atualize o custo médio ponderado.",
      palavras: "compra entrada mercadoria quantidade custo medio ponderado estoque",
      conteudo: `
        <h2>📥 Registrar uma compra</h2>
        <p>Use esta tela quando entrar mercadoria para revenda.</p>
        <ol>
          <li>Selecione o produto.</li>
          <li>Informe a quantidade comprada.</li>
          <li>Informe o custo unitário real daquela compra.</li>
          <li>Confira a data.</li>
          <li>Toque em <strong>Registrar compra</strong>.</li>
        </ol>
        <p>A compra aumenta o estoque e recalcula o <strong>custo médio ponderado</strong>.</p>
        <div class="caj-exemplo"><strong>Exemplo:</strong> se havia 5 unidades a R$ 6,00 e entram mais 5 a R$ 7,00, o novo custo médio passa a R$ 6,50.</div>
      `
    },
    {
      id: "vendas",
      icone: "💰",
      titulo: "Registrar vendas",
      descricao: "Baixe o estoque e registre o valor real da venda.",
      palavras: "venda preco unitario baixa estoque lucro custo historico",
      conteudo: `
        <h2>💰 Registrar uma venda</h2>
        <ol>
          <li>Selecione o produto vendido.</li>
          <li>Informe a quantidade.</li>
          <li>Informe o preço unitário real da venda.</li>
          <li>Confira a data.</li>
          <li>Toque em <strong>Registrar venda</strong>.</li>
        </ol>
        <p>O preço de venda do cadastro aparece como referência, mas pode ser alterado na operação.</p>
        <p>A venda reduz o estoque e preserva o custo utilizado naquele momento para que o lucro histórico não mude quando houver compras futuras.</p>
        <div class="caj-aviso">O sistema não deve permitir que uma venda deixe o estoque comercial negativo.</div>
      `
    },
    {
      id: "despesas",
      icone: "🧾",
      titulo: "Registrar despesas",
      descricao: "Lance gastos do negócio que reduzem o resultado.",
      palavras: "despesa frete embalagem taxa combustivel gasto resultado",
      conteudo: `
        <h2>🧾 Despesas do negócio</h2>
        <p>Registre aqui gastos que pertencem ao Comercial, por exemplo:</p>
        <ul>
          <li>Frete</li>
          <li>Embalagens</li>
          <li>Taxas</li>
          <li>Combustível</li>
          <li>Outros custos operacionais</li>
        </ul>
        <p>Informe a descrição, o valor e a data. As despesas aparecem no Dashboard e reduzem o <strong>Resultado</strong>.</p>
        <div class="caj-destaque">Despesas do Comercial não são lançadas nos Gastos domésticos da família.</div>
      `
    },
    {
      id: "estoque",
      icone: "📦",
      titulo: "Estoque comercial",
      descricao: "Acompanhe quantidade, custo médio, preço e margem dos itens de revenda.",
      palavras: "estoque comercial quantidade custo medio preco margem markup produto",
      conteudo: `
        <h2>📦 Estoque comercial</h2>
        <p>Esta aba mostra somente os produtos de revenda.</p>
        <p>Para cada produto você pode acompanhar a quantidade disponível, custo médio, preço de venda, lucro por unidade, margem e markup.</p>
        <div class="caj-destaque"><strong>Separação de dados:</strong> movimentar este estoque não altera o Estoque doméstico do ListaLar.</div>
        <p>As entradas vêm das compras registradas. As saídas vêm das vendas registradas.</p>
      `
    },
    {
      id: "historico",
      icone: "🕘",
      titulo: "Histórico",
      descricao: "Consulte compras, vendas e despesas em ordem de movimentação.",
      palavras: "historico movimentacoes compras vendas despesas data registro",
      conteudo: `
        <h2>🕘 Histórico de movimentações</h2>
        <p>O Histórico reúne as operações registradas no Comercial.</p>
        <ul>
          <li><strong>Compra:</strong> mostra quantidade, custo unitário e valor total.</li>
          <li><strong>Venda:</strong> mostra quantidade, preço unitário, receita e lucro bruto.</li>
          <li><strong>Despesa:</strong> mostra descrição e valor.</li>
        </ul>
        <p>Use o histórico para conferir de onde vieram os números apresentados no Dashboard.</p>
      `
    },
    {
      id: "precos",
      icone: "🏷️",
      titulo: "Custo, preço e margem",
      descricao: "Entenda a diferença entre preço cadastrado e valor real da operação.",
      palavras: "custo preco margem markup valor real referencia lucro",
      conteudo: `
        <h2>🏷️ Custo, preço e margem</h2>
        <h3>Preço de venda cadastrado</h3>
        <p>É o valor de referência usado para facilitar novas vendas. Ele não trava o valor cobrado.</p>
        <h3>Custo médio</h3>
        <p>É calculado a partir das compras reais e pode mudar quando entra mercadoria com outro custo.</p>
        <h3>Valor real da operação</h3>
        <p>Em cada compra ou venda, informe o valor realmente praticado naquela operação.</p>
        <div class="caj-exemplo"><strong>Exemplo:</strong> um produto pode ter preço padrão de R$ 10,00 e ser vendido por R$ 9,50 ou R$ 11,00 em uma venda específica.</div>
      `
    },
    {
      id: "acesso",
      icone: "🔐",
      titulo: "Acesso e liberação",
      descricao: "Entenda o acesso pessoal do administrador e a liberação por família.",
      palavras: "acesso familia liberar admin administrador modulo full permissao",
      conteudo: `
        <h2>🔐 Acesso ao Comercial</h2>
        <p>O Comercial é um módulo separado e não é liberado automaticamente para todas as famílias.</p>
        <ul>
          <li>O administrador do sistema possui acesso pessoal ao Comercial.</li>
          <li>Esse acesso pessoal não libera automaticamente os outros membros da família do administrador.</li>
          <li>Uma família comum só recebe o Comercial quando for explicitamente habilitada na administração do módulo.</li>
        </ul>
        <div class="caj-destaque">A liberação por família fica na administração e não faz parte da tela operacional do Comercial.</div>
      `
    },
    {
      id: "atualizacoes",
      icone: "🔄",
      titulo: "Atualizações do app",
      descricao: "Saiba como receber versões novas no aplicativo instalado.",
      palavras: "atualizacao versao pwa instalado cache nova versao",
      conteudo: `
        <h2>🔄 Atualizações do aplicativo</h2>
        <p>Quando uma nova versão do ListaLar é publicada, o aplicativo instalado pode avisar que existe uma atualização disponível.</p>
        <p>Instale a atualização para receber correções e recursos novos do Comercial.</p>
        <div class="caj-aviso">Se uma tela parecer antiga depois de uma atualização, feche e abra novamente o aplicativo após instalar a nova versão.</div>
        <p>Manual do Comercial: versão ${VERSAO}.</p>
      `
    }
  ];

  let topicoAtual = "";
  let overflowAnterior = "";
  let focoAnterior = null;

  function normalizar(texto) {
    return String(texto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function criarEstilos() {
    if (document.getElementById(ID_ESTILO)) return;

    const style = document.createElement("style");
    style.id = ID_ESTILO;
    style.textContent = `
      .caj-overlay{position:fixed;inset:0;z-index:30000;display:none;background:rgba(15,23,42,.58);backdrop-filter:blur(4px);padding:12px}.caj-overlay.aberta{display:flex;align-items:center;justify-content:center}.caj-modal{width:min(100%,920px);max-height:min(92vh,900px);display:flex;flex-direction:column;overflow:hidden;border-radius:22px;background:#f8fafc;box-shadow:0 24px 70px rgba(15,23,42,.35);color:#172033}.caj-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;background:linear-gradient(135deg,#0f766e,#0d9488);color:#fff}.caj-head h1{margin:0;font-size:20px}.caj-head p{margin:3px 0 0;font-size:11px;opacity:.9}.caj-close{width:42px;height:42px;border:0;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font-size:24px;font-weight:900;cursor:pointer}.caj-body{overflow:auto;padding:14px}.caj-search{width:100%;min-height:44px;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;background:#fff;font:inherit;margin-bottom:12px}.caj-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.caj-topic{display:flex;align-items:flex-start;gap:10px;width:100%;padding:13px;border:1px solid #dbe4ea;border-radius:14px;background:#fff;text-align:left;color:#172033;cursor:pointer}.caj-topic:hover{border-color:#99f6e4}.caj-topic-icone{font-size:23px;line-height:1}.caj-topic strong{display:block;font-size:13px}.caj-topic span{display:block;margin-top:4px;color:#64748b;font-size:11px;line-height:1.4}.caj-empty{padding:24px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;text-align:center;background:#fff}.caj-content{padding:2px 2px 10px;line-height:1.55}.caj-content h2{margin:2px 0 10px;font-size:21px}.caj-content h3{margin:17px 0 6px;font-size:15px}.caj-content p{margin:8px 0;color:#475569;font-size:13px}.caj-content ul,.caj-content ol{margin:8px 0;padding-left:21px;color:#334155;font-size:13px}.caj-content li{margin:6px 0}.caj-voltar{margin-bottom:12px;border:0;border-radius:11px;padding:9px 13px;background:#e2e8f0;color:#334155;font-weight:900;cursor:pointer}.caj-destaque,.caj-aviso,.caj-exemplo{margin:12px 0;padding:12px;border-radius:12px;font-size:12px;line-height:1.5}.caj-destaque{background:#ecfdf5;border:1px solid #a7f3d0;color:#166534}.caj-aviso{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412}.caj-exemplo{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}.caj-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.caj-cards>div{padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fff}.caj-cards strong{display:block;font-size:12px}.caj-cards span{display:block;margin-top:4px;color:#64748b;font-size:11px;line-height:1.4}@media(max-width:640px){.caj-overlay{padding:0}.caj-modal{width:100%;height:100%;max-height:none;border-radius:0}.caj-grid,.caj-cards{grid-template-columns:1fr}.caj-body{padding:12px}}
    `;
    document.head.appendChild(style);
  }

  function criarModal() {
    if (document.getElementById(ID_MODAL)) return;
    criarEstilos();

    const overlay = document.createElement("div");
    overlay.id = ID_MODAL;
    overlay.className = "caj-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "caj-titulo");
    overlay.innerHTML = `
      <section class="caj-modal">
        <header class="caj-head">
          <div><h1 id="caj-titulo">❓ Manual do Comercial</h1><p>Todos os recursos do módulo em um só lugar.</p></div>
          <button id="caj-fechar" class="caj-close" type="button" aria-label="Fechar manual">×</button>
        </header>
        <div id="caj-body" class="caj-body"></div>
      </section>
    `;

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) fechar();
    });

    document.body.appendChild(overlay);
    document.getElementById("caj-fechar").addEventListener("click", fechar);
  }

  function renderLista(filtro = "") {
    topicoAtual = "";
    const body = document.getElementById("caj-body");
    if (!body) return;

    const busca = normalizar(filtro).trim();
    const encontrados = TOPICOS.filter((topico) => {
      const texto = normalizar(`${topico.titulo} ${topico.descricao} ${topico.palavras}`);
      return !busca || texto.includes(busca);
    });

    body.innerHTML = `
      <input id="caj-busca" class="caj-search" type="search" placeholder="🔎 Buscar no manual" value="${String(filtro || "").replaceAll("&", "&amp;").replaceAll('"', "&quot;")}">
      <div id="caj-topicos" class="caj-grid">
        ${encontrados.length ? encontrados.map((topico) => `
          <button class="caj-topic" type="button" data-ajuda-topico="${topico.id}">
            <span class="caj-topic-icone">${topico.icone}</span>
            <span><strong>${topico.titulo}</strong><span>${topico.descricao}</span></span>
          </button>
        `).join("") : `<div class="caj-empty">Nenhum assunto encontrado.</div>`}
      </div>
    `;

    const campo = document.getElementById("caj-busca");
    campo?.addEventListener("input", () => renderLista(campo.value));

    body.querySelectorAll("[data-ajuda-topico]").forEach((botao) => {
      botao.addEventListener("click", () => abrirTopico(botao.dataset.ajudaTopico));
    });
  }

  function abrirTopico(id) {
    const topico = TOPICOS.find((item) => item.id === id);
    const body = document.getElementById("caj-body");
    if (!topico || !body) return;

    topicoAtual = id;
    body.innerHTML = `
      <button id="caj-voltar" class="caj-voltar" type="button">← Todos os assuntos</button>
      <article class="caj-content">${topico.conteudo}</article>
    `;
    document.getElementById("caj-voltar")?.addEventListener("click", () => renderLista());
    body.scrollTop = 0;
  }

  function abrir() {
    criarModal();
    const overlay = document.getElementById(ID_MODAL);
    if (!overlay) return;

    focoAnterior = document.activeElement;
    overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    renderLista();
    overlay.classList.add("aberta");
    document.getElementById("caj-busca")?.focus();
  }

  function fechar() {
    const overlay = document.getElementById(ID_MODAL);
    if (!overlay?.classList.contains("aberta")) return;

    overlay.classList.remove("aberta");
    document.body.style.overflow = overflowAnterior;
    topicoAtual = "";
    if (focoAnterior instanceof HTMLElement) focoAnterior.focus();
  }

  function instalar() {
    const botao = document.getElementById("btnAjudaComercial");
    if (!botao) return;
    botao.addEventListener("click", abrir);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") fechar();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", instalar, { once: true });
  } else {
    instalar();
  }

  console.log(`✅ Manual Comercial ${VERSAO}`);
})();
