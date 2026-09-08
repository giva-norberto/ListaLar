// ==========================================
// ListaLar - Famílias de produtos
// Versão: 1.0.0
//
// Camada semântica usada para conciliar o nome simples da Lista
// com descrições abreviadas/estendidas vindas de notas fiscais.
// ==========================================

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const R = (id, nome, padroes, opcoes = {}) => ({
  id,
  nome,
  padroes,
  excluir: opcoes.excluir || [],
  grupo: opcoes.grupo || "",
  prioridade: Number(opcoes.prioridade || 0)
});

export const FAMILIAS_PRODUTOS = [
  // Higiene bucal - específicas primeiro para evitar confundir creme com escova.
  R("ESCOVA_DENTAL", "Escova de dente", [
    /\bESCOVA\b.*\b(DENTE|DENTAL)\b/,
    /\bESC\b.*\b(DENTE|DENTAL|DENT)\b/,
    /\bESC\s+DENT(AL)?\b/
  ], { grupo: "HIGIENE_BUCAL", prioridade: 100 }),

  R("CREME_DENTAL", "Creme dental", [
    /\bCREME\b.*\b(DENTAL|DENTE)\b/,
    /\bPASTA\b.*\b(DENTAL|DENTE)\b/,
    /\bCR\s+DENT\b/,
    /\bCR\s+DENTAL\b/
  ], { grupo: "HIGIENE_BUCAL", prioridade: 99 }),

  R("ANTISSEPTICO_BUCAL", "Antisséptico bucal", [
    /\bANTIS(SEPTICO)?\b.*\bBUC(AL)?\b/,
    /\bENXAG(UANTE)?\b.*\bBUC(AL)?\b/
  ], { grupo: "HIGIENE_BUCAL", prioridade: 98 }),

  // Frango - cortes distintos não podem se misturar.
  R("PEITO_FRANGO", "Peito de frango", [
    /\bPEITO\b.*\b(FRANGO|FGO)\b/,
    /\bFILE\b.*\bPEITO\b.*\b(FRANGO|FGO)\b/,
    /\b(FRANGO|FGO)\b.*\bPEITO\b/
  ], { grupo: "CORTE_FRANGO", prioridade: 100 }),

  R("COXINHA_ASA_FRANGO", "Coxinha da asa de frango", [
    /\bCOXINHA\b.*\bASA\b.*\b(FRANGO|FGO)\b/,
    /\bCOXIN\b.*\b(FRANGO|FGO)\b/,
    /\bCOX\b.*\bASA\b.*\b(FRANGO|FGO)\b/,
    /\bCOXIN\s+A\s+(FRANGO|FGO)\b/
  ], { grupo: "CORTE_FRANGO", prioridade: 99 }),

  R("MEIO_ASA_FRANGO", "Meio da asa de frango", [
    /\bMEIO\b.*\bASA\b.*\b(FRANGO|FGO)\b/,
    /\bMEIO\s+ASA\s+(FRANGO|FGO)\b/
  ], { grupo: "CORTE_FRANGO", prioridade: 98 }),

  R("FILE_TILAPIA", "Filé de tilápia", [
    /\bFILE\b.*\bTILAP(IA)?\b/,
    /\bTILAP(IA)?\b.*\bFILE\b/
  ], { grupo: "PEIXE", prioridade: 95 }),

  R("CAPA_FILE_BOVINO", "Capa de filé bovino", [
    /\bCAPA\b.*\bFILE\b.*\b(BOVINO|BOV)?\b/,
    /\bCAPA\s+DE\s+FILE\b/
  ], { grupo: "CARNE_BOVINA", prioridade: 95 }),

  // Hortifruti.
  R("ALHO_DESCASCADO", "Alho descascado", [
    /\bALHO\b.*\bDESC(ASCADO)?\b/
  ], { grupo: "ALHO", prioridade: 100 }),

  R("ALHO", "Alho", [
    /\bALHO\b/
  ], { excluir: [/\bDESC(ASCADO)?\b/], grupo: "ALHO", prioridade: 50 }),

  R("COUVE_FLOR", "Couve-flor", [
    /\bCOUVE\b.*\bFLOR\b/,
    /\bCOUVEFLOR\b/
  ], { prioridade: 95 }),

  R("BATATA", "Batata", [
    /\bBATATA\b/,
    /\bBAT\s+INGL(ESA)?\b/
  ], { prioridade: 70 }),

  R("TOMATE", "Tomate", [
    /\bTOMATE\b/,
    /\bTOM\b.*\b(SWEET|SWEE|GRAPE|GRAP)\b/
  ], { prioridade: 70 }),

  R("MACA", "Maçã", [
    /\bMACA\b/,
    /\bMACA\s+(NAC|NACIONAL|GALA)\b/
  ], { prioridade: 80 }),

  R("BANANA", "Banana", [
    /\bBANANA\b/,
    /\bBAN\s+(PRATA|NANICA|CATURRA)\b/
  ], { prioridade: 70 }),

  R("ABACATE", "Abacate", [/\bABACATE\b/], { prioridade: 70 }),

  // Mercearia básica.
  R("ARROZ", "Arroz", [
    /\bARROZ\b/,
    /\bARR\b.*\b(TP|TIPO)?\s*1?\b/
  ], { prioridade: 90 }),

  R("FEIJAO", "Feijão", [
    /\bFEIJAO\b/,
    /\bFEIJOES\b/,
    /\bFEIJ\b/
  ], { prioridade: 90 }),

  R("MACARRAO", "Macarrão", [
    /\bMACARRAO\b/,
    /\bMACARR\b/,
    /\bMASSA\b.*\b(MACARRAO|ESPAGUETE|PENNE|PARAFUSO)\b/
  ], { prioridade: 85 }),

  R("PIPOCA", "Pipoca", [
    /\bPIPOCA\b/,
    /\bMILHO\b.*\bPIPOCA\b/
  ], { prioridade: 90 }),

  R("CACAU_PO", "Cacau em pó", [
    /\bCACAU\b.*\bPO\b/,
    /\bCACAU\b.*\bPOWDER\b/
  ], { prioridade: 95 }),

  R("FARINHA_PANKO", "Farinha Panko", [
    /\bFARINHA\b.*\bPANKO\b/,
    /\bFAR\b.*\bPANKO\b/
  ], { grupo: "FARINHA", prioridade: 100 }),

  R("FARINHA_TRIGO", "Farinha de trigo", [
    /\bFARINHA\b.*\bTRIGO\b/,
    /\bFAR\b.*\bTRIGO\b/
  ], { grupo: "FARINHA", prioridade: 90 }),

  R("ACUCAR", "Açúcar", [/\bACUCAR\b/, /\bACUC\b/], { prioridade: 80 }),
  R("CAFE", "Café", [/\bCAFE\b/], { prioridade: 80 }),
  R("ATUM", "Atum", [/\bATUM\b/], { prioridade: 85 }),
  R("AZEITONA", "Azeitona", [/\bAZEIT(ONA)?\b/], { prioridade: 80 }),

  // Laticínios e frios.
  R("LEITE", "Leite", [
    /\bLEITE\b/,
    /\bLEIT\b.*\b(UHT|INT|INTEGRAL|DESN|SEMI)\b/
  ], { grupo: "LATICINIO", prioridade: 90 }),

  R("BEBIDA_LACTEA", "Bebida láctea", [
    /\bBEB\b.*\bLAC(TEA)?\b/,
    /\bBEBIDA\b.*\bLACTEA\b/
  ], { grupo: "LATICINIO", prioridade: 95 }),

  R("IOGURTE", "Iogurte", [
    /\bIOGURTE\b/,
    /\bIOG\b.*\b(GREGO|NAT|BAT|MOR|FRUT)?\b/
  ], { grupo: "LATICINIO", prioridade: 90 }),

  R("QUEIJO_MUSSARELA", "Queijo muçarela", [
    /\bQUEIJO\b.*\b(MUSSARELA|MUC?ARELA)\b/,
    /\bQJO\b.*\b(MUSS|MUC)\b/
  ], { grupo: "QUEIJO", prioridade: 95 }),

  R("OVOS", "Ovos", [
    /\bOVOS?\b/,
    /\bOVOS?\s+BCOS?\b/
  ], { prioridade: 90 }),

  // Padaria e secos.
  R("BISNAGUINHA", "Bisnaguinha", [
    /\bBISN(AGUINHA)?\b/,
    /\bBISN\b.*\bTRAD\b/
  ], { prioridade: 85 }),

  R("AMEIXA_SECA", "Ameixa seca", [
    /\bAMEIXA\b.*\bSECA\b/,
    /\bAMEI\b.*\bSE\b/
  ], { prioridade: 85 }),

  // Limpeza e higiene pessoal.
  R("SABONETE_LIQUIDO", "Sabonete líquido", [
    /\bSABONETE\b.*\bLIQ(UIDO)?\b/,
    /\bSAB\b.*\bLIQ\b/
  ], { grupo: "SABONETE", prioridade: 100 }),

  R("SABONETE_BARRA", "Sabonete em barra", [
    /\bSABONETE\b.*\b(BARRA|BAR)\b/
  ], { grupo: "SABONETE", prioridade: 90 }),

  R("PAPEL_HIGIENICO", "Papel higiênico", [
    /\bPAPEL\b.*\bHIG(IENICO)?\b/,
    /\bP\s+HIG\b/
  ], { prioridade: 95 }),

  R("LAVA_ROUPAS_LIQUIDO", "Lava-roupas líquido", [
    /\bLAVA\b.*\bROUP(AS)?\b.*\bLIQ(UIDO)?\b/,
    /\bLAVA\s+ROU\b.*\bLIQ\b/
  ], { grupo: "LIMPEZA", prioridade: 100 }),

  R("DETERGENTE_LOUCA", "Detergente de louça", [
    /\bDETERG(ENTE)?\b.*\b(LOUCA|LOUCAS)?\b/,
    /\bDET\b.*\bLOU(CA)?\b/
  ], { grupo: "LIMPEZA", prioridade: 90 }),

  R("LUSTRA_MOVEIS", "Lustra-móveis", [
    /\bLUST(RA)?\b.*\bMOV(EIS)?\b/,
    /\bLUST\s+MOV\b/
  ], { grupo: "LIMPEZA", prioridade: 90 }),

  R("PASTILHA_SANITARIA", "Pastilha sanitária", [
    /\bPASTILHA\b.*\bSAN(ITARIA)?\b/,
    /\bPASTILHA\s+SAN\b/
  ], { grupo: "LIMPEZA", prioridade: 90 }),

  // Bebidas e outros itens comuns.
  R("BEBIDA_ENERGETICA", "Bebida energética", [
    /\bBEB\b.*\bEN(ERGETICA)?\b/,
    /\bENERGETICO\b/
  ], { grupo: "BEBIDA", prioridade: 85 }),

  R("TINTURA_CABELO", "Tintura de cabelo", [
    /\bTINT(URA)?\b.*\b(CABELO|IMEDIA)?\b/,
    /\bTINT\s+IMEDIA\b/
  ], { grupo: "HIGIENE_PESSOAL", prioridade: 80 })
].sort((a, b) => b.prioridade - a.prioridade);

export function classificarFamiliaProduto(valor) {
  const texto = normalizar(valor);
  if (!texto) return null;

  for (const familia of FAMILIAS_PRODUTOS) {
    if (familia.excluir.some((padrao) => padrao.test(texto))) continue;
    if (!familia.padroes.some((padrao) => padrao.test(texto))) continue;

    return {
      id: familia.id,
      nome: familia.nome,
      grupo: familia.grupo || ""
    };
  }

  return null;
}

export function familiasSaoIncompativeis(familiaA, familiaB) {
  if (!familiaA || !familiaB) return false;
  if (familiaA.id === familiaB.id) return false;

  // Se ambos foram classificados de forma explícita, tratamos famílias diferentes
  // como incompatíveis. Isso evita, por exemplo, Peito de frango = Meio da asa,
  // Escova de dente = Creme dental e Sabonete líquido = Lava-roupas líquido.
  return true;
}

export function mesmaFamiliaProduto(valorA, valorB) {
  const familiaA = classificarFamiliaProduto(valorA);
  const familiaB = classificarFamiliaProduto(valorB);
  return Boolean(familiaA && familiaB && familiaA.id === familiaB.id);
}

export const normalizarDescricaoFamilia = normalizar;
