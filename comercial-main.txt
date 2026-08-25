// ListaLar Comercial 1.3.10 — inicialização, acesso, listeners e estorno de movimentos
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  onSnapshot, query, orderBy, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, ESTADO, $, db, refs, verificarAcesso, status, VERSAO,
  movimentoRef, produtoRef, produtoPorId, quantidade, moeda,
  fmtNumero, fmtMoeda, toast
} from "./comercial-contexto.js?v=1.2.0";
import {
  renderProdutos, renderMovimentos, renderPeriodos
} from "./comercial-render.js?v=1.3.3";
import { configurarEventosOperacoes } from "./comercial-operacoes.js?v=1.2.0";
import { configurarVendaUi, normalizarSeletoresProdutos } from "./comercial-venda-ui.js?v=1.3.4";
import { garantirAcoesProdutos } from "./comercial-produtos-ui.js?v=1.3.8";
import {
  configurarFiltroDashboardDatas, renderDashboardPorDatas
} from "./comercial-dashboard-periodo.js?v=1.3.9";
import {
  carregarMovimentosFrescos, substituirMovimento, simularProduto,
  estadoProdutoCompativel, prepararRecalculo, movimentoCompativel,
  aplicarRecalculoNaTransacao, ordenarMovimentosDesc
} from "./comercial-calculos.js?v=1.2.0";

const ESTORNANDO = new Set();
let eventosEstornoConfigurados = false;

function movimentoEstado(id) {
  return ESTADO.movimentos.find((m) => String(m.id) === String(id)) || null;
}

function unidadeMovimento(movimento) {
  const produto = produtoPorId(movimento?.produtoId);
  return String(movimento?.unidade || produto?.unidade || "UN").trim().toUpperCase() || "UN";
}

function detalheMovimentoEstornado(movimento) {
  const unidade = unidadeMovimento(movimento);
  if (movimento.tipoOriginal === "compra") {
    return `${fmtNumero(movimento.quantidade)} ${unidade} × ${fmtMoeda(movimento.custoUnitario)} = ${fmtMoeda(movimento.valorTotal)} · ESTORNADO`;
  }
  return `${fmtNumero(movimento.quantidade)} ${unidade} × ${fmtMoeda(movimento.precoUnitario)} = ${fmtMoeda(movimento.receita)} · lucro bruto ${fmtMoeda(movimento.lucroBruto)} · ESTORNADO`;
}

function criarBotaoEstorno(id, tipo) {
  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "comercial-btn-estornar";
  botao.dataset.estornarMovimento = id;
  botao.title = tipo === "compra" ? "Estornar compra" : "Estornar venda";
  botao.setAttribute("aria-label", botao.title);
  botao.textContent = "🗑️";
  return botao;
}

function criarEstilosEstorno() {
  if ($("comercialEstornoEstilos")) return;
  const style = document.createElement("style");
  style.id = "comercialEstornoEstilos";
  style.textContent = `
    .comercial-btn-estornar{
      width:38px;
      height:38px;
      flex:0 0 38px;
      padding:0;
      border:1px solid #fecaca;
      border-radius:10px;
      background:#fff1f2;
      color:#b91c1c;
      font-size:17px;
      line-height:1;
      cursor:pointer;
    }
    .comercial-btn-estornar:disabled{opacity:.55;cursor:wait}
    #listaHistorico>.comercial-movimento-estornado{
      border-left-color:#94a3b8!important;
      background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)!important;
      opacity:.82;
    }
    #listaHistorico .badge.estornado{
      background:#e2e8f0!important;
      color:#475569!important;
      border-color:#cbd5e1!important;
    }
    #listaHistorico>.comercial-movimento-estornado .meta{
      color:#64748b!important;
    }
    @media(max-width:760px){
      .comercial-btn-estornar{width:40px;height:40px;flex-basis:40px}
    }
  `;
  document.head.appendChild(style);
}

function adicionarBotoesEstorno(idLista, tipo) {
  const lista = $(idLista);
  if (!lista) return;

  lista.querySelectorAll(":scope > .item").forEach((item) => {
    const editar = item.querySelector("[data-editar-movimento]");
    const id = String(editar?.dataset?.editarMovimento || "");
    if (!id || item.querySelector("[data-estornar-movimento]")) return;
    const movimento = movimentoEstado(id);
    if (!movimento || movimento.tipo !== tipo) return;

    const acoes = item.querySelector(".comercial-item-acoes");
    if (acoes) acoes.appendChild(criarBotaoEstorno(id, tipo));
  });
}

