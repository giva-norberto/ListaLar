// ListaLar Comercial 1.2.0 — cadastros, valores manuais e edição
import { doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  $, ESTADO, db, refs, produtoRef, movimentoRef,
  produtoPorId, movimentoPorId, normalizarTexto,
  numeroDigitado, moeda, quantidade, fmtNumero,
  fmtCampoMoeda, fmtCampoQuantidade, hoje, dataValida, toast
} from "./comercial-contexto.js?v=1.2.0";
import {
  carregarMovimentosFrescos, substituirMovimento, simularProduto,
  estadoProdutoCompativel, prepararRecalculo, movimentoCompativel,
  aplicarRecalculoNaTransacao
} from "./comercial-calculos.js?v=1.2.0";
import { abrirTela, configurarNavegacao, renderDashboard } from "./comercial-render.js?v=1.2.0";

function tituloFormulario(formId) {
  return $(formId)?.closest(".card")?.querySelector("h2") || null;
}

function labelCampo(id) {
  return $(id)?.closest(".field")?.querySelector("label") || null;
}

function garantirBotaoCancelar(formId, id, texto) {
  if ($(id)) return $(id);
  const form = $(formId);
  const salvar = form?.querySelector('button[type="submit"]');
  if (!form || !salvar) return null;
  const botao = document.createElement("button");
  botao.id = id;
  botao.type = "button";
  botao.className = "btn secondary";
  botao.textContent = texto;
  botao.hidden = true;
  form.insertBefore(botao, salvar);
  return botao;
}

function criarEstilosEdicao() {
  if ($("comercialEdicaoEstilos")) return;
  const style = document.createElement("style");
  style.id = "comercialEdicaoEstilos";
  style.textContent = `
    .comercial-item-acoes{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}
    .comercial-btn-editar{min-height:30px!important;padding:5px 9px!important;border-radius:9px!important;font-size:10px!important}
    .badge.ajuste{background:#fef3c7;color:#92400e}
    .comercial-edicao-info{margin:8px 0 11px;padding:9px 10px;border:1px solid #bae6fd;border-radius:11px;background:#f0f9ff;color:#075985;font-size:11px;font-weight:800;line-height:1.45}
    .comercial-edicao-info strong{font-weight:900}
  `;
  document.head.appendChild(style);
}

function inserirInformacao(formId, texto) {
  const form = $(formId);
  const card = form?.closest(".card");
  if (!card || card.querySelector(`.comercial-edicao-info[data-form="${formId}"]`)) return;
  const aviso = document.createElement("div");
  aviso.className = "comercial-edicao-info";
  aviso.dataset.form = formId;
  aviso.innerHTML = texto;
  form.insertAdjacentElement("afterend", aviso);
}

function configurarDatas() {
  ["compraData", "vendaData", "despesaData"].forEach((id) => {
    if ($(id) && !$(id).value) $(id).value = hoje();
  });
}

function formatarCampoAoSair(id, tipo = "moeda") {
  const campo = $(id);
  if (!campo) return;
  campo.autocomplete = "off";
  campo.addEventListener("blur", () => {
    if (!String(campo.value || "").trim()) return;
    const valor = numeroDigitado(campo.value);
    if (!Number.isFinite(valor)) return;
    campo.value = tipo === "quantidade" ? fmtCampoQuantidade(valor) : fmtCampoMoeda(valor);
  });
}

function configurarCamposManuais() {
  ["produtoCusto", "produtoVenda", "compraCusto", "vendaValor", "despesaValor"].forEach((id) => {
    const campo = $(id);
    if (campo) {
      campo.type = "text";
      campo.inputMode = "decimal";
    }
    formatarCampoAoSair(id, "moeda");
  });
  ["produtoEstoque", "compraQtd", "vendaQtd"].forEach((id) => {
    const campo = $(id);
    if (campo) {
      campo.type = "text";
      campo.inputMode = "decimal";
    }
    formatarCampoAoSair(id, "quantidade");
  });
}

