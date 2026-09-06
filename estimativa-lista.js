// ==========================================
// ListaLar - Estimativa de valor da lista
// Versão: 1.3.0
//
// Objetivos:
// - manter o quadro de estimativa visível sempre que houver lista;
// - somar somente itens com preço histórico reconhecido;
// - reconhecer descrições fiscais completas ou abreviadas;
// - evitar falsos positivos com nível mínimo de confiança;
// - marcar discretamente com "R$" somente as linhas reconhecidas.
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
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const ID_ESTILO = "listalar-estimativa-lista-estilos";
const ID_CARD = "listalar-estimativa-lista";
const ID_AREA_LISTA = "listaCompras";
const CLASSE_INDICADOR = "listalar-preco-historico-ok";
const MAXIMO_GASTOS_HISTORICOS = 120;
const MAXIMO_TENTATIVAS_FIREBASE = 100;
const INTERVALO_FIREBASE = 50;

const PALAVRAS_IGNORADAS = new Set([
  "DE", "DA", "DO", "DAS", "DOS", "E", "EM", "COM", "SEM", "TIPO",
  "UN", "UND", "UNID", "UNIDADE", "UNIDADES", "KG", "KGS", "QUILO", "QUILOS",
  "G", "GR", "GRS", "L", "LT", "LTS", "LITRO", "LITROS", "ML",
  "PCT", "PCTE", "PACOTE", "PACOTES", "CX", "CAIXA", "CAIXAS",
  "BDJ", "BANDEJA", "LATA", "LATAS", "VD", "VIDRO", "FR", "FRASCO"
]);

let familiaIdAtual = "";
let produtos = [];
let itensHistoricos = [];
let mapaExato = new Map();
let unsubscribeProdutos = null;
let unsubscribeGastos = null;
let observadorLista = null;
let historicoPronto = false;
let carregandoHistorico = false;
let cargaHistoricoPendente = false;
let geracaoHistorico = 0;
let renderIndicadoresPendente = false;

function obterAplicativo() {
  return getApps().length ? getApp() : null;
}

async function aguardarAplicativo() {
  for (let tentativa = 0; tentativa < MAXIMO_TENTATIVAS_FIREBASE; tentativa += 1) {
    const app = obterAplicativo();
    if (app) return app;
    await new Promise((resolve) => window.setTimeout(resolve, INTERVALO_FIREBASE));
  }

  throw new Error("Firebase do ListaLar não foi inicializado.");
}

function numeroSeguro(valor, padrao = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : padrao;
}

function arredondarMoeda(valor) {
  return Math.round((numeroSeguro(valor) + Number.EPSILON) * 100) / 100;
}

