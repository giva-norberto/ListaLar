/**
 * ListaLar — Comparador de Preços
 * Arquivo: comparar-precos.js
 * Versão: 1.0.0
 *
 * Não grava uma coleção nova no Firestore.
 * O gastos.js fornece o histórico já carregado por carregarHistorico().
 */

(function (global) {
    "use strict";

    const VERSAO = "1.0.0";

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
            throw new Error(
                "O comparar-precos.js precisa ser configurado pelo gastos.js com carregarHistorico()."
            );
        }

        const recebido = await ESTADO.carregarHistorico();

        if (!Array.isArray(recebido)) {
            throw new Error("carregarHistorico() deve retornar um array.");
        }

        const historico = recebido
            .map((item) => normalizarRegistro(item))
            .filter(Boolean);

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

        return lista.map((produto) =>
            compararProdutoComHistorico(produto, historico)
        );
    }

    function compararProdutoComHistorico(produtoAtual, historico = []) {
        const atual = normalizarRegistro(produtoAtual);

        if (!atual) {
            return resultadoVazio(produtoAtual);
        }

        const iguais = historico
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
                dataUltimaCompra: "",
                economiaVsUltimo: 0,
                economiaVsMedia: 0,
                diferencaPercentualVsMedia: 0,
                classificacao: {
                    codigo: "SEM_HISTORICO",
                    rotulo: "Sem histórico",
                    simbolo: "⚪"
                }
            };
        }

        const ultimo = iguais[iguais.length - 1];

        const menor = iguais.reduce(
            (melhor, item) =>
                item.precoUnitario < melhor.precoUnitario ? item : melhor,
            iguais[0]
        );

        const maiorPreco = Math.max(
            ...iguais.map((item) => item.precoUnitario)
        );

        const precoMedio = arredondar(
            iguais.reduce((total, item) => total + item.precoUnitario, 0) /
                iguais.length,
            2
        );

        const precoAtual = atual.precoUnitario;

        return {
            ...resultadoBase(atual),
            possuiHistorico: true,
            quantidadeHistorico: iguais.length,
            ultimoPreco: arredondar(ultimo.precoUnitario, 2),
            menorPreco: arredondar(menor.precoUnitario, 2),
            maiorPreco: arredondar(maiorPreco, 2),
            precoMedio,
            melhorMercado: menor.mercadoNome || "",
            dataUltimaCompra: ultimo.dataCompra || "",
            economiaVsUltimo:
                precoAtual > 0
                    ? arredondar(ultimo.precoUnitario - precoAtual, 2)
                    : 0,
            economiaVsMedia:
                precoAtual > 0
                    ? arredondar(precoMedio - precoAtual, 2)
                    : 0,
            diferencaPercentualVsMedia:
                precoAtual > 0 && precoMedio > 0
                    ? arredondar(
                        ((precoAtual - precoMedio) / precoMedio) * 100,
                        1
                    )
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

    function mesmoProduto(a, b) {
        const codigoA = somenteDigitos(a.codigo);
        const codigoB = somenteDigitos(b.codigo);

        if (codigoA && codigoB) {
            return codigoA === codigoB;
        }

        return criarChaveProduto(a) === criarChaveProduto(b);
    }

    function criarChaveProduto(item = {}) {
        const codigo = somenteDigitos(item.codigo);

        if (codigo) {
            return `COD:${codigo}`;
        }

        const nome = normalizarNomeProduto(
            item.produtoNome ||
            item.descricaoOriginal ||
            item.descricao ||
            item.nome ||
            ""
        );

        const unidade = normalizarUnidade(item.unidade || item.un || "UN");

        if (!nome) {
            return "";
        }

        return `NOME:${nome}|UN:${unidade}`;
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
            UND: "UN",
            UNID: "UN",
            UNIDADE: "UN",
            UNIDADES: "UN",
            LT: "L",
            LITRO: "L",
            LITROS: "L",
            KILO: "KG",
            QUILO: "KG",
            QUILOS: "KG"
        };

        return mapa[unidade] || unidade || "UN";
    }

    function normalizarRegistro(registro) {
        if (!registro || typeof registro !== "object") {
            return null;
        }

        const produtoNome = String(
            primeiroValor(
                registro.produtoNome,
                registro.nome,
                registro.descricaoOriginal,
                registro.descricao,
                ""
            )
        ).trim();

        if (!produtoNome) {
            return null;
        }

        const quantidade = Math.max(
            0,
            numero(
                primeiroValor(
                    registro.quantidade,
                    registro.qtd,
                    registro.qtde,
                    1
                )
            )
        ) || 1;

        const precoTotal = Math.max(
            0,
            numero(
                primeiroValor(
                    registro.precoTotal,
                    registro.valorTotal,
                    registro.total,
                    0
                )
            )
        );

        let precoUnitario = Math.max(
            0,
            numero(
                primeiroValor(
                    registro.precoUnitario,
                    registro.valorUnitario,
                    registro.preco,
                    0
                )
            )
        );

        if (precoUnitario <= 0 && precoTotal > 0 && quantidade > 0) {
            precoUnitario = precoTotal / quantidade;
        }

        return {
            ...registro,
            produtoNome,
            codigo: somenteDigitos(
                primeiroValor(
                    registro.codigo,
                    registro.codigoProduto,
                    registro.ean,
                    registro.gtin,
                    ""
                )
            ),
            quantidade: arredondar(quantidade, 3),
            unidade: normalizarUnidade(
                primeiroValor(registro.unidade, registro.un, "UN")
            ),
            precoTotal: arredondar(precoTotal, 2),
            precoUnitario: arredondar(precoUnitario, 2),
            mercadoNome: String(
                primeiroValor(
                    registro.mercadoNome,
                    registro.mercado,
                    registro.estabelecimento,
                    registro.loja,
                    ""
                )
            ).trim(),
            dataCompra: normalizarData(
                primeiroValor(
                    registro.dataCompra,
                    registro.data,
                    registro.criadoEm,
                    registro.createdAt,
                    ""
                )
            )
        };
    }

    function classificarPreco(precoAtual, precoMedio) {
        const atual = numero(precoAtual);
        const media = numero(precoMedio);

        if (atual <= 0 || media <= 0) {
            return {
                codigo: "SEM_REFERENCIA",
                rotulo: "Sem referência",
                simbolo: "⚪"
            };
        }

        const diferenca = ((atual - media) / media) * 100;

        if (diferenca <= -5) {
            return { codigo: "BOM", rotulo: "Bom preço", simbolo: "🟢" };
        }

        if (diferenca >= 5) {
            return { codigo: "ALTO", rotulo: "Preço alto", simbolo: "🔴" };
        }

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
            classificacao: {
                codigo: "SEM_HISTORICO",
                rotulo: "Sem histórico",
                simbolo: "⚪"
            }
        };
    }

    function formatarMoeda(valor) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(numero(valor));
    }

    function formatarPercentual(valor) {
        const n = numero(valor);
        return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
    }

    function primeiroValor(...valores) {
        return valores.find(
            (valor) => valor !== undefined && valor !== null && valor !== ""
        );
    }

    function somenteDigitos(valor) {
        return String(valor || "").replace(/\D/g, "");
    }

    function numero(valor) {
        if (typeof valor === "number" && Number.isFinite(valor)) {
            return valor;
        }

        let texto = String(valor ?? "")
            .trim()
            .replace(/\s/g, "")
            .replace(/^R\$/i, "");

        if (!texto) {
            return 0;
        }

        if (texto.includes(",") && texto.includes(".")) {
            if (texto.lastIndexOf(",") > texto.lastIndexOf(".")) {
                texto = texto.replace(/\./g, "").replace(",", ".");
            } else {
                texto = texto.replace(/,/g, "");
            }
        } else if (texto.includes(",")) {
            texto = texto.replace(",", ".");
        }

        const n = Number(texto);
        return Number.isFinite(n) ? n : 0;
    }

    function arredondar(valor, casas = 2) {
        const fator = 10 ** casas;
        return Math.round((numero(valor) + Number.EPSILON) * fator) / fator;
    }

    function normalizarData(valor) {
        if (!valor) {
            return "";
        }

        if (typeof valor?.toDate === "function") {
            const data = valor.toDate();
            return Number.isNaN(data.getTime()) ? "" : data.toISOString();
        }

        if (typeof valor?.seconds === "number") {
            const data = new Date(valor.seconds * 1000);
            return Number.isNaN(data.getTime()) ? "" : data.toISOString();
        }

        const texto = String(valor).trim();
        const br = texto.match(
            /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
        );

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