function marcarHistoricoEstornado() {
  const lista = $("listaHistorico");
  if (!lista) return;

  const movimentos = ESTADO.movimentos
    .slice()
    .sort(ordenarMovimentosDesc)
    .slice(0, 100);
  const itens = [...lista.querySelectorAll(":scope > .item")];

  itens.forEach((item, indice) => {
    const movimento = movimentos[indice];
    if (!movimento || movimento.tipo !== "estorno") return;

    item.classList.add("comercial-movimento-estornado");
    const badge = item.querySelector(".badge");
    if (badge) {
      badge.className = "badge estornado";
      badge.textContent = movimento.tipoOriginal === "compra" ? "Compra estornada" : "Venda estornada";
    }
    item.querySelector("[data-editar-movimento]")?.remove();

    const meta = item.querySelector(".meta");
    if (meta) meta.textContent = `${movimento.data || ""} · ${detalheMovimentoEstornado(movimento)}`;
  });
}

function garantirAcoesMovimentos() {
  criarEstilosEstorno();
  adicionarBotoesEstorno("listaCompras", "compra");
  adicionarBotoesEstorno("listaVendas", "venda");
  marcarHistoricoEstornado();
}

function movimentoAlvoCompativel(atual, esperado) {
  if (!atual || !esperado) return false;
  if (String(atual.tipo || "") !== String(esperado.tipo || "")) return false;
  if (String(atual.produtoId || "") !== String(esperado.produtoId || "")) return false;
  if (quantidade(atual.quantidade) !== quantidade(esperado.quantidade)) return false;
  if (String(atual.data || "") !== String(esperado.data || "")) return false;
  if (esperado.tipo === "compra") {
    return moeda(atual.custoUnitario) === moeda(esperado.custoUnitario);
  }
  return moeda(atual.precoUnitario) === moeda(esperado.precoUnitario);
}