function formatarMoeda(valor) {
  return arredondarMoeda(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function normalizarNome(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function singularBasico(token) {
  const texto = String(token || "");
  if (texto.length > 4 && texto.endsWith("S")) return texto.slice(0, -1);
  return texto;
}

function tokenEhMedida(token) {
  const texto = String(token || "");
  return (
    /^\d+(?:KG|G|GR|ML|L|LT|UN|UND|PCT|CX)$/.test(texto) ||
    /^\d+$/.test(texto)
  );
}

function tokensRelevantes(valor) {
  return normalizarNome(valor)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !PALAVRAS_IGNORADAS.has(token))
    .filter((token) => !tokenEhMedida(token))
    .filter((token) => token.length >= 2);
}

function distanciaLevenshtein(a, b) {
  const textoA = String(a || "");
  const textoB = String(b || "");

  if (textoA === textoB) return 0;
  if (!textoA.length) return textoB.length;
  if (!textoB.length) return textoA.length;

  const anterior = Array.from({ length: textoB.length + 1 }, (_, i) => i);
  const atual = new Array(textoB.length + 1);

  for (let i = 1; i <= textoA.length; i += 1) {
    atual[0] = i;

    for (let j = 1; j <= textoB.length; j += 1) {
      const custo = textoA[i - 1] === textoB[j - 1] ? 0 : 1;
      atual[j] = Math.min(
        atual[j - 1] + 1,
        anterior[j] + 1,
        anterior[j - 1] + custo
      );
    }

    for (let j = 0; j <= textoB.length; j += 1) anterior[j] = atual[j];
  }

  return anterior[textoB.length];
}

function prefixoComum(a, b) {
  const limite = Math.min(a.length, b.length);
  let quantidade = 0;

  while (quantidade < limite && a[quantidade] === b[quantidade]) {
    quantidade += 1;
  }

  return quantidade;
}

function similaridadeToken(tokenLista, tokenFiscal) {
  const a = singularBasico(tokenLista);
  const b = singularBasico(tokenFiscal);

  if (!a || !b) return 0;
  if (a === b) return 1;

  const menor = a.length <= b.length ? a : b;
  const maior = a.length <= b.length ? b : a;

  // Abreviação de nota fiscal: FEIJ/FEIJAO, ARR/ARROZ, PAP/PAPEL, HIG/HIGIENICO.
  if (maior.startsWith(menor)) {
    if (menor.length >= 4) return 0.90;
    if (menor.length === 3 && maior.length >= 5) return 0.76;
  }

  const comum = prefixoComum(a, b);
  const proporcaoPrefixo = comum / Math.max(a.length, b.length);

  // Variações próximas da mesma raiz: DENTE/DENTAL, FRANG/FRANGO etc.
  if (comum >= 4 && proporcaoPrefixo >= 0.60) return 0.74;

  const distancia = distanciaLevenshtein(a, b);
  const maiorComprimento = Math.max(a.length, b.length);

  if (maiorComprimento >= 5 && distancia === 1) return 0.86;
  if (maiorComprimento >= 7 && distancia === 2) return 0.72;

  return 0;
}

function nomeItemHistorico(item) {
  return String(
    item?.produtoNome ||
    item?.descricao ||
    item?.descricaoEditada ||
    item?.descricaoOriginal ||
    item?.nome ||
    ""
  ).trim();
}

function precoUnitarioItem(item) {
  let preco = numeroSeguro(
    item?.precoUnitario ??
    item?.valorUnitario ??
    item?.precoCompra ??
    item?.preco,
    0
  );

  if (preco > 0) return arredondarMoeda(preco);

  const quantidade = numeroSeguro(
    item?.quantidade ?? item?.qtd ?? item?.quantidadeComprada,
    0
  );
  const total = numeroSeguro(item?.valorTotal ?? item?.total ?? item?.subtotal, 0);

  if (quantidade > 0 && total > 0) preco = total / quantidade;
  return preco > 0 ? arredondarMoeda(preco) : 0;
}

function comprarQtd(produto) {
  return Math.max(
    0,
    numeroSeguro(produto?.minimo) - numeroSeguro(produto?.estoque)
  );
}

function qtdParaLista(produto) {
  if (produto?.manualLista === true && comprarQtd(produto) === 0) {
    return Math.max(1, numeroSeguro(produto?.qtdManual, 1));
  }

  return comprarQtd(produto);
}

function produtoEstaNaLista(produto) {
  return produto?.manualLista === true || (
    produto?.listaAutomatica === true && comprarQtd(produto) > 0
  );
}

function quantidadeAtualDaLista(produto) {
  const sugerido = qtdParaLista(produto);
  const informada = numeroSeguro(produto?.qtdComprada, 0);
  return Math.max(0, informada || sugerido);
}

function criarEstilos() {
  if (document.getElementById(ID_ESTILO)) return;

  const estilo = document.createElement("style");
  estilo.id = ID_ESTILO;
  estilo.textContent = `
    #${ID_CARD} {
      margin: 0 0 10px;
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      padding: 10px 12px;
      background: #eff6ff;
    }

    #${ID_CARD}[hidden] { display: none !important; }

    #${ID_CARD} .estimativa-titulo {
      color: #1e3a8a;
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .03em;
    }

    #${ID_CARD} .estimativa-valor {
      margin-top: 3px;
      color: #172033;
      font-size: 24px;
      line-height: 1.05;
      font-weight: 900;
    }

    #${ID_CARD} .estimativa-info {
      margin-top: 5px;
      color: #64748b;
      font-size: 10.5px;
      line-height: 1.3;
      font-weight: 800;
    }

    .${CLASSE_INDICADOR} {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: 6px;
      padding: 1px 5px;
      min-height: 17px;
      border-radius: 999px;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
      font-size: 9px;
      line-height: 1;
      font-weight: 900;
      vertical-align: middle;
      opacity: .82;
    }
  `;

  document.head.appendChild(estilo);
}

function garantirCard() {
  criarEstilos();

  let card = document.getElementById(ID_CARD);
  if (card) return card;

  const telaLista = document.getElementById("lista");
  const resumo = telaLista?.querySelector(".summary");
  if (!telaLista || !resumo) return null;

  card = document.createElement("div");
  card.id = ID_CARD;
  card.hidden = true;
  card.setAttribute("aria-live", "polite");
  card.innerHTML = `
    <div class="estimativa-titulo">Estimativa da compra</div>
    <div class="estimativa-valor">Calculando...</div>
    <div class="estimativa-info"></div>
  `;

  resumo.insertAdjacentElement("afterend", card);
  return card;
}

function chaveExataProdutoId(id) {
  return `ID:${String(id || "").trim()}`;
}

function chaveExataNome(nome) {
  return `NOME:${normalizarNome(nome)}`;
}

function pontuarCorrespondencia(produto, historico) {
  const nomeLista = normalizarNome(produto?.nome);
  const nomeFiscal = historico?.nomeNormalizado || "";
  const tokensLista = tokensRelevantes(produto?.nome);
  const tokensFiscal = historico?.tokens || [];

  if (!nomeLista || !nomeFiscal || !tokensLista.length || !tokensFiscal.length) return 0;
  if (nomeLista === nomeFiscal) return 1;

  // Nome de uma palavra: aceita nome completo ou abreviação fiscal forte.
  if (tokensLista.length === 1) {
    let melhor = 0;

    for (const tokenFiscal of tokensFiscal) {
      melhor = Math.max(melhor, similaridadeToken(tokensLista[0], tokenFiscal));
    }

    return melhor >= 0.74 ? melhor : 0;
  }

  // Nome composto: cada conceito relevante da lista precisa encontrar
  // uma palavra correspondente na descrição fiscal.
  const usados = new Set();
  let soma = 0;

  for (const tokenLista of tokensLista) {
    let melhorIndice = -1;
    let melhorSimilaridade = 0;

    for (let indice = 0; indice < tokensFiscal.length; indice += 1) {
      if (usados.has(indice)) continue;

      const similaridade = similaridadeToken(tokenLista, tokensFiscal[indice]);
      if (similaridade > melhorSimilaridade) {
        melhorSimilaridade = similaridade;
        melhorIndice = indice;
      }
    }

    if (melhorIndice < 0 || melhorSimilaridade < 0.70) return 0;

    usados.add(melhorIndice);
    soma += melhorSimilaridade;
  }

  const media = soma / tokensLista.length;
  return media >= 0.72 ? media : 0;
}

function localizarPrecoDetalhado(produto) {
  const produtoId = String(produto?.id || "").trim();
  if (produtoId) {
    const porId = mapaExato.get(chaveExataProdutoId(produtoId));
    if (porId?.preco > 0) return { ...porId, confianca: 1, criterio: "produto_id" };
  }

  const porNome = mapaExato.get(chaveExataNome(produto?.nome));
  if (porNome?.preco > 0) return { ...porNome, confianca: 1, criterio: "nome_exato" };

  let melhor = null;
  let melhorPontuacao = 0;

  for (const historico of itensHistoricos) {
    const pontuacao = pontuarCorrespondencia(produto, historico);
    if (pontuacao <= 0) continue;

    if (
      pontuacao > melhorPontuacao ||
      (
        Math.abs(pontuacao - melhorPontuacao) < 0.0001 &&
        numeroSeguro(historico.data, 0) > numeroSeguro(melhor?.data, 0)
      )
    ) {
      melhor = historico;
      melhorPontuacao = pontuacao;
    }
  }

  return melhor
    ? { ...melhor, confianca: melhorPontuacao, criterio: "descricao_fiscal" }
    : null;
}

function localizarPreco(produto) {
  return numeroSeguro(localizarPrecoDetalhado(produto)?.preco, 0);
}

function produtoPorNomeVisivel(nome) {
  const normalizado = normalizarNome(nome);
  if (!normalizado) return null;

  return produtos.find(
    (produto) => normalizarNome(produto?.nome) === normalizado
  ) || null;
}

function nomeOriginalElemento(elementoNome) {
  if (!elementoNome) return "";

  const textos = Array.from(elementoNome.childNodes)
    .filter((no) => no.nodeType === Node.TEXT_NODE)
    .map((no) => String(no.textContent || ""))
    .join(" ")
    .trim();

  return textos || elementoNome.dataset.nomeOriginalEstimativa || "";
}

function renderizarIndicadoresHistorico() {
  const area = document.getElementById(ID_AREA_LISTA);
  if (!area) return;

  area.querySelectorAll(".buy-item").forEach((linha) => {
    const nomeEl = linha.querySelector(".item-name");
    if (!nomeEl) return;

    const nome = nomeOriginalElemento(nomeEl);
    if (nome) nomeEl.dataset.nomeOriginalEstimativa = nome;

    const produto = produtoPorNomeVisivel(
      nomeEl.dataset.nomeOriginalEstimativa || nome
    );

    const registro = historicoPronto && produto
      ? localizarPrecoDetalhado(produto)
      : null;

    let indicador = nomeEl.querySelector(`.${CLASSE_INDICADOR}`);

    if (!registro || numeroSeguro(registro.preco, 0) <= 0) {
      if (indicador) indicador.remove();
      return;
    }

    if (!indicador) {
      indicador = document.createElement("span");
      indicador.className = CLASSE_INDICADOR;
      indicador.textContent = "R$";
      nomeEl.appendChild(indicador);
    }

    const descricaoFiscal = String(registro.nome || "").trim();
    indicador.title =
      `Preço histórico: ${formatarMoeda(registro.preco)}` +
      (descricaoFiscal ? ` · referência: ${descricaoFiscal}` : "");
  });
}

function agendarRenderIndicadores() {
  if (renderIndicadoresPendente) return;
  renderIndicadoresPendente = true;

  window.requestAnimationFrame(() => {
    renderIndicadoresPendente = false;
    renderizarIndicadoresHistorico();
  });
}

function iniciarObservadorLista() {
  const area = document.getElementById(ID_AREA_LISTA);
  if (!area) return;

  if (observadorLista) observadorLista.disconnect();

  observadorLista = new MutationObserver(agendarRenderIndicadores);
  observadorLista.observe(area, { childList: true, subtree: true });
  agendarRenderIndicadores();
}

function renderizarEstimativa() {
  const card = garantirCard();
  if (!card) return;

  const lista = produtos.filter(produtoEstaNaLista);

  if (!lista.length) {
    card.hidden = true;
    agendarRenderIndicadores();
    return;
  }

  // O quadro permanece visível sempre que houver itens na lista.
  card.hidden = false;

  const valorEl = card.querySelector(".estimativa-valor");
  const infoEl = card.querySelector(".estimativa-info");

  if (!historicoPronto) {
    if (valorEl) valorEl.textContent = "Calculando...";
    if (infoEl) infoEl.textContent = "Buscando preços do histórico de compras.";
    agendarRenderIndicadores();
    return;
  }

  let total = 0;
  let itensComPreco = 0;

  for (const produto of lista) {
    const preco = localizarPreco(produto);
    const quantidade = quantidadeAtualDaLista(produto);

    if (preco <= 0 || quantidade <= 0) continue;

    total += preco * quantidade;
    itensComPreco += 1;
  }

  if (itensComPreco === 0) {
    if (valorEl) valorEl.textContent = "—";
    if (infoEl) infoEl.textContent = "Nenhum item da lista foi reconhecido no histórico ainda.";
  } else {
    if (valorEl) valorEl.textContent = formatarMoeda(total);
    if (infoEl) {
      infoEl.textContent = `${itensComPreco} de ${lista.length} ${
        lista.length === 1 ? "item com preço histórico" : "itens com preço histórico"
      }.`;
    }
  }

  agendarRenderIndicadores();
}

function dataOrdenacaoGasto(dados = {}) {
  const dataMs = numeroSeguro(dados.dataCompraMs, 0);
  if (dataMs > 0) return dataMs;

  const dataCompra = String(dados.dataCompra || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataCompra)) {
    const convertido = Date.parse(`${dataCompra}T12:00:00`);
    if (Number.isFinite(convertido)) return convertido;
  }

  if (dados.criadoEm && typeof dados.criadoEm.toMillis === "function") {
    return dados.criadoEm.toMillis();
  }

  if (dados.atualizadoEm && typeof dados.atualizadoEm.toMillis === "function") {
    return dados.atualizadoEm.toMillis();
  }

  return 0;
}

async function obterGastosRecentes(db) {
  const referencia = collection(db, "familias", familiaIdAtual, "gastos");
  const tentativas = [
    query(referencia, orderBy("dataCompraMs", "desc"), limit(MAXIMO_GASTOS_HISTORICOS)),
    query(referencia, orderBy("criadoEm", "desc"), limit(MAXIMO_GASTOS_HISTORICOS)),
    query(referencia, limit(MAXIMO_GASTOS_HISTORICOS))
  ];

  let ultimoErro = null;

  for (const consulta of tentativas) {
    try {
      const snapshot = await getDocs(consulta);
      return snapshot.docs
        .map((documento) => ({
          id: documento.id,
          dados: documento.data(),
          referencia: documento.ref
        }))
        .sort((a, b) => dataOrdenacaoGasto(b.dados) - dataOrdenacaoGasto(a.dados))
        .slice(0, MAXIMO_GASTOS_HISTORICOS);
    } catch (erro) {
      ultimoErro = erro;
    }
  }

  if (ultimoErro) throw ultimoErro;
  return [];
}

async function carregarHistorico() {
  if (!familiaIdAtual) return;

  if (carregandoHistorico) {
    cargaHistoricoPendente = true;
    return;
  }

  carregandoHistorico = true;
  cargaHistoricoPendente = false;
  const minhaGeracao = ++geracaoHistorico;

  try {
    const app = obterAplicativo();
    if (!app) return;

    const db = getFirestore(app);
    const gastos = await obterGastosRecentes(db);

    const resultados = await Promise.all(
      gastos.map(async (gasto) => {
        try {
          const snapshot = await getDocs(collection(gasto.referencia, "itens"));
          return {
            data: dataOrdenacaoGasto(gasto.dados),
            itens: snapshot.docs.map((documento) => ({
              id: documento.id,
              ...documento.data()
            }))
          };
        } catch (erro) {
          console.warn(
            "Estimativa ListaLar: não foi possível ler os itens de uma compra.",
            gasto.id,
            erro
          );
          return null;
        }
      })
    );

    const novosItens = [];
    const novoMapaExato = new Map();

    resultados
      .filter(Boolean)
      .sort((a, b) => b.data - a.data)
      .forEach((gasto) => {
        gasto.itens.forEach((item) => {
          const preco = precoUnitarioItem(item);
          const nome = nomeItemHistorico(item);
          const nomeNormalizado = normalizarNome(nome);

          if (preco <= 0 || !nomeNormalizado) return;

          const registro = {
            preco,
            data: gasto.data,
            nome,
            nomeNormalizado,
            produtoId: String(item?.produtoId || "").trim(),
            tokens: tokensRelevantes(nome)
          };

          novosItens.push(registro);

          if (registro.produtoId) {
            const chaveId = chaveExataProdutoId(registro.produtoId);
            if (!novoMapaExato.has(chaveId)) novoMapaExato.set(chaveId, registro);
          }

          const chaveNome = chaveExataNome(nome);
          if (!novoMapaExato.has(chaveNome)) novoMapaExato.set(chaveNome, registro);
        });
      });

    if (minhaGeracao !== geracaoHistorico) return;

    itensHistoricos = novosItens;
    mapaExato = novoMapaExato;
    historicoPronto = true;
    renderizarEstimativa();
  } catch (erro) {
    console.error(
      "Estimativa ListaLar: não foi possível carregar o histórico de preços.",
      erro
    );

    if (minhaGeracao === geracaoHistorico) {
      itensHistoricos = [];
      mapaExato = new Map();
      historicoPronto = true;
      renderizarEstimativa();
    }
  } finally {
    carregandoHistorico = false;

    if (cargaHistoricoPendente) {
      cargaHistoricoPendente = false;
      window.setTimeout(carregarHistorico, 250);
    }
  }
}

function pararListeners() {
  if (typeof unsubscribeProdutos === "function") unsubscribeProdutos();
  if (typeof unsubscribeGastos === "function") unsubscribeGastos();
  if (observadorLista) observadorLista.disconnect();

  unsubscribeProdutos = null;
  unsubscribeGastos = null;
  observadorLista = null;
  produtos = [];
  itensHistoricos = [];
  mapaExato = new Map();
  familiaIdAtual = "";
  historicoPronto = false;
  geracaoHistorico += 1;

  const card = document.getElementById(ID_CARD);
  if (card) card.hidden = true;

  document
    .querySelectorAll(`.${CLASSE_INDICADOR}`)
    .forEach((elemento) => elemento.remove());
}

function iniciarProdutos(db) {
  const referencia = collection(db, "familias", familiaIdAtual, "produtos");

  unsubscribeProdutos = onSnapshot(
    query(referencia, orderBy("nome")),
    (snapshot) => {
      produtos = snapshot.docs.map((documento) => ({
        id: documento.id,
        ...documento.data()
      }));

      renderizarEstimativa();
    },
    (erro) => {
      console.error(
        "Estimativa ListaLar: não foi possível acompanhar os produtos.",
        erro
      );
    }
  );
}

function iniciarMonitorGastos(db) {
  const referencia = collection(db, "familias", familiaIdAtual, "gastos");
  let primeiraLeitura = true;
  let assinaturaAnterior = "";

  unsubscribeGastos = onSnapshot(
    query(referencia, orderBy("criadoEm", "desc"), limit(1)),
    (snapshot) => {
      const documento = snapshot.docs[0];
      const assinatura = documento
        ? `${documento.id}:${dataOrdenacaoGasto(documento.data())}:${numeroSeguro(documento.data().valorTotal, 0)}`
        : "VAZIO";

      if (primeiraLeitura || assinatura !== assinaturaAnterior) {
        primeiraLeitura = false;
        assinaturaAnterior = assinatura;
        historicoPronto = false;
        renderizarEstimativa();
        carregarHistorico();
      }
    },
    (erro) => {
      console.warn(
        "Estimativa ListaLar: monitor de gastos indisponível; usando carga direta.",
        erro
      );

      if (primeiraLeitura) {
        primeiraLeitura = false;
        carregarHistorico();
      }
    }
  );
}

async function iniciarParaUsuario(usuario) {
  pararListeners();
  if (!usuario?.uid) return;

  const app = obterAplicativo();
  if (!app) return;

  const db = getFirestore(app);
  const snapshotUsuario = await getDoc(doc(db, "usuarios", usuario.uid));
  if (!snapshotUsuario.exists()) return;

  const familiaId = String(snapshotUsuario.data().familiaId || "").trim();
  if (!familiaId) return;

  familiaIdAtual = familiaId;
  garantirCard();
  iniciarObservadorLista();
  iniciarProdutos(db);
  iniciarMonitorGastos(db);
}

async function iniciarEstimativaLista() {
  try {
    const app = await aguardarAplicativo();
    garantirCard();
    iniciarObservadorLista();

    const auth = getAuth(app);

    onAuthStateChanged(
      auth,
      (usuario) => {
        iniciarParaUsuario(usuario).catch((erro) => {
          console.error(
            "Estimativa ListaLar: erro ao iniciar para o usuário.",
            erro
          );
        });
      },
      (erro) => {
        console.error(
          "Estimativa ListaLar: erro ao acompanhar autenticação.",
          erro
        );
        pararListeners();
      }
    );
  } catch (erro) {
    console.error("Estimativa ListaLar: módulo não foi iniciado.", erro);
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    iniciarEstimativaLista,
    { once: true }
  );
} else {
  iniciarEstimativaLista();
}
