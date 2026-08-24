// ListaLar Comercial 1.2.0 — recálculo seguro do histórico
import { getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  refs, produtoRef, movimentoRef, produtoPorId,
  moeda, quantidade
} from "./comercial-contexto.js?v=1.2.0";

const TIPOS_RECALCULAVEIS = new Set(["compra", "venda", "ajuste"]);

function instanteMovimento(m) {
  if (m?._ordemNova) return Number(m._ordemNova);
  const ts = m?.criadoEm;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.seconds === "number") return (ts.seconds * 1000) + Math.floor((ts.nanoseconds || 0) / 1e6);
  return 0;
}

export function ordenarMovimentosAsc(a, b) {
  // O estoque/custo médio sempre foi atualizado na ordem em que os registros
  // foram gravados. Mantemos essa ordem como fonte contábil para que corrigir
  // apenas a data de exibição não reescreva retroativamente o custo histórico.
  const instanteA = instanteMovimento(a);
  const instanteB = instanteMovimento(b);
  if (instanteA || instanteB) {
    const porInstante = instanteA - instanteB;
    if (porInstante !== 0) return porInstante;
  }
  const porData = String(a.data || "").localeCompare(String(b.data || ""));
  if (porData !== 0) return porData;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

export function ordenarMovimentosDesc(a, b) {
  return ordenarMovimentosAsc(b, a);
}

export function simularProduto(produtoId, movimentos) {
  let estoque = 0;
  let custoMedio = 0;
  const vendasDerivadas = [];

  const relevantes = movimentos
    .filter((m) => m.produtoId === produtoId && TIPOS_RECALCULAVEIS.has(m.tipo))
    .slice()
    .sort(ordenarMovimentosAsc);

  for (const m of relevantes) {
    if (m.tipo === "compra") {
      const qtd = quantidade(m.quantidade);
      const custo = moeda(m.custoUnitario);
      if (!(qtd > 0) || custo < 0) {
        throw new Error("Existe uma compra com quantidade ou custo inválido no histórico.");
      }
      const novoEstoque = quantidade(estoque + qtd);
      custoMedio = novoEstoque > 0
        ? moeda(((estoque * custoMedio) + (qtd * custo)) / novoEstoque)
        : 0;
      estoque = novoEstoque;
      continue;
    }

    if (m.tipo === "ajuste") {
      const novoEstoque = quantidade(m.estoqueNovo);
      const novoCusto = moeda(m.custoNovo);
      if (novoEstoque < 0 || novoCusto < 0) {
        throw new Error("Existe um ajuste comercial inválido no histórico.");
      }
      estoque = novoEstoque;
      custoMedio = novoCusto;
      continue;
    }

    const qtd = quantidade(m.quantidade);
    const preco = moeda(m.precoUnitario);
    if (!(qtd > 0) || preco < 0) {
      throw new Error("Existe uma venda com quantidade ou preço inválido no histórico.");
    }
    if (qtd > estoque + 0.0001) {
      const nome = produtoPorId(produtoId)?.nome || m.produtoNome || "Produto";
      throw new Error(`A correção deixaria o estoque de ${nome} negativo. Revise a quantidade ou o produto.`);
    }

    const receita = moeda(qtd * preco);
    const custoUnitario = moeda(custoMedio);
    const custoTotal = moeda(qtd * custoUnitario);
    vendasDerivadas.push({
      id: m.id,
      custoUnitario,
      custoTotal,
      receita,
      lucroBruto: moeda(receita - custoTotal)
    });
    estoque = quantidade(estoque - qtd);
  }

  return { estoque: quantidade(estoque), custoMedio: moeda(custoMedio), vendasDerivadas };
}

export async function carregarMovimentosFrescos() {
  const snap = await getDocs(refs().movimentos);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function substituirMovimento(lista, id, novosDados) {
  let encontrou = false;
  const nova = lista.map((m) => {
    if (m.id !== id) return m;
    encontrou = true;
    return { ...m, ...novosDados, id };
  });
  if (!encontrou) throw new Error("Movimentação não encontrada.");
  return nova;
}

export function estadoProdutoCompativel(dadosProduto, simulacao) {
  return (
    Math.abs(quantidade(dadosProduto?.estoque) - quantidade(simulacao?.estoque)) < 0.0001 &&
    Math.abs(moeda(dadosProduto?.custoMedio) - moeda(simulacao?.custoMedio)) < 0.011
  );
}

export function prepararRecalculo(simulacoes, movimentosAtuais = [], ignorarVendas = new Set()) {
  const vendasAtuais = new Map(movimentosAtuais.map((m) => [m.id, m]));
  const atualizacoesVendas = new Map();

  for (const simulacao of simulacoes.values()) {
    simulacao.vendasDerivadas.forEach((v) => {
      if (ignorarVendas.has(v.id)) return;
      const atual = vendasAtuais.get(v.id) || {};
      const mudou =
        moeda(atual.custoUnitario) !== moeda(v.custoUnitario) ||
        moeda(atual.custoTotal) !== moeda(v.custoTotal) ||
        moeda(atual.receita) !== moeda(v.receita) ||
        moeda(atual.lucroBruto) !== moeda(v.lucroBruto);
      if (mudou) atualizacoesVendas.set(v.id, v);
    });
  }

  if (atualizacoesVendas.size + simulacoes.size > 450) {
    throw new Error("Esta correção afetaria movimentações demais de uma só vez. Divida a correção em etapas menores.");
  }

  return { simulacoes, atualizacoesVendas };
}

export function movimentoCompativel(atual, esperado) {
  if (!atual || !esperado) return false;
  return (
    String(atual.tipo || "") === String(esperado.tipo || "") &&
    String(atual.produtoId || "") === String(esperado.produtoId || "") &&
    quantidade(atual.quantidade) === quantidade(esperado.quantidade) &&
    moeda(atual.precoUnitario) === moeda(esperado.precoUnitario) &&
    String(atual.data || "") === String(esperado.data || "")
  );
}

export function aplicarRecalculoNaTransacao(tx, plano) {
  for (const [idProduto, simulacao] of plano.simulacoes.entries()) {
    tx.update(produtoRef(idProduto), {
      estoque: simulacao.estoque,
      custoMedio: simulacao.custoMedio,
      atualizadoEm: serverTimestamp()
    });
  }

  for (const [idVenda, dados] of plano.atualizacoesVendas.entries()) {
    tx.update(movimentoRef(idVenda), {
      custoUnitario: dados.custoUnitario,
      custoTotal: dados.custoTotal,
      receita: dados.receita,
      lucroBruto: dados.lucroBruto,
      recalculadoEm: serverTimestamp()
    });
  }
}