async function estornarMovimento(id) {
  const exibido = movimentoEstado(id);
  if (!exibido || !["compra", "venda"].includes(exibido.tipo) || ESTORNANDO.has(id)) return;

  const rotulo = exibido.tipo === "compra" ? "compra" : "venda";
  const mensagem = exibido.tipo === "compra"
    ? "Estornar esta compra?\n\nA entrada será retirada do estoque e o custo médio será recalculado. Se o estorno deixar alguma venda posterior sem estoque, a operação será bloqueada. O registro continuará no Histórico."
    : "Estornar esta venda?\n\nA quantidade será devolvida ao estoque e a venda deixará de compor faturamento, lucro e resultado. O registro continuará no Histórico.";

  if (!window.confirm(mensagem)) return;
  if (ESTADO.salvando) return toast("Aguarde a operação atual terminar.", "erro");

  ESTORNANDO.add(id);
  ESTADO.salvando = true;
  const botao = document.querySelector(`[data-estornar-movimento="${CSS.escape(String(id))}"]`);
  if (botao) botao.disabled = true;

  try {
    const movimentosFrescos = await carregarMovimentosFrescos();
    const atual = movimentosFrescos.find((m) => String(m.id) === String(id));
    if (!atual) throw new Error("Movimentação não encontrada.");
    if (!["compra", "venda"].includes(atual.tipo)) {
      throw new Error("Esta movimentação já foi estornada ou não pode ser estornada.");
    }

    const produtoId = String(atual.produtoId || "");
    if (!produtoId) throw new Error("A movimentação não possui produto relacionado.");

    const simulacaoAntes = simularProduto(produtoId, movimentosFrescos);
    const movimentosDepois = substituirMovimento(movimentosFrescos, id, {
      tipo: "estorno",
      tipoOriginal: atual.tipo,
      estornado: true
    });
    const simulacaoDepois = simularProduto(produtoId, movimentosDepois);
    const simulacoes = new Map([[produtoId, simulacaoDepois]]);
    const plano = prepararRecalculo(simulacoes, movimentosFrescos);
    const movimentosPorId = new Map(movimentosFrescos.map((m) => [m.id, m]));

    await runTransaction(db, async (tx) => {
      const alvoRef = movimentoRef(id);
      const alvoSnap = await tx.get(alvoRef);
      const produtoSnap = await tx.get(produtoRef(produtoId));

      const vendasLidas = new Map();
      for (const idVenda of plano.atualizacoesVendas.keys()) {
        vendasLidas.set(idVenda, await tx.get(movimentoRef(idVenda)));
      }

      if (!alvoSnap.exists()) throw new Error("Movimentação não encontrada.");
      if (!produtoSnap.exists()) throw new Error("Produto relacionado não encontrado.");
      if (!movimentoAlvoCompativel(alvoSnap.data(), atual)) {
        throw new Error("A movimentação mudou enquanto o estorno era preparado. Aguarde a atualização da tela e tente novamente.");
      }
      if (!estadoProdutoCompativel(produtoSnap.data(), simulacaoAntes)) {
        throw new Error("O estoque mudou enquanto o estorno era preparado. Aguarde a atualização da tela e tente novamente.");
      }

      for (const [idVenda, vendaSnap] of vendasLidas.entries()) {
        if (!vendaSnap.exists() || !movimentoCompativel(vendaSnap.data(), movimentosPorId.get(idVenda))) {
          throw new Error("Uma venda relacionada mudou enquanto o estorno era preparado. Aguarde a atualização da tela e tente novamente.");
        }
      }

      tx.update(alvoRef, {
        tipo: "estorno",
        tipoOriginal: atual.tipo,
        estornado: true,
        estornadoPor: ESTADO.usuario?.uid || "",
        estornadoEm: serverTimestamp(),
        atualizadoPor: ESTADO.usuario?.uid || "",
        atualizadoEm: serverTimestamp()
      });
      aplicarRecalculoNaTransacao(tx, plano);
    });

    toast(`${rotulo === "compra" ? "Compra" : "Venda"} estornada. Estoque e fechamento recalculados; Histórico preservado.`, "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || `Não foi possível estornar a ${rotulo}.`, "erro");
    if (botao) botao.disabled = false;
  } finally {
    ESTORNANDO.delete(id);
    ESTADO.salvando = false;
  }
}

function configurarEventosEstorno() {
  if (eventosEstornoConfigurados) return;
  eventosEstornoConfigurados = true;
  criarEstilosEstorno();

  document.addEventListener("click", (evento) => {
    const botao = evento.target.closest("[data-estornar-movimento]");
    if (!botao) return;
    evento.preventDefault();
    evento.stopPropagation();
    estornarMovimento(String(botao.dataset.estornarMovimento || ""));
  });
}

function iniciarListeners() {
  ESTADO.unsubscribeProdutos?.();
  ESTADO.unsubscribeMovimentos?.();

  const r = refs();

  ESTADO.unsubscribeProdutos = onSnapshot(
    query(r.produtos, orderBy("nome")),
    (snap) => {
      ESTADO.produtos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderProdutos();
      garantirAcoesProdutos();
      normalizarSeletoresProdutos();
      renderDashboardPorDatas();
      status("");
    },
    (erro) => {
      console.error(erro);
      status("Não foi possível carregar os produtos comerciais.", true);
    }
  );

  ESTADO.unsubscribeMovimentos = onSnapshot(
    query(r.movimentos, orderBy("criadoEm", "desc")),
    (snap) => {
      ESTADO.movimentos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderMovimentos();
      garantirAcoesMovimentos();
      renderDashboardPorDatas();
      status("");
    },
    (erro) => {
      console.error(erro);
      status("Não foi possível carregar as movimentações comerciais.", true);
    }
  );
}

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    window.location.href = "./index.html";
    return;
  }

  ESTADO.usuario = usuario;
  status("Validando acesso ao Comercial...");

  try {
    ESTADO.permitido = await verificarAcesso(usuario);

    if (!ESTADO.permitido) {
      $("appComercial").hidden = true;
      $("acessoNegado").hidden = false;
      return;
    }

    $("acessoNegado").hidden = true;
    $("appComercial").hidden = false;
    $("btnAdminComercial").hidden = !ESTADO.adminSistema;

    configurarEventosOperacoes();
    configurarEventosEstorno();
    configurarVendaUi();
    renderPeriodos();
    configurarFiltroDashboardDatas();
    iniciarListeners();
  } catch (erro) {
    console.error(erro);
    $("appComercial").hidden = true;
    $("acessoNegado").hidden = false;
  }
});

window.addEventListener("beforeunload", () => {
  ESTADO.unsubscribeProdutos?.();
  ESTADO.unsubscribeMovimentos?.();
});

console.log(`✅ Comercial independente ${VERSAO} · estorno seguro ativo`);
