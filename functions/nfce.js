"use strict";

const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const logger =
  require("firebase-functions/logger");

const {
  getFirestore
} = require("firebase-admin/firestore");

const dns =
  require("node:dns").promises;

const net =
  require("node:net");

const db = getFirestore();

const REGIAO_FUNCOES =
  "southamerica-east1";

const TIMEOUT_MS = 15000;

const LIMITE_RESPOSTA_BYTES =
  2 * 1024 * 1024;

const LIMITE_REDIRECIONAMENTOS = 4;

// ============================================================================
// UTILITÁRIOS
// ============================================================================

function texto(valor) {
  return String(valor ?? "").trim();
}

function somenteDigitos(valor) {
  return texto(valor).replace(/\D/g, "");
}

function numeroBrasileiro(valor) {
  let bruto = texto(valor)
    .replace(/[^\d,.-]/g, "");

  if (!bruto) {
    return 0;
  }

  if (
    bruto.includes(",") &&
    bruto.includes(".")
  ) {
    bruto = bruto
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (bruto.includes(",")) {
    bruto = bruto.replace(",", ".");
  }

  const numero = Number(bruto);

  return Number.isFinite(numero)
    ? numero
    : 0;
}

function arredondarMoeda(valor) {
  return Math.round(
    (
      Number(valor) +
      Number.EPSILON
    ) * 100
  ) / 100;
}

function decodificarEntidadesHTML(valor) {
  const mapa = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: "\"",
    apos: "'",
    nbsp: " "
  };

  return texto(valor)
    .replace(
      /&#(\d+);/g,
      (_, codigo) => {
        const numero =
          Number(codigo);

        return Number.isFinite(numero)
          ? String.fromCodePoint(numero)
          : "";
      }
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, codigo) => {
        const numero =
          Number.parseInt(codigo, 16);

        return Number.isFinite(numero)
          ? String.fromCodePoint(numero)
          : "";
      }
    )
    .replace(
      /&([a-z]+);/gi,
      (inteiro, nome) =>
        mapa[nome.toLowerCase()] ??
        inteiro
    );
}

function htmlParaTexto(html) {
  return decodificarEntidadesHTML(
    texto(html)
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " "
      )
      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " "
      )
      .replace(
        /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
        " "
      )
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<\/(p|div|li|tr|td|th|section|article|header|footer|h[1-6])>/gi,
        "\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizarComparacao(valor) {
  return texto(valor)
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ============================================================================
// SEGURANÇA DE REDE
// ============================================================================

function ipv4Privado(ip) {
  const partes =
    ip.split(".").map(Number);

  if (
    partes.length !== 4 ||
    partes.some(
      (parte) =>
        !Number.isInteger(parte)
    )
  ) {
    return true;
  }

  const [a, b] = partes;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (
      a === 169 &&
      b === 254
    ) ||
    (
      a === 172 &&
      b >= 16 &&
      b <= 31
    ) ||
    (
      a === 192 &&
      b === 168
    ) ||
    a >= 224
  );
}

function ipv6Privado(ip) {
  const valor =
    ip.toLowerCase();

  return (
    valor === "::" ||
    valor === "::1" ||
    valor.startsWith("fc") ||
    valor.startsWith("fd") ||
    valor.startsWith("fe8") ||
    valor.startsWith("fe9") ||
    valor.startsWith("fea") ||
    valor.startsWith("feb") ||
    valor.startsWith(
      "::ffff:127."
    ) ||
    valor.startsWith(
      "::ffff:10."
    ) ||
    valor.startsWith(
      "::ffff:192.168."
    )
  );
}

function ipPrivado(ip) {
  const tipo = net.isIP(ip);

  if (tipo === 4) {
    return ipv4Privado(ip);
  }

  if (tipo === 6) {
    return ipv6Privado(ip);
  }

  return true;
}

function validarHostnameOficial(
  hostname
) {
  const host = texto(hostname)
    .toLowerCase()
    .replace(/\.$/, "");

  if (
    !host ||
    (
      host !== "gov.br" &&
      !host.endsWith(".gov.br")
    )
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A URL não aponta para um portal fiscal oficial do governo."
    );
  }

  return host;
}

