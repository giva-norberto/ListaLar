// ==========================================
// ListaLar - Estimativa de valor da lista
// Versão: 1.0.0
//
// Calcula o valor estimado da lista usando o
// último preço conhecido no histórico de Gastos.
// Funciona independentemente da exibição do
// Controle de Preços estar ativa ou não.
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
const MAXIMO_GASTOS_HISTORICOS = 60;
const MAXIMO_TENTATIVAS_FIREBASE = 100;
const INTERVALO_FIREBASE = 50;

let familiaIdAtual = "";
let produtos = [];
let precosHistoricos = new Map();
let unsubscribeProdutos = null;
let unsubscribeGastos = null;
let carregandoHistorico = false;
let cargaHistoricoPendente = false;
let geracaoCargaHistorico = 0;
let historicoPronto = false;

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
    .trim()
    .toUpperCase()
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
      border-radius: 18px;
      padding: 13px 14px;
      background: #eff6ff;
    }

    #${ID_CARD}[hidden] {
      display: none !important;
    }

    #${ID_CARD} .estimativa-cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    #${ID_CARD} .estimativa-titulo {
      color: #1e3a8a;
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: .03em;
    }

    #${ID_CARD} .estimativa-valor {
      margin-top: 4px;
      color: #172033;
      font-size: 27px;
      line-height: 1.05;
      font-weight: 900;
    }

    #${ID_CARD} .estimativa-info {
      margin-top: 7px;
      color: #475569;
      font-size: 11px;
      line-height: 1.35;
      font-weight: 800;
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
    <div class="estimativa-cabecalho">
      <div class="estimativa-titulo">Estimativa da compra</div>
    </div>
    <div class="estimativa-valor">Calculando...</div>
    <div class="estimativa-info"></div>
  `;

  resumo.insertAdjacentElement("afterend", card);
  return card;
}

function localizarPreco(produto) {
  for (const chave of chavesProduto(produto)) {
    const preco = numeroSeguro(precosHistoricos.get(chave), 0);
    if (preco > 0) return preco;
  }

  return 0;
}

function renderizarEstimativa() {
  const card = garantirCard();
  if (!card) return;

  const lista = produtos.filter(produtoEstaNaLista);

  if (!lista.length) {
    card.hidden = true;
    return;
  }

  card.hidden = false;

  const titulo = card.querySelector(".estimativa-titulo");
  const valor = card.querySelector(".estimativa-valor");
  const info = card.querySelector(".estimativa-info");

  if (!historicoPronto) {
    if (titulo) titulo.textContent = "Estimativa da compra";
    if (valor) valor.textContent = "Calculando...";
    if (info) info.textContent = "Consultando os preços mais recentes do histórico da família.";
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

  const faltantes = Math.max(0, lista.length - itensComPreco);

  if (titulo) {
    titulo.textContent = faltantes > 0
      ? "Estimativa parcial da compra"
      : "Estimativa da compra";
  }

  if (valor) {
    valor.textContent = itensComPreco > 0
      ? formatarMoeda(total)
      : "Sem estimativa";
  }

  if (info) {
    if (itensComPreco === 0) {
      info.textContent =
        `Ainda não há preço histórico para os ${lista.length} ` +
        `${lista.length === 1 ? "item" : "itens"} desta lista.`;
      return;
    }

    info.textContent =
      `Baseado no último preço conhecido de ${itensComPreco} de ${lista.length} ` +
      `${lista.length === 1 ? "item" : "itens"}.` +
      (faltantes > 0
        ? ` ${faltantes} ${faltantes === 1 ? "item ainda está" : "itens ainda estão"} sem referência de preço.`
        : "");
  }
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
          if (preco <= 0) return;

          chavesItemHistorico(item).forEach((chave) => {
            if (!novoMapa.has(chave)) {
              novoMapa.set(chave, preco);
            }
          });
        });
      });

    if (minhaGeracao !== geracaoCargaHistorico) return;

    precosHistoricos = novoMapa;
    historicoPronto = true;
    renderizarEstimativa();
  } catch (erro) {
    console.error(
      "Estimativa ListaLar: não foi possível carregar o histórico de preços.",
      erro
    );

    if (minhaGeracao === geracaoCargaHistorico) {
      precosHistoricos = new Map();
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

  unsubscribeProdutos = null;
  unsubscribeGastos = null;
  produtos = [];
  precosHistoricos = new Map();
  historicoPronto = false;
  familiaIdAtual = "";
  geracaoCargaHistorico += 1;

  const card = document.getElementById(ID_CARD);
  if (card) card.hidden = true;
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
  iniciarProdutos(db);
  iniciarMonitorGastos(db);
}

async function iniciarEstimativaLista() {
  try {
    const aplicativo = await aguardarAplicativo();
    garantirCard();

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
