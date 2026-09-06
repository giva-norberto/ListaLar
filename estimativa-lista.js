// ==========================================
// ListaLar - Estimativa de valor da lista
// Versão: 1.1.0
//
// Regra simples:
// - soma somente itens da lista que possuem preço histórico reconhecido;
// - itens sem histórico ficam fora da estimativa;
// - mostra um pequeno indicador "R$" apenas nos itens com histórico;
// - reconhece produtoId, nome exato e, como fallback, nome contido em descrições
//   mais completas vindas das notas fiscais (ex.: "Feijão" x "Feijão Carioca...").
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
const MAXIMO_GASTOS_HISTORICOS = 60;
const MAXIMO_TENTATIVAS_FIREBASE = 100;
const INTERVALO_FIREBASE = 50;

const PALAVRAS_IGNORADAS = new Set([
  "DE", "DA", "DO", "DAS", "DOS", "E", "EM", "COM", "SEM", "TIPO",
  "UN", "UND", "UNID", "UNIDADE", "UNIDADES", "KG", "KGS", "G", "GR",
  "L", "LT", "LTS", "ML", "PCT", "PACOTE", "PACOTES", "CX", "CAIXA",
  "CAIXAS", "BDJ", "BANDEJA", "LATA", "LATAS", "VD", "VIDRO"
]);

let familiaIdAtual = "";
let produtos = [];
let precosHistoricos = new Map();
let itensHistoricos = [];
let unsubscribeProdutos = null;
let unsubscribeGastos = null;
let observadorLista = null;
let carregandoHistorico = false;
let cargaHistoricoPendente = false;
let geracaoCargaHistorico = 0;
let historicoPronto = false;
let renderizacaoIndicadoresPendente = false;

function obterAplicativo() {
  return getApps().length ? getApp() : null;
}