async function validarDestinoSeguro(url) {
  if (!(url instanceof URL)) {
    throw new HttpsError(
      "invalid-argument",
      "A URL informada é inválida."
    );
  }

  if (url.protocol !== "https:") {
    throw new HttpsError(
      "invalid-argument",
      "A consulta da NFC-e deve utilizar HTTPS."
    );
  }

  if (
    url.username ||
    url.password
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A URL da NFC-e contém credenciais inválidas."
    );
  }

  if (
    url.port &&
    url.port !== "443"
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A URL da NFC-e utiliza uma porta não permitida."
    );
  }

  const hostname =
    validarHostnameOficial(
      url.hostname
    );

  let enderecos;

  try {
    enderecos = await dns.lookup(
      hostname,
      {
        all: true,
        verbatim: true
      }
    );
  } catch (erro) {
    logger.warn(
      "Falha ao resolver o domínio da NFC-e.",
      {
        hostname,
        erro:
          erro?.message ||
          String(erro)
      }
    );

    throw new HttpsError(
      "unavailable",
      "Não foi possível localizar o portal fiscal informado."
    );
  }

  if (
    !enderecos.length ||
    enderecos.some(
      ({ address }) =>
        ipPrivado(address)
    )
  ) {
    throw new HttpsError(
      "permission-denied",
      "O endereço de destino da consulta não é permitido."
    );
  }
}

function validarUrlRecebida(valor) {
  const bruto = texto(valor);

  if (
    !bruto ||
    bruto.length > 4096
  ) {
    throw new HttpsError(
      "invalid-argument",
      "A URL da NFC-e não foi informada ou é muito longa."
    );
  }

  let url;

  try {
    url = new URL(bruto);
  } catch {
    throw new HttpsError(
      "invalid-argument",
      "A URL da NFC-e é inválida."
    );
  }

  return url;
}

// ============================================================================
// AUTENTICAÇÃO E FAMÍLIA
// ============================================================================

async function validarUsuarioEFamilia(
  request
) {
  const uid =
    texto(request.auth?.uid);

  if (!uid) {
    throw new HttpsError(
      "unauthenticated",
      "É necessário estar autenticado."
    );
  }

  const usuarioSnap =
    await db
      .collection("usuarios")
      .doc(uid)
      .get();

  if (!usuarioSnap.exists) {
    throw new HttpsError(
      "permission-denied",
      "O cadastro do usuário não foi localizado."
    );
  }

  const usuario =
    usuarioSnap.data() || {};

  const familiaIdUsuario =
    texto(usuario.familiaId);

  const familiaIdInformada =
    texto(
      request.data?.familiaId
    );

  if (!familiaIdUsuario) {
    throw new HttpsError(
      "failed-precondition",
      "O usuário não está vinculado a uma família."
    );
  }

  if (
    familiaIdInformada &&
    familiaIdInformada !==
      familiaIdUsuario
  ) {
    throw new HttpsError(
      "permission-denied",
      "A família informada não pertence ao usuário autenticado."
    );
  }

  const modulosSnap =
    await db
      .collection("configuracoes")
      .doc("modulos")
      .get();

  const modulos =
    modulosSnap.exists
      ? modulosSnap.data() || {}
      : {};

  const liberado =
    modulos.gastosLiberados ===
      true ||
    texto(
      modulos.familiaPilotoId
    ) === familiaIdUsuario ||
    (
      !modulosSnap.exists &&
      usuario.adminSistema === true
    );

  if (!liberado) {
    throw new HttpsError(
      "permission-denied",
      "O módulo Gastos ainda não está liberado para esta família."
    );
  }

  return {
    uid,
    familiaId:
      familiaIdUsuario
  };
}

// ============================================================================
// DOWNLOAD SEGURO
// ============================================================================

async function lerRespostaLimitada(
  resposta
) {
  const tamanhoInformado =
    Number(
      resposta.headers.get(
        "content-length"
      ) || 0
    );

  if (
    tamanhoInformado >
    LIMITE_RESPOSTA_BYTES
  ) {
    throw new HttpsError(
      "resource-exhausted",
      "A resposta do portal fiscal excedeu o tamanho permitido."
    );
  }

  if (!resposta.body) {
    return "";
  }

  const leitor =
    resposta.body.getReader();

  const blocos = [];
  let total = 0;

  while (true) {
    const {
      done,
      value
    } = await leitor.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (
      total >
      LIMITE_RESPOSTA_BYTES
    ) {
      try {
        await leitor.cancel();
      } catch {
        // A leitura já pode ter sido encerrada.
      }

      throw new HttpsError(
        "resource-exhausted",
        "A resposta do portal fiscal excedeu o tamanho permitido."
      );
    }

    blocos.push(value);
  }

  const buffer = Buffer.concat(
    blocos.map(
      (bloco) =>
        Buffer.from(bloco)
    )
  );

  return buffer.toString("utf8");
}

