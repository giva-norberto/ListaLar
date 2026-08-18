/**
 * ListaLar — Comparador de Preços
 * Arquivo: comparar-precos.js
 * Versão: 2.0.0
 *
 * Regra de identidade alinhada ao Nexus:
 * produtoId -> GTIN válido -> descrição normalizada + unidade.
 * codigoItem de loja NÃO é usado como identidade global, pois pode mudar por mercado.
 *
 * Não grava coleção nova no Firestore.
 */

(function (global) {
    "use strict";

    const VERSAO = "2.0.0";

    const ESTADO = {
        carregarHistorico: null,
        cacheHistorico: null,
        cacheEm: 0,
        cacheMs: 60000
    };

    function configurar(opcoes = {}) {
        if (typeof opcoes.carregarHistorico === "function") {
            ESTADO.carregarHistorico = opcoes.carregarHistorico;
        }
        if (Number.isFinite(opcoes.cacheMs) && opcoes.cacheMs >= 0) {
            ESTADO.cacheMs = opcoes.cacheMs;
        }
        return api;
    }

    function limparCache() {
        ESTADO.cacheHistorico = null;
        ESTADO.cacheEm = 0;
    }

    async function obterHistorico({ forcarAtualizacao = false } = {}) {
        const agora = Date.now();
        if (
            !forcarAtualizacao &&
            Array.isArray(ESTADO.cacheHistorico) &&
            agora - ESTADO.cacheEm < ESTADO.cacheMs
        ) {
            return ESTADO.cacheHistorico;
        }

        if (typeof ESTADO.carregarHistorico !== "function") {
            throw new Error("O comparar-precos.js precisa ser configurado pelo gastos.js com carregarHistorico().");
        }

        const recebido = await ESTADO.carregarHistorico();
        if (!Array.isArray(recebido)) {
            throw new Error("carregarHistorico() deve retornar um array.");
        }

        const historico = recebido.map(normalizarRegistro).filter(Boolean);
        ESTADO.cacheHistorico = historico;
        ESTADO.cacheEm = agora;
        return historico;
    }

    async function compararProduto(produtoAtual, opcoes = {}) {
        const historico = await obterHistorico(opcoes);
        return compararProdutoComHistorico(produtoAtual, historico);
    }

    async function compararTodos(produtosAtuais, opcoes = {}) {
        const historico = await obterHistorico(opcoes);
        const lista = Array.isArray(produtosAtuais) ? produtosAtuais : [];
        return lista.map((produto) => compararProdutoComHistorico(produto, historico));
    }

    function compararProdutoComHistorico(produtoAtual, historico = []) {
        const atual = normalizarRegistro(produtoAtual);
        if (!atual) return resultadoVazio(produtoAtual);

        const iguais = historico
            .map(normalizarRegistro)
            .filter(Boolean)
            .filter((item) => mesmoProduto(atual, item))
            .filter((item) => item.precoUnitario > 0)
            .sort(ordenarPorData);

        if (!iguais.length) {
            return {
                ...resultadoBase(atual),
                possuiHistorico: false,
                quantidadeHistorico: 0,
                ultimoPreco: 0,
                menorPreco: 0,
                maiorPreco: 0,
                precoMedio: 0,
                melhorMercado: "",
                piorMercado: "",
                dataUltimaCompra: "",
                economiaVsUltimo: 0,
                economiaVsMedia: 0,
                diferencaPercentualVsMedia: 0,
                classificacao: { codigo: "SEM_HISTORICO", rotulo: "Sem histórico", simbolo: "⚪" }
            };
        }

        const ultimo = iguais[iguais.length - 1];
        const menor = iguais.reduce((a, b) => b.precoUnitario < a.precoUnitario ? b : a, iguais[0]);
        const maior = iguais.reduce((a, b) => b.precoUnitario > a.precoUnitario ? b : a, iguais[0]);
        const precoMedio = arredondar(iguais.reduce((s, item) => s + item.precoUnitario, 0) / iguais.length, 2);
        const precoAtual = atual.precoUnitario;

        return {
            ...resultadoBase(atual),
            possuiHistorico: true,
            quantidadeHistorico: iguais.length,
            ultimoPreco: arredondar(ultimo.precoUnitario, 2),
            menorPreco: arredondar(menor.precoUnitario, 2),
            maiorPreco: arredondar(maior.precoUnitario, 2),
            precoMedio,
            melhorMercado: menor.mercadoNome || "",
            piorMercado: maior.mercadoNome || "",
            dataUltimaCompra: ultimo.dataCompra || "",
            economiaVsUltimo: precoAtual > 0 ? arredondar(ultimo.precoUnitario - precoAtual, 2) : 0,
            economiaVsMedia: precoAtual > 0 ? arredondar(precoMedio - precoAtual, 2) : 0,
            diferencaPercentualVsMedia: precoAtual > 0 && precoMedio > 0
                ? arredondar(((precoAtual - precoMedio) / precoMedio) * 100, 1)
                : 0,
            classificacao: classificarPreco(precoAtual, precoMedio),
            historico: iguais.map((item) => ({
                dataCompra: item.dataCompra,
                mercadoNome: item.mercadoNome,
                precoUnitario: item.precoUnitario,
                precoTotal: item.precoTotal,
                quantidade: item.quantidade,
                unidade: item.unidade
            }))
        };
    }

    /**
     * Analisa todo o histórico usando a mesma lógica-base do Nexus:
     * - agrupa por produtoId; se ausente, GTIN; por fim descrição + unidade;
     * - compara primeiro x último preço cronológico;
     * - localiza menor e maior preço e respectivos estabelecimentos;
     * - calcula variação percentual;
     * - calcula impacto adicional positivo contra o primeiro preço, ponderado pela quantidade;
     * - economia potencial considera o último preço versus o menor preço observado, na quantidade da última compra.
     */
    function analisarHistorico(historicoRecebido = []) {
        const historico = (Array.isArray(historicoRecebido) ? historicoRecebido : [])
            .map(normalizarRegistro)
            .filter((item) => item && item.precoUnitario > 0 && criarChaveProduto(item));

        const grupos = new Map();
        for (const item of historico) {
            const chave = criarChaveProduto(item);
            if (!grupos.has(chave)) grupos.set(chave, []);
            grupos.get(chave).push(item);
        }

        const produtos = [];
        const vitoriasMercado = new Map();

        for (const [chaveProduto, registros] of grupos.entries()) {
            const ordenados = [...registros].sort(ordenarPorData);
            if (ordenados.length < 2) continue;

            const primeiro = ordenados[0];
            const atual = ordenados[ordenados.length - 1];
            const anterior = ordenados[ordenados.length - 2];
            const anteriores = ordenados.slice(0, -1);

            const menorGeral = ordenados.reduce((a, b) => b.precoUnitario < a.precoUnitario ? b : a, ordenados[0]);
            const maiorGeral = ordenados.reduce((a, b) => b.precoUnitario > a.precoUnitario ? b : a, ordenados[0]);
            const precoMedioAnterior = anteriores.length
                ? arredondar(anteriores.reduce((s, item) => s + item.precoUnitario, 0) / anteriores.length, 2)
                : arredondar(primeiro.precoUnitario, 2);

            const variacaoValor = arredondar(atual.precoUnitario - primeiro.precoUnitario, 2);
            const variacaoPercentual = primeiro.precoUnitario > 0
                ? arredondar((variacaoValor / primeiro.precoUnitario) * 100, 2)
                : 0;

            let impactoEstimado = 0;
            for (const compra of ordenados.slice(1)) {
                const adicionalUnitario = Math.max(0, compra.precoUnitario - primeiro.precoUnitario);
                impactoEstimado += adicionalUnitario * Math.max(0, compra.quantidade || 0);
            }
            impactoEstimado = arredondar(impactoEstimado, 2);

            const quantidadeAtual = Math.max(0, atual.quantidade || 0);
            const economiaPotencial = arredondar(
                Math.max(0, atual.precoUnitario - menorGeral.precoUnitario) * quantidadeAtual,
                2
            );

            const classificacao = classificarVariacao(variacaoValor);

            if (menorGeral.mercadoNome) {
                vitoriasMercado.set(
                    menorGeral.mercadoNome,
                    (vitoriasMercado.get(menorGeral.mercadoNome) || 0) + 1
                );
            }

            produtos.push({
                chaveProduto,
                produtoNome: atual.produtoNome || primeiro.produtoNome,
                produtoId: atual.produtoId || primeiro.produtoId || "",
                gtin: atual.gtin || primeiro.gtin || "",
                codigo: atual.codigo || primeiro.codigo || "",
                unidade: atual.unidade || primeiro.unidade || "UN",

                precoAtual: arredondar(atual.precoUnitario, 2),
                ultimoMercado: atual.mercadoNome || "",
                dataAtual: atual.dataCompra || "",

                primeiroPreco: arredondar(primeiro.precoUnitario, 2),
                primeiroMercado: primeiro.mercadoNome || "",
                primeiraData: primeiro.dataCompra || "",

                ultimoPreco: arredondar(anterior.precoUnitario, 2),
                precoMedio: precoMedioAnterior,

                menorPreco: arredondar(menorGeral.precoUnitario, 2),
                melhorMercado: menorGeral.mercadoNome || "",
                dataMenorPreco: menorGeral.dataCompra || "",

                maiorPreco: arredondar(maiorGeral.precoUnitario, 2),
                piorMercado: maiorGeral.mercadoNome || "",
                dataMaiorPreco: maiorGeral.dataCompra || "",

                variacaoValor,
                variacaoPercentual,
                diferencaPercentualVsMedia: precoMedioAnterior > 0
                    ? arredondar(((atual.precoUnitario - precoMedioAnterior) / precoMedioAnterior) * 100, 1)
                    : 0,

                quantidadeHistorico: ordenados.length,
                economiaPotencial,
                impactoEstimado,
                classificacao,

                historico: ordenados.map((item) => ({
                    dataCompra: item.dataCompra,
                    mercadoNome: item.mercadoNome,
                    precoUnitario: item.precoUnitario,
                    precoTotal: item.precoTotal,
                    quantidade: item.quantidade,
                    unidade: item.unidade
                }))
            });
        }

        produtos.sort((a, b) => {
            const prioridade = { ALTO: 0, BOM: 1, NORMAL: 2, SEM_REFERENCIA: 3 };
            const d = (prioridade[a.classificacao?.codigo] ?? 9) - (prioridade[b.classificacao?.codigo] ?? 9);
            if (d !== 0) return d;
            if (Math.abs(b.variacaoPercentual) !== Math.abs(a.variacaoPercentual)) {
                return Math.abs(b.variacaoPercentual) - Math.abs(a.variacaoPercentual);
            }
            return String(a.produtoNome).localeCompare(String(b.produtoNome), "pt-BR");
        });

        const contagem = { bons: 0, normais: 0, altos: 0 };
        for (const produto of produtos) {
            if (produto.classificacao?.codigo === "BOM") contagem.bons += 1;
            else if (produto.classificacao?.codigo === "ALTO") contagem.altos += 1;
            else contagem.normais += 1;
        }

        let melhorMercado = "";
        let melhorMercadoVitorias = 0;
        for (const [mercado, quantidade] of vitoriasMercado.entries()) {
            if (quantidade > melhorMercadoVitorias) {
                melhorMercado = mercado;
                melhorMercadoVitorias = quantidade;
            }
        }

        const maiorEconomiaProduto = produtos.reduce(
            (melhor, produto) => produto.economiaPotencial > (melhor?.economiaPotencial || 0) ? produto : melhor,
            null
        );

        const maiorImpactoProduto = produtos.reduce(
            (melhor, produto) => produto.impactoEstimado > (melhor?.impactoEstimado || 0) ? produto : melhor,
            null
        );

        return {
            produtosComparados: produtos.length,
            bons: contagem.bons,
            normais: contagem.normais,
            altos: contagem.altos,
            aumentos: contagem.altos,
            quedas: contagem.bons,
            estaveis: contagem.normais,
            melhorMercado,
            melhorMercadoVitorias,
            economiaPotencial: arredondar(produtos.reduce((s, p) => s + p.economiaPotencial, 0), 2),
            maiorEconomia: arredondar(maiorEconomiaProduto?.economiaPotencial || 0, 2),
            maiorEconomiaProduto: maiorEconomiaProduto?.produtoNome || "",
            impactoTotalEstimado: arredondar(produtos.reduce((s, p) => s + p.impactoEstimado, 0), 2),
            maiorImpacto: arredondar(maiorImpactoProduto?.impactoEstimado || 0, 2),
            maiorImpactoProduto: maiorImpactoProduto?.produtoNome || "",
            produtos
        };
    }

    function mesmoProduto(a, b) {
        const chaveA = criarChaveProduto(a);
        const chaveB = criarChaveProduto(b);
        return Boolean(chaveA && chaveB && chaveA === chaveB);
    }

    function criarChaveProduto(item = {}) {
        const produtoId = String(item.produtoId || "").trim();
        if (produtoId) return `PRODUTO:${produtoId}`;

        const gtin = normalizarGtin(item.gtin || item.ean || item.codigoBarras || item.codigo);
        if (gtin) return `GTIN:${gtin}`;

        const nome = normalizarNomeProduto(
            item.produtoNome || item.descricaoOriginal || item.descricao || item.nome || ""
        );
        const unidade = normalizarUnidade(item.unidade || item.un || "UN");
        if (!nome) return "";
        return `NOME:${nome}|UN:${unidade}`;
    }

    function normalizarGtin(valor) {
        const digitos = somenteDigitos(valor);
        return [8, 12, 13, 14].includes(digitos.length) ? digitos : "";
    }

    function normalizarNomeProduto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/\bLT\b/g, "L")
            .replace(/\bLITROS?\b/g, "L")
            .replace(/\bQUILOS?\b/g, "KG")
            .replace(/\bKGS?\b/g, "KG")
            .replace(/\bUND\b/g, "UN")
            .replace(/\bUNIDADES?\b/g, "UN")
            .replace(/[^A-Z0-9]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function normalizarUnidade(valor) {
        const unidade = String(valor || "UN")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .trim();
        const mapa = {
            UND: "UN", UNID: "UN", UNIDADE: "UN", UNIDADES: "UN",
            LT: "L", LITRO: "L", LITROS: "L",
            KILO: "KG", QUILO: "KG", QUILOS: "KG"
        };
        return mapa[unidade] || unidade || "UN";
    }

    function normalizarRegistro(registro) {
        if (!registro || typeof registro !== "object") return null;

        const produtoNome = String(primeiroValor(
            registro.produtoNome,
            registro.nome,
            registro.descricao,
            registro.descricaoOriginal,
            ""
        )).trim();
        if (!produtoNome) return null;

        const quantidade = Math.max(0, numero(primeiroValor(registro.quantidade, registro.qtd, registro.qtde, 1))) || 1;
        const precoTotal = Math.max(0, numero(primeiroValor(registro.precoTotal, registro.valorTotal, registro.total, 0)));
        let precoUnitario = Math.max(0, numero(primeiroValor(registro.precoUnitario, registro.valorUnitario, registro.preco, 0)));
        if (precoUnitario <= 0 && precoTotal > 0 && quantidade > 0) precoUnitario = precoTotal / quantidade;

        const gtin = normalizarGtin(primeiroValor(registro.gtin, registro.ean, registro.codigoBarras, registro.codigo, ""));

        return {
            ...registro,
            produtoNome,
            produtoId: String(registro.produtoId || "").trim(),
            gtin,
            codigoItem: String(registro.codigoItem || "").trim(),
            codigo: gtin || String(registro.codigo || "").trim(),
            quantidade: arredondar(quantidade, 3),
            unidade: normalizarUnidade(primeiroValor(registro.unidade, registro.un, "UN")),
            precoTotal: arredondar(precoTotal, 2),
            precoUnitario: arredondar(precoUnitario, 2),
            mercadoNome: String(primeiroValor(
                registro.mercadoNome,
                registro.mercado,
                registro.estabelecimentoNome,
                registro.estabelecimento,
                registro.loja,
                ""
            )).trim(),
            dataCompra: normalizarData(primeiroValor(
                registro.dataCompra,
                registro.dataCompraMs,
                registro.data,
                registro.criadoEm,
                registro.createdAt,
                ""
            ))
        };
    }

    function classificarVariacao(variacaoValor) {
        const valor = numero(variacaoValor);
        if (valor > 0.009) return { codigo: "ALTO", rotulo: "Preço aumentou", simbolo: "🔴" };
        if (valor < -0.009) return { codigo: "BOM", rotulo: "Preço caiu", simbolo: "🟢" };
        return { codigo: "NORMAL", rotulo: "Preço estável", simbolo: "⚪" };
    }

    function classificarPreco(precoAtual, precoMedio) {
        const atual = numero(precoAtual);
        const media = numero(precoMedio);
        if (atual <= 0 || media <= 0) {
            return { codigo: "SEM_REFERENCIA", rotulo: "Sem referência", simbolo: "⚪" };
        }
        const diferenca = ((atual - media) / media) * 100;
        if (diferenca <= -5) return { codigo: "BOM", rotulo: "Bom preço", simbolo: "🟢" };
        if (diferenca >= 5) return { codigo: "ALTO", rotulo: "Preço alto", simbolo: "🔴" };
        return { codigo: "NORMAL", rotulo: "Preço normal", simbolo: "⚪" };
    }

    function resultadoBase(atual) {
        return {
            chaveProduto: criarChaveProduto(atual),
            produtoNome: atual.produtoNome,
            codigo: atual.codigo,
            unidade: atual.unidade,
            precoAtual: arredondar(atual.precoUnitario, 2)
        };
    }

    function resultadoVazio(produto) {
        return {
            chaveProduto: "",
            produtoNome: String(produto?.produtoNome || produto?.nome || "").trim(),
            codigo: "",
            unidade: "UN",
            precoAtual: 0,
            possuiHistorico: false,
            quantidadeHistorico: 0,
            ultimoPreco: 0,
            menorPreco: 0,
            maiorPreco: 0,
            precoMedio: 0,
            melhorMercado: "",
            dataUltimaCompra: "",
            economiaVsUltimo: 0,
            economiaVsMedia: 0,
            diferencaPercentualVsMedia: 0,
            classificacao: { codigo: "SEM_HISTORICO", rotulo: "Sem histórico", simbolo: "⚪" }
        };
    }

    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numero(valor));
    }

    function formatarPercentual(valor) {
        const n = numero(valor);
        return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
    }

    function primeiroValor(...valores) {
        return valores.find((valor) => valor !== undefined && valor !== null && valor !== "");
    }

    function somenteDigitos(valor) {
        return String(valor || "").replace(/\D/g, "");
    }

    function numero(valor) {
        if (typeof valor === "number" && Number.isFinite(valor)) return valor;
        let texto = String(valor ?? "").trim().replace(/\s/g, "").replace(/^R\$/i, "");
        if (!texto) return 0;
        if (texto.includes(",") && texto.includes(".")) {
            if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) texto = texto.replace(/\./g, "").replace(",", ".");
            else texto = texto.replace(/,/g, "");
        } else if (texto.includes(",")) texto = texto.replace(",", ".");
        const n = Number(texto);
        return Number.isFinite(n) ? n : 0;
    }

    function arredondar(valor, casas = 2) {
        const fator = 10 ** casas;
        return Math.round((numero(valor) + Number.EPSILON) * fator) / fator;
    }

    function normalizarData(valor) {
        if (!valor) return "";
        if (typeof valor?.toDate === "function") {
            const data = valor.toDate();
            return Number.isNaN(data.getTime()) ? "" : data.toISOString();
        }
        if (typeof valor?.seconds === "number") {
            const data = new Date(valor.seconds * 1000);
            return Number.isNaN(data.getTime()) ? "" : data.toISOString();
        }
        if (typeof valor === "number" && Number.isFinite(valor)) {
            const data = new Date(valor);
            return Number.isNaN(data.getTime()) ? "" : data.toISOString();
        }
        const texto = String(valor).trim();
        const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
        if (br) {
            const [, dia, mes, ano, hora = "00", minuto = "00", segundo = "00"] = br;
            return `${ano}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
        }
        const data = new Date(texto);
        return Number.isNaN(data.getTime()) ? texto : data.toISOString();
    }

    function ordenarPorData(a, b) {
        const ta = Date.parse(a.dataCompra || "") || 0;
        const tb = Date.parse(b.dataCompra || "") || 0;
        return ta - tb;
    }

    const api = Object.freeze({
        VERSAO,
        configurar,
        limparCache,
        obterHistorico,
        compararProduto,
        compararTodos,
        compararProdutoComHistorico,
        analisarHistorico,
        criarChaveProduto,
        normalizarNomeProduto,
        normalizarUnidade,
        classificarPreco,
        formatarMoeda,
        formatarPercentual
    });

    global.ListaLarCompararPrecos = api;
    console.info(`[ListaLar] comparar-precos.js v${VERSAO} carregado.`);
})(typeof window !== "undefined" ? window : globalThis);