async function aguardarAplicativo() {
  for (
    let tentativa = 0;
    tentativa < MAXIMO_TENTATIVAS_FIREBASE;
    tentativa += 1
  ) {
    const aplicativo = obterAplicativo();
    if (aplicativo) return aplicativo;

    await new Promise((resolve) => {
      window.setTimeout(resolve, INTERVALO_FIREBASE);
    });
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

function normalizarUnidade(valor) {
  const unidade = normalizarNome(valor)
    .replace(/^UNIDADE$/, "UN")
    .replace(/^UNID$/, "UN")
    .replace(/^UND$/, "UN")
    .replace(/^QUILO$/, "KG")
    .replace(/^QUILOS$/, "KG")
    .replace(/^LITRO$/, "L")
    .replace(/^LITROS$/, "L");

  return unidade || "UN";
}

function tokensRelevantes(valor) {
  return normalizarNome(valor)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !PALAVRAS_IGNORADAS.has(token))
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => token.length >= 2);
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

function unidadeItemHistorico(item) {
  return String(
    item?.unidade ||
    item?.un ||
    item?.siglaUnidade ||
    "UN"
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
    item?.quantidade ??
    item?.qtd ??
    item?.quantidadeComprada,
    0
  );

  const total = numeroSeguro(
    item?.valorTotal ??
    item?.total ??
    item?.subtotal,
    0
  );

  if (quantidade > 0 && total > 0) {
    preco = total / quantidade;
  }

  return preco > 0 ? arredondarMoeda(preco) : 0;
}

function chavesProduto(produto) {
  const chaves = [];
  const id = String(produto?.id || "").trim();
  const nome = normalizarNome(produto?.nome);
  const unidade = normalizarUnidade(produto?.unidade);

  if (id) chaves.push(`PRODUTO:${id}`);
  if (nome) {
    chaves.push(`NOME:${nome}|UN:${unidade}`);
    chaves.push(`NOME:${nome}`);
  }

  return chaves;
}

function chavesItemHistorico(item) {
  const chaves = [];
  const produtoId = String(item?.produtoId || "").trim();
  const nome = normalizarNome(nomeItemHistorico(item));
  const unidade = normalizarUnidade(unidadeItemHistorico(item));

  if (produtoId) chaves.push(`PRODUTO:${produtoId}`);
  if (nome) {
    chaves.push(`NOME:${nome}|UN:${unidade}`);
    chaves.push(`NOME:${nome}`);
  }

  return chaves;
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
  return (
    produto?.manualLista === true ||
    (
      produto?.listaAutomatica === true &&
      comprarQtd(produto) > 0
    )
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

    #${ID_CARD}[hidden] {
      display: none !important;
    }

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
    <div class="estimativa-valor"></div>
    <div class="estimativa-info"></div>
  `;

  resumo.insertAdjacentElement("afterend", card);
  return card;
}

function pontuarCorrespondencia(produto, historico) {
  const tokensProduto = tokensRelevantes(produto?.nome);
  const tokensHistorico = historico?.tokens || [];

  if (!tokensProduto.length || !tokensHistorico.length) return 0;

  const conjuntoHistorico = new Set(tokensHistorico);
  if (!tokensProduto.every((token) => conjuntoHistorico.has(token))) {
    return 0;
  }

  const nomeProduto = normalizarNome(produto?.nome);
  const nomeHistorico = historico?.nomeNormalizado || "";

  if (nomeProduto === nomeHistorico) return 1000;
  if (nomeHistorico.startsWith(nomeProduto + " ")) return 800;
  if (nomeHistorico.includes(" " + nomeProduto + " ")) return 700;

  const proporcao = tokensProduto.length / Math.max(tokensHistorico.length, 1);
  return 500 + proporcao * 100;
}

function localizarPrecoDetalhado(produto) {
  for (const chave of chavesProduto(produto)) {
    const registro = precosHistoricos.get(chave);
    if (registro && numeroSeguro(registro.preco, 0) > 0) {
      return registro;
    }
  }

  let melhor = null;
  let melhorPontuacao = 0;

  for (const historico of itensHistoricos) {
    const pontuacao = pontuarCorrespondencia(produto, historico);
    if (pontuacao <= 0) continue;

    if (
      pontuacao > melhorPontuacao ||
      (
        pontuacao === melhorPontuacao &&
        numeroSeguro(historico.data, 0) > numeroSeguro(melhor?.data, 0)
      )
    ) {
      melhor = historico;
      melhorPontuacao = pontuacao;
    }
  }

  return melhor;
}

function localizarPreco(produto) {
  return numeroSeguro(localizarPrecoDetalhado(produto)?.preco, 0);
}

function produtoPorNomeVisivel(nome) {
  const normalizado = normalizarNome(nome);
  if (!normalizado) return null;
  return produtos.find((produto) => normalizarNome(produto.nome) === normalizado) || null;
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

  const linhas = area.querySelectorAll(".buy-item");

  linhas.forEach((linha) => {
    const nomeEl = linha.querySelector(".item-name");
    if (!nomeEl) return;

    const nome = nomeOriginalElemento(nomeEl);
    if (nome) nomeEl.dataset.nomeOriginalEstimativa = nome;

    const produto = produtoPorNomeVisivel(nomeEl.dataset.nomeOriginalEstimativa || nome);
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

    indicador.title = `Preço histórico disponível: ${formatarMoeda(registro.preco)}`;
    indicador.setAttribute(
      "aria-label",
      `Preço histórico disponível: ${formatarMoeda(registro.preco)}`
    );
  });
}

function agendarRenderizacaoIndicadores() {
  if (renderizacaoIndicadoresPendente) return;
  renderizacaoIndicadoresPendente = true;

  window.requestAnimationFrame(() => {
    renderizacaoIndicadoresPendente = false;
    renderizarIndicadoresHistorico();
  });
}

function iniciarObservadorLista() {
  const area = document.getElementById(ID_AREA_LISTA);
  if (!area) return;

  if (observadorLista) observadorLista.disconnect();

  observadorLista = new MutationObserver(() => {
    agendarRenderizacaoIndicadores();
  });

  observadorLista.observe(area, {
    childList: true,
    subtree: true
  });

  agendarRenderizacaoIndicadores();
}

function renderizarEstimativa() {
  const card = garantirCard();
  if (!card) return;

  if (!historicoPronto) {
    card.hidden = true;
    agendarRenderizacaoIndicadores();
    return;
  }

  const lista = produtos.filter(produtoEstaNaLista);
  if (!lista.length) {
    card.hidden = true;
    agendarRenderizacaoIndicadores();
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
    card.hidden = true;
    agendarRenderizacaoIndicadores();
    return;
  }

  const valor = card.querySelector(".estimativa-valor");
  const info = card.querySelector(".estimativa-info");

  if (valor) valor.textContent = formatarMoeda(total);
  if (info) {
    info.textContent =
      `${itensComPreco} ${itensComPreco === 1 ? "item com preço histórico" : "itens com preço histórico"}.`;
  }

  card.hidden = false;
  agendarRenderizacaoIndicadores();
}

function dataOrdenacaoGasto(dados = {}) {
  const dataMs = numeroSeguro(dados.dataCompraMs, 0);
  if (dataMs > 0) return dataMs;

  const dataCompra = String(dados.dataCompra || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataCompra)) {
    const convertido = Date.parse(`${dataCompra}T12:00:00`);
    if (Number.isFinite(convertido)) return convertido;
  }

  const criadoEm = dados.criadoEm;
  if (criadoEm && typeof criadoEm.toMillis === "function") {
    return criadoEm.toMillis();
  }

  const atualizadoEm = dados.atualizadoEm;
  if (atualizadoEm && typeof atualizadoEm.toMillis === "function") {
    return atualizadoEm.toMillis();
  }

  return 0;
}

async function obterGastosRecentes(db) {
  const referencia = collection(
    db,
    "familias",
    familiaIdAtual,
    "gastos"
  );

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

async function carregarPrecosHistoricos() {
  if (!familiaIdAtual) return;

  if (carregandoHistorico) {
    cargaHistoricoPendente = true;
    return;
  }

  carregandoHistorico = true;
  cargaHistoricoPendente = false;
  const minhaGeracao = ++geracaoCargaHistorico;

  try {
    const aplicativo = obterAplicativo();
    if (!aplicativo) return;

    const db = getFirestore(aplicativo);
    const gastos = await obterGastosRecentes(db);
    const novoMapa = new Map();
    const novosItensHistoricos = [];

    const resultados = await Promise.all(
      gastos.map(async (gasto) => {
        try {
          const snapshotItens = await getDocs(
            collection(gasto.referencia, "itens")
          );

          return {
            data: dataOrdenacaoGasto(gasto.dados),
            itens: snapshotItens.docs.map((documento) => ({
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

    resultados
      .filter(Boolean)
      .sort((a, b) => b.data - a.data)
      .forEach((gasto) => {
        gasto.itens.forEach((item) => {
          const preco = precoUnitarioItem(item);
          const nome = nomeItemHistorico(item);
          if (preco <= 0 || !normalizarNome(nome)) return;

          const registro = {
            preco,
            data: gasto.data,
            produtoId: String(item?.produtoId || "").trim(),
            nome,
            nomeNormalizado: normalizarNome(nome),
            unidade: normalizarUnidade(unidadeItemHistorico(item)),
            tokens: tokensRelevantes(nome)
          };

          novosItensHistoricos.push(registro);

          chavesItemHistorico(item).forEach((chave) => {
            if (!novoMapa.has(chave)) {
              novoMapa.set(chave, registro);
            }
          });
        });
      });

    if (minhaGeracao !== geracaoCargaHistorico) return;

    precosHistoricos = novoMapa;
    itensHistoricos = novosItensHistoricos;
    historicoPronto = true;
    renderizarEstimativa();
  } catch (erro) {
    console.error(
      "Estimativa ListaLar: não foi possível carregar o histórico de preços.",
      erro
    );

    if (minhaGeracao === geracaoCargaHistorico) {
      precosHistoricos = new Map();
      itensHistoricos = [];
      historicoPronto = true;
      renderizarEstimativa();
    }
  } finally {
    carregandoHistorico = false;

    if (cargaHistoricoPendente) {
      cargaHistoricoPendente = false;
      window.setTimeout(carregarPrecosHistoricos, 250);
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
  precosHistoricos = new Map();
  itensHistoricos = [];
  historicoPronto = false;
  familiaIdAtual = "";
  geracaoCargaHistorico += 1;

  const card = document.getElementById(ID_CARD);
  if (card) card.hidden = true;

  document.querySelectorAll(`.${CLASSE_INDICADOR}`).forEach((el) => el.remove());
}

function iniciarProdutos(db) {
  const referencia = collection(
    db,
    "familias",
    familiaIdAtual,
    "produtos"
  );

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
  const referencia = collection(
    db,
    "familias",
    familiaIdAtual,
    "gastos"
  );

  let primeiraLeitura = true;
  let assinaturaAnterior = "";

  try {
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
          carregarPrecosHistoricos();
        }
      },
      (erro) => {
        console.warn(
          "Estimativa ListaLar: monitor de gastos indisponível; usando carga direta.",
          erro
        );

        if (primeiraLeitura) {
          primeiraLeitura = false;
          carregarPrecosHistoricos();
        }
      }
    );
  } catch (erro) {
    console.warn(
      "Estimativa ListaLar: não foi possível iniciar o monitor de gastos.",
      erro
    );
    carregarPrecosHistoricos();
  }
}

async function iniciarParaUsuario(usuario) {
  pararListeners();
  if (!usuario?.uid) return;

  const aplicativo = obterAplicativo();
  if (!aplicativo) return;

  const db = getFirestore(aplicativo);
  const snapshotUsuario = await getDoc(
    doc(db, "usuarios", usuario.uid)
  );

  if (!snapshotUsuario.exists()) return;

  const familiaId = String(
    snapshotUsuario.data().familiaId || ""
  ).trim();

  if (!familiaId) return;

  familiaIdAtual = familiaId;
  garantirCard();
  iniciarObservadorLista();
  iniciarProdutos(db);
  iniciarMonitorGastos(db);
}

async function iniciarEstimativaLista() {
  try {
    const aplicativo = await aguardarAplicativo();
    garantirCard();
    iniciarObservadorLista();

    const auth = getAuth(aplicativo);

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
    console.error(
      "Estimativa ListaLar: módulo não foi iniciado.",
      erro
    );
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