async function buscarHtmlSeguro(
  urlInicial
) {
  let urlAtual =
    new URL(
      urlInicial.toString()
    );

  for (
    let redirecionamento = 0;
    redirecionamento <=
      LIMITE_REDIRECIONAMENTOS;
    redirecionamento += 1
  ) {
    await validarDestinoSeguro(
      urlAtual
    );

    const controlador =
      new AbortController();

    const temporizador =
      setTimeout(
        () =>
          controlador.abort(),
        TIMEOUT_MS
      );

    let resposta;

    try {
      resposta = await fetch(
        urlAtual,
        {
          method: "GET",
          redirect: "manual",
          signal:
            controlador.signal,

          headers: {
            accept:
              "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",

            "accept-language":
              "pt-BR,pt;q=0.9",

            "user-agent":
              "ListaLar-NFCe/1.0"
          }
        }
      );
    } catch (erro) {
      if (
        erro?.name ===
        "AbortError"
      ) {
        throw new HttpsError(
          "deadline-exceeded",
          "O portal fiscal demorou demais para responder."
        );
      }

      logger.warn(
        "Falha ao consultar o portal da NFC-e.",
        {
          url:
            urlAtual.toString(),

          erro:
            erro?.message ||
            String(erro)
        }
      );

      throw new HttpsError(
        "unavailable",
        "Não foi possível acessar o portal fiscal neste momento."
      );
    } finally {
      clearTimeout(
        temporizador
      );
    }

    if (
      [
        301,
        302,
        303,
        307,
        308
      ].includes(resposta.status)
    ) {
      const local =
        resposta.headers.get(
          "location"
        );

      if (!local) {
        throw new HttpsError(
          "unavailable",
          "O portal fiscal retornou um redirecionamento inválido."
        );
      }

      urlAtual =
        new URL(local, urlAtual);

      continue;
    }

    if (!resposta.ok) {
      logger.warn(
        "Portal da NFC-e respondeu com erro.",
        {
          status:
            resposta.status,

          url:
            urlAtual.toString()
        }
      );

      if (
        resposta.status === 404
      ) {
        throw new HttpsError(
          "not-found",
          "A NFC-e não foi encontrada no portal fiscal."
        );
      }

      if (
        resposta.status === 429
      ) {
        throw new HttpsError(
          "resource-exhausted",
          "O portal fiscal limitou temporariamente as consultas."
        );
      }

      throw new HttpsError(
        "unavailable",
        `O portal fiscal respondeu com o código ${resposta.status}.`
      );
    }

    const contentType =
      texto(
        resposta.headers.get(
          "content-type"
        )
      ).toLowerCase();

    if (
      contentType &&
      !contentType.includes(
        "text/html"
      ) &&
      !contentType.includes(
        "application/xhtml+xml"
      )
    ) {
      throw new HttpsError(
        "failed-precondition",
        "O portal fiscal não retornou uma página de NFC-e válida."
      );
    }

    const html =
      await lerRespostaLimitada(
        resposta
      );

    return {
      html,
      urlFinal:
        urlAtual.toString()
    };
  }

  throw new HttpsError(
    "failed-precondition",
    "O portal fiscal realizou redirecionamentos demais."
  );
}

// ============================================================================
// EXTRAÇÃO DOS DADOS
// ============================================================================

function extrairPrimeiro(
  textoFonte,
  padroes,
  grupo = 1
) {
  for (
    const padrao of padroes
  ) {
    const correspondencia =
      textoFonte.match(padrao);

    if (
      correspondencia?.[grupo]
    ) {
      return texto(
        correspondencia[grupo]
      );
    }
  }

  return "";
}

function extrairCnpj(textoNota) {
  return somenteDigitos(
    extrairPrimeiro(
      textoNota,
      [
        /CNPJ\s*:?\s*([\d.\/-]{14,20})/i,
        /CNPJ\s+([\d.\/-]{14,20})/i
      ]
    )
  ).slice(0, 14);
}