function prepararInterfaceEdicao() {
  criarEstilosEdicao();
  configurarDatas();
  configurarCamposManuais();
  garantirBotaoCancelar("formProduto", "cancelarEdicaoProduto", "Cancelar edição");
  garantirBotaoCancelar("formCompra", "cancelarEdicaoCompra", "Cancelar edição");
  garantirBotaoCancelar("formVenda", "cancelarEdicaoVenda", "Cancelar edição");
  garantirBotaoCancelar("formDespesa", "cancelarEdicaoDespesa", "Cancelar edição");

  inserirInformacao("formProduto", "⌨️ <strong>Digitação manual:</strong> custo, preço e estoque aceitam 10,50 ou 10.50. Depois de salvar, use <strong>Editar</strong> para corrigir o cadastro.");
  inserirInformacao("formCompra", "✏️ Compras salvas continuam editáveis. Produto, quantidade, custo e data podem ser corrigidos com recálculo do estoque.");
  inserirInformacao("formVenda", "✏️ Vendas salvas continuam editáveis. Produto, quantidade, preço e data podem ser corrigidos sem permitir estoque negativo.");
  inserirInformacao("formDespesa", "✏️ Descrição, valor e data da despesa podem ser alterados mesmo depois do lançamento.");
}

export async function cadastrarProduto(evento) {
  evento.preventDefault();
  if (ESTADO.salvando) return;
  if (ESTADO.edicao.produtoId) return salvarEdicaoProduto();

  const nome = String($("produtoNome").value || "").trim();
  const custoTexto = String($("produtoCusto").value || "").trim();
  const vendaTexto = String($("produtoVenda").value || "").trim();
  const estoqueTexto = String($("produtoEstoque").value || "").trim();
  const custo = custoTexto ? numeroDigitado(custoTexto) : 0;
  const precoVenda = vendaTexto ? numeroDigitado(vendaTexto) : 0;
  const estoqueInicial = estoqueTexto ? numeroDigitado(estoqueTexto) : 0;

  if (!nome) return toast("Informe o produto.", "erro");
  if (![custo, precoVenda, estoqueInicial].every(Number.isFinite)) return toast("Digite valores numéricos válidos. Ex.: 10,50.", "erro");
  if (custo < 0 || precoVenda < 0 || estoqueInicial < 0) return toast("Valores não podem ser negativos.", "erro");
  if (ESTADO.produtos.some((p) => normalizarTexto(p.nome) === normalizarTexto(nome))) {
    return toast("Já existe um produto comercial com esse nome.", "erro");
  }

  ESTADO.salvando = true;
  try {
    const produtoNovoRef = doc(refs().produtos);
    const movimentoNovoRef = estoqueInicial > 0 ? doc(refs().movimentos) : null;
    await runTransaction(db, async (tx) => {
      tx.set(produtoNovoRef, {
        nome,
        custoMedio: moeda(custo),
        precoVenda: moeda(precoVenda),
        estoque: quantidade(estoqueInicial),
        ativo: true,
        criadoPor: ESTADO.usuario.uid,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
      if (movimentoNovoRef) {
        tx.set(movimentoNovoRef, {
          tipo: "compra",
          produtoId: produtoNovoRef.id,
          produtoNome: nome,
          quantidade: quantidade(estoqueInicial),
          custoUnitario: moeda(custo),
          valorTotal: moeda(estoqueInicial * custo),
          data: hoje(),
          origem: "estoque-inicial",
          criadoPor: ESTADO.usuario.uid,
          criadoEm: serverTimestamp()
        });
      }
    });
    limparFormularioProduto();
    toast("Produto comercial cadastrado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível cadastrar o produto.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

export function iniciarEdicaoProduto(id) {
  const p = produtoPorId(id);
  if (!p) return;
  limparFormularioCompra();
  limparFormularioVenda();
  limparFormularioDespesa();
  ESTADO.edicao.produtoId = id;
  abrirTela("produtos");
  const titulo = tituloFormulario("formProduto");
  if (titulo) titulo.textContent = "Editar produto de revenda";
  const label = labelCampo("produtoEstoque");
  if (label) label.textContent = "Estoque atual";
  $("produtoNome").value = p.nome || "";
  $("produtoCusto").value = fmtCampoMoeda(p.custoMedio);
  $("produtoVenda").value = fmtCampoMoeda(p.precoVenda);
  $("produtoEstoque").value = fmtCampoQuantidade(p.estoque);
  $("formProduto").querySelector('button[type="submit"]').textContent = "Salvar alterações";
  $("cancelarEdicaoProduto").hidden = false;
  $("formProduto").scrollIntoView({ behavior: "smooth", block: "start" });
  $("produtoNome").focus();
}

export function limparFormularioProduto() {
  ESTADO.edicao.produtoId = "";
  $("formProduto")?.reset();
  if ($("produtoEstoque")) $("produtoEstoque").value = "0";
  const titulo = tituloFormulario("formProduto");
  if (titulo) titulo.textContent = "Novo produto de revenda";
  const label = labelCampo("produtoEstoque");
  if (label) label.textContent = "Estoque inicial";
  const salvar = $("formProduto")?.querySelector('button[type="submit"]');
  if (salvar) salvar.textContent = "Cadastrar";
  if ($("cancelarEdicaoProduto")) $("cancelarEdicaoProduto").hidden = true;
}

async function salvarEdicaoProduto() {
  const id = ESTADO.edicao.produtoId;
  const atual = produtoPorId(id);
  if (!atual) return toast("Produto não encontrado.", "erro");

  const nome = String($("produtoNome").value || "").trim();
  const custo = numeroDigitado($("produtoCusto").value);
  const precoVenda = numeroDigitado($("produtoVenda").value);
  const estoqueAtual = numeroDigitado($("produtoEstoque").value);
  if (!nome) return toast("Informe o produto.", "erro");
  if (![custo, precoVenda, estoqueAtual].every(Number.isFinite)) return toast("Preencha custo, preço e estoque com números válidos.", "erro");
  if (custo < 0 || precoVenda < 0 || estoqueAtual < 0) return toast("Valores não podem ser negativos.", "erro");
  if (ESTADO.produtos.some((p) => p.id !== id && normalizarTexto(p.nome) === normalizarTexto(nome))) {
    return toast("Já existe outro produto comercial com esse nome.", "erro");
  }

  ESTADO.salvando = true;
  try {
    const pRef = produtoRef(id);
    const ajusteNecessario = quantidade(atual.estoque) !== quantidade(estoqueAtual) || moeda(atual.custoMedio) !== moeda(custo);
    const ajusteRef = ajusteNecessario ? doc(refs().movimentos) : null;
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(pRef);
      if (!snap.exists()) throw new Error("Produto não encontrado.");
      const salvo = snap.data();
      tx.update(pRef, {
        nome,
        custoMedio: moeda(custo),
        precoVenda: moeda(precoVenda),
        estoque: quantidade(estoqueAtual),
        atualizadoPor: ESTADO.usuario.uid,
        atualizadoEm: serverTimestamp()
      });
      if (ajusteRef) {
        tx.set(ajusteRef, {
          tipo: "ajuste",
          produtoId: id,
          produtoNome: nome,
          descricao: "Correção manual do cadastro",
          estoqueAnterior: quantidade(salvo.estoque),
          estoqueNovo: quantidade(estoqueAtual),
          custoAnterior: moeda(salvo.custoMedio),
          custoNovo: moeda(custo),
          data: hoje(),
          origem: "correcao-cadastro",
          criadoPor: ESTADO.usuario.uid,
          criadoEm: serverTimestamp()
        });
      }
    });
    limparFormularioProduto();
    toast(ajusteNecessario ? "Produto atualizado e correção registrada no Histórico." : "Produto atualizado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível atualizar o produto.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

export async function registrarCompra(evento) {
  evento.preventDefault();
  if (ESTADO.salvando) return;
  const produtoId = $("compraProduto").value;
  const qtd = numeroDigitado($("compraQtd").value);
  const custo = numeroDigitado($("compraCusto").value);
  const data = $("compraData").value || hoje();
  const produtoAtual = produtoPorId(produtoId);
  if (!produtoAtual || !Number.isFinite(qtd) || !Number.isFinite(custo) || qtd <= 0 || custo < 0 || !dataValida(data)) {
    return toast("Confira produto, quantidade, custo e data.", "erro");
  }
  if (ESTADO.edicao.compraId) {
    return salvarEdicaoMovimento("compra", {
      produtoId,
      produtoNome: produtoAtual.nome,
      quantidade: quantidade(qtd),
      custoUnitario: moeda(custo),
      valorTotal: moeda(qtd * custo),
      data
    });
  }

  ESTADO.salvando = true;
  try {
    const pRef = produtoRef(produtoId);
    const novoRef = doc(refs().movimentos);
    await runTransaction(db, async (tx) => {
      const pSnap = await tx.get(pRef);
      if (!pSnap.exists()) throw new Error("Produto não encontrado.");
      const salvo = pSnap.data();
      const estoqueAntigo = quantidade(salvo.estoque);
      const custoAntigo = moeda(salvo.custoMedio);
      const estoqueNovo = quantidade(estoqueAntigo + qtd);
      const custoNovo = estoqueNovo > 0
        ? moeda(((estoqueAntigo * custoAntigo) + (qtd * custo)) / estoqueNovo)
        : 0;
      tx.update(pRef, { estoque: estoqueNovo, custoMedio: custoNovo, atualizadoEm: serverTimestamp() });
      tx.set(novoRef, {
        tipo: "compra", produtoId, produtoNome: produtoAtual.nome,
        quantidade: quantidade(qtd), custoUnitario: moeda(custo),
        valorTotal: moeda(qtd * custo), data,
        criadoPor: ESTADO.usuario.uid, criadoEm: serverTimestamp()
      });
    });
    limparFormularioCompra();
    toast("Compra registrada e custo médio atualizado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível registrar a compra.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

export async function registrarVenda(evento) {
  evento.preventDefault();
  if (ESTADO.salvando) return;
  const produtoId = $("vendaProduto").value;
  const qtd = numeroDigitado($("vendaQtd").value);
  const preco = numeroDigitado($("vendaValor").value);
  const data = $("vendaData").value || hoje();
  const produtoAtual = produtoPorId(produtoId);
  if (!produtoAtual || !Number.isFinite(qtd) || !Number.isFinite(preco) || qtd <= 0 || preco < 0 || !dataValida(data)) {
    return toast("Confira produto, quantidade, preço e data.", "erro");
  }
  if (ESTADO.edicao.vendaId) {
    return salvarEdicaoMovimento("venda", {
      produtoId,
      produtoNome: produtoAtual.nome,
      quantidade: quantidade(qtd),
      precoUnitario: moeda(preco),
      data
    });
  }

  ESTADO.salvando = true;
  try {
    const pRef = produtoRef(produtoId);
    const novoRef = doc(refs().movimentos);
    await runTransaction(db, async (tx) => {
      const pSnap = await tx.get(pRef);
      if (!pSnap.exists()) throw new Error("Produto não encontrado.");
      const salvo = pSnap.data();
      const estoque = quantidade(salvo.estoque);
      if (qtd > estoque + 0.0001) throw new Error(`Estoque insuficiente. Disponível: ${fmtNumero(estoque)}.`);
      const custoUnitario = moeda(salvo.custoMedio);
      const receita = moeda(qtd * preco);
      const custoTotal = moeda(qtd * custoUnitario);
      tx.update(pRef, {
        estoque: quantidade(estoque - qtd),
        precoVenda: moeda(preco),
        atualizadoEm: serverTimestamp()
      });
      tx.set(novoRef, {
        tipo: "venda", produtoId, produtoNome: produtoAtual.nome,
        quantidade: quantidade(qtd), precoUnitario: moeda(preco),
        custoUnitario, receita, custoTotal,
        lucroBruto: moeda(receita - custoTotal), data,
        criadoPor: ESTADO.usuario.uid, criadoEm: serverTimestamp()
      });
    });
    limparFormularioVenda();
    toast("Venda registrada e estoque baixado.", "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível registrar a venda.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

export async function registrarDespesa(evento) {
  evento.preventDefault();
  if (ESTADO.salvando) return;
  const descricao = String($("despesaDescricao").value || "").trim();
  const valor = numeroDigitado($("despesaValor").value);
  const data = $("despesaData").value || hoje();
  if (!descricao || !Number.isFinite(valor) || valor <= 0 || !dataValida(data)) {
    return toast("Informe descrição, valor e data válidos.", "erro");
  }
  if (ESTADO.edicao.despesaId) return salvarEdicaoMovimento("despesa", { descricao, valor: moeda(valor), data });

  ESTADO.salvando = true;
  try {
    const novoRef = doc(refs().movimentos);
    await runTransaction(db, async (tx) => {
      tx.set(novoRef, {
        tipo: "despesa", descricao, valor: moeda(valor), data,
        criadoPor: ESTADO.usuario.uid, criadoEm: serverTimestamp()
      });
    });
    limparFormularioDespesa();
    toast("Despesa registrada.", "ok");
  } catch (erro) {
    console.error(erro);
    toast("Não foi possível registrar a despesa.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

export function iniciarEdicaoMovimento(id) {
  const m = movimentoPorId(id);
  if (!m || !["compra", "venda", "despesa"].includes(m.tipo)) return;
  limparFormularioProduto();

  if (m.tipo === "compra") {
    limparFormularioVenda();
    limparFormularioDespesa();
    ESTADO.edicao.compraId = id;
    abrirTela("compras");
    const titulo = tituloFormulario("formCompra");
    if (titulo) titulo.textContent = "Editar compra";
    $("compraProduto").value = m.produtoId || "";
    $("compraQtd").value = fmtCampoQuantidade(m.quantidade);
    $("compraCusto").value = fmtCampoMoeda(m.custoUnitario);
    $("compraData").value = m.data || hoje();
    $("formCompra").querySelector('button[type="submit"]').textContent = "Salvar alterações";
    $("cancelarEdicaoCompra").hidden = false;
    $("formCompra").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (m.tipo === "venda") {
    limparFormularioCompra();
    limparFormularioDespesa();
    ESTADO.edicao.vendaId = id;
    abrirTela("vendas");
    const titulo = tituloFormulario("formVenda");
    if (titulo) titulo.textContent = "Editar venda";
    $("vendaProduto").value = m.produtoId || "";
    $("vendaQtd").value = fmtCampoQuantidade(m.quantidade);
    $("vendaValor").value = fmtCampoMoeda(m.precoUnitario);
    $("vendaData").value = m.data || hoje();
    $("formVenda").querySelector('button[type="submit"]').textContent = "Salvar alterações";
    $("cancelarEdicaoVenda").hidden = false;
    $("formVenda").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  limparFormularioCompra();
  limparFormularioVenda();
  ESTADO.edicao.despesaId = id;
  abrirTela("despesas");
  const titulo = tituloFormulario("formDespesa");
  if (titulo) titulo.textContent = "Editar despesa";
  $("despesaDescricao").value = m.descricao || "";
  $("despesaValor").value = fmtCampoMoeda(m.valor);
  $("despesaData").value = m.data || hoje();
  $("formDespesa").querySelector('button[type="submit"]').textContent = "Salvar alterações";
  $("cancelarEdicaoDespesa").hidden = false;
  $("formDespesa").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function salvarEdicaoMovimento(tipo, novosDados) {
  const chave = tipo === "compra" ? "compraId" : tipo === "venda" ? "vendaId" : "despesaId";
  const id = ESTADO.edicao[chave];
  if (!id || !movimentoPorId(id)) return toast("Registro não encontrado.", "erro");

  ESTADO.salvando = true;
  try {
    if (tipo === "despesa") {
      await runTransaction(db, async (tx) => {
        const ref = movimentoRef(id);
        const snap = await tx.get(ref);
        if (!snap.exists() || snap.data()?.tipo !== "despesa") throw new Error("Despesa não encontrada.");
        tx.update(ref, {
          ...novosDados,
          atualizadoPor: ESTADO.usuario.uid,
          atualizadoEm: serverTimestamp()
        });
      });
      limparFormularioDespesa();
      toast("Despesa atualizada.", "ok");
      return;
    }

    const movimentosFrescos = await carregarMovimentosFrescos();
    const antigo = movimentosFrescos.find((m) => m.id === id);
    if (!antigo || antigo.tipo !== tipo) throw new Error("Movimentação não encontrada.");

    const simulados = substituirMovimento(movimentosFrescos, id, novosDados);
    const idsAfetados = new Set([antigo.produtoId, novosDados.produtoId].filter(Boolean));
    const simulacoesAntes = new Map();
    const simulacoes = new Map();
    idsAfetados.forEach((idProduto) => {
      simulacoesAntes.set(idProduto, simularProduto(idProduto, movimentosFrescos));
      simulacoes.set(idProduto, simularProduto(idProduto, simulados));
    });

    if (tipo === "venda") {
      const derivado = simulacoes.get(novosDados.produtoId)?.vendasDerivadas.find((v) => v.id === id);
      if (!derivado) throw new Error("Não foi possível recalcular o custo histórico desta venda.");
      novosDados.custoUnitario = derivado.custoUnitario;
      novosDados.custoTotal = derivado.custoTotal;
      novosDados.receita = derivado.receita;
      novosDados.lucroBruto = derivado.lucroBruto;
    }

    const plano = prepararRecalculo(simulacoes, movimentosFrescos, new Set([id]));
    const movimentosPorId = new Map(movimentosFrescos.map((m) => [m.id, m]));

    await runTransaction(db, async (tx) => {
      const ref = movimentoRef(id);
      const snap = await tx.get(ref);
      if (!snap.exists() || snap.data()?.tipo !== tipo) throw new Error("Movimentação não encontrada.");

      const produtosLidos = new Map();
      for (const idProduto of idsAfetados) {
        const pSnap = await tx.get(produtoRef(idProduto));
        produtosLidos.set(idProduto, pSnap);
      }

      const vendasLidas = new Map();
      for (const idVenda of plano.atualizacoesVendas.keys()) {
        vendasLidas.set(idVenda, await tx.get(movimentoRef(idVenda)));
      }

      for (const [idProduto, pSnap] of produtosLidos.entries()) {
        if (!pSnap.exists()) throw new Error("Produto relacionado não encontrado.");
        if (!estadoProdutoCompativel(pSnap.data(), simulacoesAntes.get(idProduto))) {
          throw new Error("Os dados comerciais mudaram enquanto a correção era preparada. Aguarde a atualização da tela e tente novamente.");
        }
      }

      for (const [idVenda, vendaSnap] of vendasLidas.entries()) {
        if (!vendaSnap.exists() || !movimentoCompativel(vendaSnap.data(), movimentosPorId.get(idVenda))) {
          throw new Error("Uma venda relacionada mudou enquanto a correção era preparada. Aguarde a atualização da tela e tente novamente.");
        }
      }

      tx.update(ref, {
        ...novosDados,
        atualizadoPor: ESTADO.usuario.uid,
        atualizadoEm: serverTimestamp()
      });
      aplicarRecalculoNaTransacao(tx, plano);
    });

    if (tipo === "compra") limparFormularioCompra();
    else limparFormularioVenda();
    toast(`${tipo === "compra" ? "Compra" : "Venda"} atualizada e estoque recalculado.`, "ok");
  } catch (erro) {
    console.error(erro);
    toast(erro?.message || "Não foi possível salvar a correção.", "erro");
  } finally {
    ESTADO.salvando = false;
  }
}

export function limparFormularioCompra() {
  ESTADO.edicao.compraId = "";
  $("formCompra")?.reset();
  if ($("compraData")) $("compraData").value = hoje();
  const titulo = tituloFormulario("formCompra");
  if (titulo) titulo.textContent = "Registrar compra";
  const salvar = $("formCompra")?.querySelector('button[type="submit"]');
  if (salvar) salvar.textContent = "Registrar compra";
  if ($("cancelarEdicaoCompra")) $("cancelarEdicaoCompra").hidden = true;
}

export function limparFormularioVenda() {
  ESTADO.edicao.vendaId = "";
  $("formVenda")?.reset();
  if ($("vendaData")) $("vendaData").value = hoje();
  const titulo = tituloFormulario("formVenda");
  if (titulo) titulo.textContent = "Registrar venda";
  const salvar = $("formVenda")?.querySelector('button[type="submit"]');
  if (salvar) salvar.textContent = "Registrar venda";
  if ($("cancelarEdicaoVenda")) $("cancelarEdicaoVenda").hidden = true;
}

export function limparFormularioDespesa() {
  ESTADO.edicao.despesaId = "";
  $("formDespesa")?.reset();
  if ($("despesaData")) $("despesaData").value = hoje();
  const titulo = tituloFormulario("formDespesa");
  if (titulo) titulo.textContent = "Registrar despesa";
  const salvar = $("formDespesa")?.querySelector('button[type="submit"]');
  if (salvar) salvar.textContent = "Registrar despesa";
  if ($("cancelarEdicaoDespesa")) $("cancelarEdicaoDespesa").hidden = true;
}

export function configurarEventosOperacoes() {
  if (ESTADO.eventosConfigurados) return;
  ESTADO.eventosConfigurados = true;
  prepararInterfaceEdicao();
  configurarNavegacao();

  $("formProduto").addEventListener("submit", cadastrarProduto);
  $("formCompra").addEventListener("submit", registrarCompra);
  $("formVenda").addEventListener("submit", registrarVenda);
  $("formDespesa").addEventListener("submit", registrarDespesa);
  $("cancelarEdicaoProduto").addEventListener("click", limparFormularioProduto);
  $("cancelarEdicaoCompra").addEventListener("click", limparFormularioCompra);
  $("cancelarEdicaoVenda").addEventListener("click", limparFormularioVenda);
  $("cancelarEdicaoDespesa").addEventListener("click", limparFormularioDespesa);

  $("periodoDashboard").addEventListener("change", (e) => {
    ESTADO.periodo = e.target.value;
    renderDashboard();
  });

  $("vendaProduto").addEventListener("change", (e) => {
    if (ESTADO.edicao.vendaId) return;
    const p = produtoPorId(e.target.value);
    $("vendaValor").value = p ? fmtCampoMoeda(p.precoVenda) : "";
  });

  $("btnAdminComercial").addEventListener("click", () => {
    window.location.href = "./admin-comercial.html";
  });

  document.addEventListener("click", (evento) => {
    const editarProduto = evento.target.closest("[data-editar-produto]");
    if (editarProduto) {
      iniciarEdicaoProduto(editarProduto.dataset.editarProduto);
      return;
    }
    const editarMovimento = evento.target.closest("[data-editar-movimento]");
    if (editarMovimento) iniciarEdicaoMovimento(editarMovimento.dataset.editarMovimento);
  });
}