function extrairChave(
  textoNota,
  urlConsulta
) {
  const candidatas =
    textoNota.match(
      /(?:\d[\s.-]*){44}/g
    ) || [];

  for (
    const candidata of candidatas
  ) {
    const chave =
      somenteDigitos(candidata);

    if (chave.length === 44) {
      return chave;
    }
  }

  const url =
    new URL(urlConsulta);

  const chaveUrl =
    somenteDigitos(
      url.searchParams.get(
        "chNFe"
      ) ||
      url.searchParams.get(
        "chave"
      ) ||
      ""
    );

  return chaveUrl.length === 44
    ? chaveUrl
    : "";
}

function extrairDataCompra(
  textoNota
) {
  const correspondencia =
    textoNota.match(
      /(?:Emiss[aã]o|Data\s+de\s+Emiss[aã]o|Data)\s*:?\s*(\d{2}\/\d{2}\/\d{4})(?:[\s,]+(?:[àa]s\s*)?(\d{2}:\d{2}(?::\d{2})?))?/i
    ) ||
    textoNota.match(
      /\b(\d{2}\/\d{2}\/\d{4})[\s,]+(\d{2}:\d{2}(?::\d{2})?)\b/
    );

  if (!correspondencia) {
    return "";
  }

  const [
    dia,
    mes,
    ano
  ] =
    correspondencia[1]
      .split("/");

  const horario =
    correspondencia[2] ||
    "00:00:00";

  return (
    `${ano}-${mes}-${dia}` +
    `T${horario}`
  );
}

function extrairValorTotal(
  textoNota
) {
  const valor =
    extrairPrimeiro(
      textoNota,
      [
        /Valor\s+total\s+R\$\s*:?\s*(?:R\$\s*)?([\d.,]+)/i,

        /Valor\s+Total\s+da\s+Nota\s*:?\s*(?:R\$\s*)?([\d.,]+)/i,

        /Total\s+a\s+pagar\s*:?\s*(?:R\$\s*)?([\d.,]+)/i
      ]
    );

  return arredondarMoeda(
    numeroBrasileiro(valor)
  );
}

function extrairPagamento(
  textoNota
) {
  return extrairPrimeiro(
    textoNota,
    [
      /Forma\s+de\s+Pagamento\s*:?\s*([^\n]+)/i,

      /Meio\s+de\s+Pagamento\s*:?\s*([^\n]+)/i
    ]
  );
}

function limparDescricaoItem(
  valor
) {
  return texto(valor)
    .replace(
      /.*?(?:Filtrar|Filtar)\s+[ií]tens\s*/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
}

function formatarNomeProduto(
  valor
) {
  return limparDescricaoItem(
    valor
  )
    .toLowerCase()
    .replace(
      /\b\p{L}/gu,
      (letra) =>
        letra.toUpperCase()
    );
}

function criarItem({
  descricao,
  codigo,
  quantidade,
  unidade,
  total,
  unitario
}) {
  const descricaoLimpa =
    limparDescricaoItem(
      descricao
    );

  const quantidadeNumero =
    numeroBrasileiro(
      quantidade
    ) || 1;

  const totalNumero =
    arredondarMoeda(
      numeroBrasileiro(total)
    );

  let unitarioNumero =
    arredondarMoeda(
      numeroBrasileiro(
        unitario
      )
    );

  if (
    !descricaoLimpa ||
    /nota fiscal|consumidor eletr[oô]nica/i
      .test(descricaoLimpa)
  ) {
    return null;
  }

  if (
    !unitarioNumero &&
    quantidadeNumero > 0 &&
    totalNumero > 0
  ) {
    unitarioNumero =
      arredondarMoeda(
        totalNumero /
        quantidadeNumero
      );
  }

  const totalCalculado =
    totalNumero ||
    arredondarMoeda(
      quantidadeNumero *
      unitarioNumero
    );

  return {
    descricaoOriginal:
      descricaoLimpa,

    produtoNome:
      formatarNomeProduto(
        descricaoLimpa
      ),

    codigo:
      somenteDigitos(codigo),

    quantidade:
      quantidadeNumero,

    unidade:
      texto(unidade || "UN")
        .replace(
          /[^A-Za-zÀ-ÿ]/g,
          ""
        )
        .toUpperCase() ||
      "UN",

    precoUnitario:
      unitarioNumero,

    precoTotal:
      totalCalculado
  };
}

function removerDuplicados(
  itens
) {
  const mapa = new Map();

  for (
    const item of itens
  ) {
    if (!item) {
      continue;
    }

    const chave = [
      item.codigo,

      normalizarComparacao(
        item.descricaoOriginal
      ),

      item.quantidade,
      item.precoTotal
    ].join("|");

    if (!mapa.has(chave)) {
      mapa.set(chave, item);
    }
  }

  return [...mapa.values()];
}

function extrairItens(
  textoNota
) {
  const itens = [];

  const padraoRotulado =
    /(.+?)\s*\(C[oó]digo:\s*([^\)]+)\)\s*Qtde\s+total\s+de\s+[ií]tens:\s*([\d.,]+)\s*UN:\s*([A-Za-zÀ-ÿ]{1,10})\s*Valor\s+total\s+R\$:\s*(?:R\$\s*)?([\d.,]+)/gi;

  let correspondencia;

  while (
    (
      correspondencia =
        padraoRotulado.exec(
          textoNota
        )
    ) !== null
  ) {
    itens.push(
      criarItem({
        descricao:
          correspondencia[1],

        codigo:
          correspondencia[2],

        quantidade:
          correspondencia[3],

        unidade:
          correspondencia[4],

        total:
          correspondencia[5]
      })
    );
  }

  if (
    itens.filter(Boolean).length
  ) {
    return removerDuplicados(
      itens
    );
  }

  const linhas =
    textoNota
      .split("\n")
      .map(texto)
      .filter(Boolean);

  for (
    let indice = 0;
    indice < linhas.length;
    indice += 1
  ) {
    const linha =
      linhas[indice];

    const inicio =
      linha.match(
        /^(.*?)\s*\(C[oó]digo:\s*([^\)]+)\)/i
      );

    if (!inicio) {
      continue;
    }

    const bloco =
      linhas
        .slice(
          indice,
          indice + 8
        )
        .join(" ");

    const quantidade =
      extrairPrimeiro(
        bloco,
        [
          /Qtde\s+total\s+de\s+[ií]tens:\s*([\d.,]+)/i,

          /Qtde\.?\s*:?\s*([\d.,]+)/i
        ]
      );

    const unidade =
      extrairPrimeiro(
        bloco,
        [
          /UN:\s*([A-Za-zÀ-ÿ]{1,10})/i,

          /Unidade\s*:?\s*([A-Za-zÀ-ÿ]{1,10})/i
        ]
      );

    const total =
      extrairPrimeiro(
        bloco,
        [
          /Valor\s+total\s+R\$:\s*(?:R\$\s*)?([\d.,]+)/i,

          /Valor\s+Total\s*:?\s*(?:R\$\s*)?([\d.,]+)/i
        ]
      );

    const unitario =
      extrairPrimeiro(
        bloco,
        [
          /Valor\s+unit[aá]rio\s*:?\s*(?:R\$\s*)?([\d.,]+)/i,

          /Vl\.\s*Unit\.\s*:?\s*(?:R\$\s*)?([\d.,]+)/i
        ]
      );

    if (
      !quantidade ||
      (
        !total &&
        !unitario
      )
    ) {
      continue;
    }

    itens.push(
      criarItem({
        descricao: inicio[1],
        codigo: inicio[2],
        quantidade,
        unidade,
        total,
        unitario
      })
    );
  }

  return removerDuplicados(
    itens
  );
}

function extrairMercado(
  textoNota
) {
  const linhas =
    textoNota
      .split("\n")
      .map(texto)
      .filter(Boolean);

  const indiceTitulo =
    linhas.findIndex(
      (linha) =>
        /Nota Fiscal de Consumidor Eletr[oô]nica/i
          .test(linha)
    );

  const candidatos =
    linhas.slice(
      indiceTitulo >= 0
        ? indiceTitulo + 1
        : 0,

      indiceTitulo >= 0
        ? indiceTitulo + 8
        : 12
    );

  const mercado =
    candidatos.find(
      (linha) => {
        const comparacao =
          normalizarComparacao(
            linha
          );

        return (
          linha.length >= 4 &&
          !comparacao.startsWith(
            "cnpj"
          ) &&
          !comparacao.includes(
            "inscricao estadual"
          ) &&
          !comparacao.includes(
            "secretaria de estado"
          ) &&
          !comparacao.includes(
            "consulta via leitor"
          ) &&
          !/^\d{2}\/\d{2}\/\d{4}/
            .test(linha)
        );
      }
    );

  return mercado ||
    "Estabelecimento não identificado";
}

function paginaExigeCaptcha(
  textoNota
) {
  const comparacao =
    normalizarComparacao(
      textoNota
    );

  return (
    comparacao.includes(
      "captcha"
    ) ||
    comparacao.includes(
      "nao sou um robo"
    ) ||
    comparacao.includes(
      "verificacao de seguranca"
    )
  );
}

function interpretarNota(
  html,
  urlFinal
) {
  const textoNota =
    htmlParaTexto(html);

  if (
    !textoNota ||
    textoNota.length < 80
  ) {
    throw new HttpsError(
      "failed-precondition",
      "O portal fiscal retornou uma página vazia ou inválida."
    );
  }

  if (
    paginaExigeCaptcha(
      textoNota
    )
  ) {
    throw new HttpsError(
      "failed-precondition",
      "O portal fiscal exigiu uma verificação de segurança. Abra a NFC-e no navegador e tente novamente depois."
    );
  }

  const itens =
    extrairItens(textoNota);

  if (!itens.length) {
    logger.warn(
      "Nenhum item foi reconhecido na NFC-e.",
      {
        urlFinal,

        amostra:
          textoNota.slice(
            0,
            500
          )
      }
    );

    throw new HttpsError(
      "failed-precondition",
      "A página foi acessada, mas os produtos da NFC-e não puderam ser reconhecidos."
    );
  }

  const valorTotalInformado =
    extrairValorTotal(
      textoNota
    );

  const valorTotalCalculado =
    arredondarMoeda(
      itens.reduce(
        (soma, item) =>
          soma +
          item.precoTotal,
        0
      )
    );

  return {
    origem:
      "QR_CODE_NFCE",

    origemImportacao:
      "QR_CODE_NFCE",

    mercadoNome:
      extrairMercado(
        textoNota
      ),

    cnpj:
      extrairCnpj(
        textoNota
      ),

    dataCompra:
      extrairDataCompra(
        textoNota
      ),

    chaveAcesso:
      extrairChave(
        textoNota,
        urlFinal
      ),

    formaPagamento:
      extrairPagamento(
        textoNota
      ),

    quantidadeTotalItens:
      itens.length,

    valorTotal:
      valorTotalInformado ||
      valorTotalCalculado,

    itens,

    urlConsulta:
      urlFinal,

    consultadaEm:
      new Date().toISOString()
  };
}

// ============================================================================
// CLOUD FUNCTION
// ============================================================================

const consultarNfce = onCall(
  {
    region:
      REGIAO_FUNCOES,

    timeoutSeconds: 30,

    memory: "256MiB",

    enforceAppCheck: false
  },

  async (request) => {
    const contexto =
      await validarUsuarioEFamilia(
        request
      );

    const url =
      validarUrlRecebida(
        request.data?.url
      );

    logger.info(
      "Iniciando consulta de NFC-e.",
      {
        uid:
          contexto.uid,

        familiaId:
          contexto.familiaId,

        hostname:
          url.hostname
      }
    );

    try {
      const {
        html,
        urlFinal
      } =
        await buscarHtmlSeguro(
          url
        );

      const nota =
        interpretarNota(
          html,
          urlFinal
        );

      logger.info(
        "NFC-e consultada com sucesso.",
        {
          uid:
            contexto.uid,

          familiaId:
            contexto.familiaId,

          hostname:
            new URL(
              urlFinal
            ).hostname,

          itens:
            nota.itens.length,

          chaveAcesso:
            nota.chaveAcesso ||
            ""
        }
      );

      return {
        sucesso: true,
        nota
      };
    } catch (erro) {
      logger.error(
        "Erro ao consultar NFC-e.",
        {
          uid:
            contexto.uid,

          familiaId:
            contexto.familiaId,

          hostname:
            url.hostname,

          codigo:
            erro?.code ||
            "internal",

          erro:
            erro?.message ||
            String(erro)
        }
      );

      if (
        erro instanceof HttpsError
      ) {
        throw erro;
      }

      throw new HttpsError(
        "internal",
        "Não foi possível concluir a consulta da NFC-e."
      );
    }
  }
);

module.exports = {
  consultarNfce
};
