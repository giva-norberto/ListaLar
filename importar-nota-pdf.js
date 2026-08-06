/**
 * ListaLar — Importador e Conferidor de Nota Fiscal
 * Arquivo: importar-nota-pdf.js
 * Versão: 1.3.1
 *
 * Responsabilidades:
 * - selecionar e ler uma nota fiscal em PDF;
 * - interpretar NFC-e gerada pela SEF/MG;
 * - receber uma nota já consultada pelo QR Code/Cloud Function;
 * - normalizar mercado, CNPJ, data, valores e produtos;
 * - exibir uma tela única de conferência editável;
 * - emitir o evento de nota confirmada para o módulo Gastos.
 *
 * Este arquivo não grava diretamente no Firestore.
 */

const ImportadorNotaPDF = (() => {
    "use strict";

    const VERSAO = "1.3.1";

    const ESTADO = {
        arquivo: null,
        textoCompleto: "",
        nota: null,
        origemAtual: ""
    };

    let promessaPDFJS = null;

    // ============================================================
    // CARREGAMENTO SOB DEMANDA DO PDF.JS
    // ============================================================

  async function carregarPDFJS() {
    if (
        window.pdfjsLib &&
        typeof window.pdfjsLib.getDocument === "function"
    ) {
        return window.pdfjsLib;
    }

    if (promessaPDFJS) {
        return promessaPDFJS;
    }

    promessaPDFJS = new Promise(
        (resolver, rejeitar) => {
            const scriptExistente =
                document.querySelector(
                    'script[data-listalar-pdfjs="1"]'
                );

            const concluir = () => {
                if (
                    !window.pdfjsLib ||
                    typeof window.pdfjsLib.getDocument !==
                        "function"
                ) {
                    rejeitar(
                        new Error(
                            "A biblioteca de leitura de PDF não ficou disponível."
                        )
                    );

                    return;
                }

                window.pdfjsLib
                    .GlobalWorkerOptions
                    .workerSrc =
                    "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

                resolver(window.pdfjsLib);
            };

            if (scriptExistente) {
                if (
                    window.pdfjsLib &&
                    typeof window.pdfjsLib
                        .getDocument === "function"
                ) {
                    concluir();
                    return;
                }

                scriptExistente.addEventListener(
                    "load",
                    concluir,
                    {
                        once: true
                    }
                );

                scriptExistente.addEventListener(
                    "error",
                    () => {
                        rejeitar(
                            new Error(
                                "Não foi possível carregar o leitor de PDF."
                            )
                        );
                    },
                    {
                        once: true
                    }
                );

                return;
            }

            const script =
                document.createElement("script");

            script.src =
                "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";

            script.async = true;

            script.dataset.listalarPdfjs =
                "1";

            script.onload =
                concluir;

            script.onerror =
                () => {
                    script.remove();

                    promessaPDFJS =
                        null;

                    rejeitar(
                        new Error(
                            "Não foi possível carregar o leitor de PDF."
                        )
                    );
                };

            document.head.appendChild(
                script
            );
        }
    ).catch((erro) => {
        promessaPDFJS = null;
        throw erro;
    });

    return promessaPDFJS;
}
    // ============================================================
    // ESTILOS
    // ============================================================

    function criarEstilos() {
        if (document.getElementById("importar-nota-pdf-estilos")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "importar-nota-pdf-estilos";

        style.textContent = `
            .nota-pdf-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                background: rgba(15, 23, 42, 0.62);
                backdrop-filter: blur(4px);
            }

            .nota-pdf-modal {
                width: min(760px, 100%);
                max-height: calc(100vh - 40px);
                overflow-y: auto;
                background: #ffffff;
                border-radius: 24px;
                box-shadow: 0 25px 70px rgba(15, 23, 42, 0.28);
            }

            .nota-pdf-cabecalho {
                position: sticky;
                top: 0;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 16px;
                padding: 20px;
                color: #ffffff;
                background: linear-gradient(135deg, #2563eb, #06b6d4);
                border-radius: 24px 24px 0 0;
            }

            .nota-pdf-cabecalho h2 {
                margin: 0;
                font-size: 22px;
            }

            .nota-pdf-cabecalho small {
                display: block;
                margin-top: 4px;
                opacity: 0.9;
            }

            .nota-pdf-fechar {
                flex: 0 0 auto;
                width: 42px;
                height: 42px;
                border: 0;
                border-radius: 50%;
                color: #ffffff;
                background: rgba(255, 255, 255, 0.18);
                font-size: 25px;
                cursor: pointer;
            }

            .nota-pdf-fechar:active {
                transform: scale(0.94);
            }

            .nota-pdf-conteudo {
                padding: 20px;
            }

            .nota-pdf-seletor {
                padding: 28px 18px;
                border: 2px dashed #93c5fd;
                border-radius: 18px;
                text-align: center;
                background: #eff6ff;
            }

            .nota-pdf-seletor input {
                display: none;
            }

            .nota-pdf-seletor p {
                margin: 10px auto 18px;
                max-width: 520px;
                line-height: 1.45;
            }

            .nota-pdf-botao {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-height: 48px;
                padding: 12px 20px;
                border: 0;
                border-radius: 14px;
                font: inherit;
                font-size: 16px;
                font-weight: 700;
                cursor: pointer;
            }

            .nota-pdf-botao-principal {
                color: #ffffff;
                background: linear-gradient(135deg, #2563eb, #06b6d4);
            }

            .nota-pdf-botao-principal:hover {
                filter: brightness(0.96);
            }

            .nota-pdf-botao-secundario {
                color: #334155;
                background: #e2e8f0;
            }

            .nota-pdf-status {
                display: none;
                margin-top: 18px;
                padding: 14px;
                border-radius: 14px;
                background: #f1f5f9;
                color: #334155;
                font-weight: 600;
            }

            .nota-pdf-status.ativo {
                display: block;
            }

            .nota-pdf-resumo {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 12px;
                margin-top: 20px;
            }

            .nota-pdf-card {
                padding: 14px;
                border: 1px solid #dbeafe;
                border-radius: 15px;
                background: #f8fafc;
            }

            .nota-pdf-card span {
                display: block;
                margin-bottom: 5px;
                color: #64748b;
                font-size: 13px;
            }

            .nota-pdf-card strong {
                display: block;
                color: #0f172a;
                font-size: 17px;
                overflow-wrap: anywhere;
            }

            .nota-pdf-tabela-wrapper {
                margin-top: 20px;
                overflow-x: auto;
                border: 1px solid #e2e8f0;
                border-radius: 16px;
            }

            .nota-pdf-tabela {
                width: 100%;
                min-width: 630px;
                border-collapse: collapse;
            }

            .nota-pdf-tabela th,
            .nota-pdf-tabela td {
                padding: 12px;
                border-bottom: 1px solid #e2e8f0;
                text-align: left;
                vertical-align: middle;
            }

            .nota-pdf-tabela tr:last-child td {
                border-bottom: 0;
            }

            .nota-pdf-tabela th {
                color: #334155;
                background: #f1f5f9;
                font-size: 13px;
            }

            .nota-pdf-tabela input {
                width: 100%;
                min-width: 90px;
                padding: 9px;
                border: 1px solid #cbd5e1;
                border-radius: 9px;
                font: inherit;
                font-size: 14px;
                box-sizing: border-box;
            }

            .nota-pdf-tabela input:focus {
                outline: 2px solid rgba(37, 99, 235, 0.22);
                border-color: #2563eb;
            }

            .nota-pdf-acoes {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                margin-top: 20px;
            }

            .nota-pdf-erro {
                margin-top: 18px;
                padding: 14px;
                border-radius: 14px;
                color: #991b1b;
                background: #fee2e2;
                line-height: 1.45;
            }

            .nota-pdf-conferencia-aviso {
                margin-top: 16px;
                padding: 14px;
                border: 1px solid #f59e0b;
                border-radius: 14px;
                color: #78350f;
                background: #fffbeb;
                line-height: 1.45;
                font-weight: 700;
            }

            .nota-pdf-conferencia-ok {
                margin-top: 16px;
                padding: 12px 14px;
                border: 1px solid #86efac;
                border-radius: 14px;
                color: #166534;
                background: #f0fdf4;
                line-height: 1.4;
                font-weight: 700;
            }

            @media (max-width: 600px) {
                .nota-pdf-overlay {
                    align-items: flex-end;
                    padding: 0;
                }

                .nota-pdf-modal {
                    width: 100%;
                    max-height: 94vh;
                    border-radius: 22px 22px 0 0;
                }

                .nota-pdf-cabecalho {
                    padding: 17px;
                    border-radius: 22px 22px 0 0;
                }

                .nota-pdf-cabecalho h2 {
                    font-size: 19px;
                }

                .nota-pdf-conteudo {
                    padding: 16px;
                }

                .nota-pdf-resumo {
                    grid-template-columns: 1fr;
                }

                .nota-pdf-acoes {
                    flex-direction: column-reverse;
                }

                .nota-pdf-botao {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ============================================================
    // ESTRUTURA DA TELA
    // ============================================================

    function criarEstruturaModal({
        titulo,
        subtitulo,
        mostrarSeletorPDF = false
    }) {
        criarEstilos();
        fechar();

        const overlay = document.createElement("div");

        overlay.id = "nota-pdf-overlay";
        overlay.className = "nota-pdf-overlay";

        const seletorPDF = mostrarSeletorPDF
            ? `
                <div class="nota-pdf-seletor">
                    <div style="font-size:42px;margin-bottom:10px;">
                        📄
                    </div>

                    <strong>Escolha o PDF da nota fiscal</strong>

                    <p style="color:#64748b;">
                        O arquivo será analisado antes de qualquer
                        informação ser enviada ao módulo Gastos.
                    </p>

                    <label
                        for="nota-pdf-arquivo"
                        class="nota-pdf-botao nota-pdf-botao-principal"
                    >
                        Selecionar PDF
                    </label>

                    <input
                        id="nota-pdf-arquivo"
                        type="file"
                        accept="application/pdf,.pdf"
                    >
                </div>
            `
            : "";

        overlay.innerHTML = `
            <section class="nota-pdf-modal">
                <header class="nota-pdf-cabecalho">
                    <div>
                        <h2>${escaparHTML(titulo)}</h2>
                        <small>${escaparHTML(subtitulo)}</small>
                    </div>

                    <button
                        type="button"
                        class="nota-pdf-fechar"
                        id="nota-pdf-fechar"
                        aria-label="Fechar"
                        title="Fechar"
                    >
                        ×
                    </button>
                </header>

                <div class="nota-pdf-conteudo">
                    ${seletorPDF}

                    <div
                        id="nota-pdf-status"
                        class="nota-pdf-status"
                        role="status"
                    ></div>

                    <div id="nota-pdf-resultado"></div>
                </div>
            </section>
        `;

        document.body.appendChild(overlay);

        document
            .getElementById("nota-pdf-fechar")
            ?.addEventListener("click", fechar);

        document
            .getElementById("nota-pdf-arquivo")
            ?.addEventListener(
                "change",
                tratarSelecaoArquivo
            );

        overlay.addEventListener("click", (evento) => {
            if (evento.target === overlay) {
                fechar();
            }
        });

        return overlay;
    }

    // ============================================================
    // ABERTURA
    // ============================================================

    function abrir() {
        ESTADO.arquivo = null;
        ESTADO.textoCompleto = "";
        ESTADO.nota = null;
        ESTADO.origemAtual = "PDF";

        criarEstruturaModal({
            titulo: "Importar nota fiscal",
            subtitulo: "Selecione o PDF salvo pelo navegador",
            mostrarSeletorPDF: true
        });
    }

    function abrirComNota(notaExterna) {
        ESTADO.arquivo = null;
        ESTADO.textoCompleto = "";
        ESTADO.nota = null;
        ESTADO.origemAtual = "QR_CODE";

        criarEstruturaModal({
            titulo: "Conferir nota fiscal",
            subtitulo: "Dados recebidos pela leitura do QR Code",
            mostrarSeletorPDF: false
        });

        atualizarStatus(
            "Preparando os dados da nota fiscal..."
        );

        try {
            const nota = normalizarNotaExterna(notaExterna);

            ESTADO.nota = nota;

            validarNota(nota);
            exibirNota(nota);

            const quantidadeOficial =
                Math.trunc(converterNumero(nota.quantidadeTotalItens));

            atualizarStatus(
                quantidadeOficial > 0
                    ? `${nota.itens.length} de ${quantidadeOficial} item(ns) extraído(s). Confira os dados antes de importar.`
                    : `${nota.itens.length} item(ns) encontrado(s). Confira os dados antes de importar.`
            );
        } catch (erro) {
            console.error(
                "Erro ao preparar a nota recebida pelo QR Code:",
                erro
            );

            mostrarErro(
                erro?.message ||
                "Os dados recebidos não formam uma nota fiscal válida."
            );
        }
    }

    function fechar() {
        document
            .getElementById("nota-pdf-overlay")
            ?.remove();
    }

    // ============================================================
    // LEITURA DO PDF
    // ============================================================

    async function tratarSelecaoArquivo(evento) {
        const arquivo = evento.target.files?.[0];

        if (!arquivo) {
            return;
        }

        if (
            arquivo.type !== "application/pdf" &&
            !arquivo.name.toLowerCase().endsWith(".pdf")
        ) {
            mostrarErro(
                "Selecione um arquivo PDF válido."
            );

            return;
        }

        ESTADO.arquivo = arquivo;
        ESTADO.textoCompleto = "";
        ESTADO.nota = null;
        ESTADO.origemAtual = "PDF";

        atualizarStatus(`Lendo ${arquivo.name}...`);

        try {
            const texto = await extrairTextoPDF(arquivo);
            const nota = interpretarNotaSEFMG(texto);

            ESTADO.textoCompleto = texto;
            ESTADO.nota = nota;

            validarNota(nota);
            exibirNota(nota);

            const quantidadeOficial =
                Math.trunc(converterNumero(nota.quantidadeTotalItens));

            atualizarStatus(
                quantidadeOficial > 0
                    ? `${nota.itens.length} de ${quantidadeOficial} item(ns) extraído(s). Confira os dados antes de importar.`
                    : `${nota.itens.length} item(ns) encontrado(s). Confira os dados antes de importar.`
            );
        } catch (erro) {
            console.error(
                "Erro ao importar nota fiscal:",
                erro
            );

            mostrarErro(
                erro?.message ||
                "Não foi possível ler este PDF. " +
                "Verifique o arquivo e tente novamente."
            );
        }
    }

    async function extrairTextoPDF(arquivo) {
        const pdfjsLib = await carregarPDFJS();
        const arrayBuffer = await arquivo.arrayBuffer();

        const documento = await pdfjsLib.getDocument({
            data: new Uint8Array(arrayBuffer)
        }).promise;

        const paginas = [];

        for (
            let numeroPagina = 1;
            numeroPagina <= documento.numPages;
            numeroPagina += 1
        ) {
            const pagina = await documento.getPage(
                numeroPagina
            );

            const conteudo =
                await pagina.getTextContent();

            const linhas = agruparItensEmLinhas(
                conteudo.items
            );

            paginas.push(linhas.join("\n"));
        }

        return normalizarTexto(
            paginas.join("\n")
        );
    }

    function agruparItensEmLinhas(itens) {
        const grupos = new Map();
        const toleranciaY = 3;

        const ordenados = [...itens].sort(
            (itemA, itemB) => {
                const yA =
                    itemA.transform?.[5] ?? 0;

                const yB =
                    itemB.transform?.[5] ?? 0;

                if (
                    Math.abs(yA - yB) >
                    toleranciaY
                ) {
                    return yB - yA;
                }

                const xA =
                    itemA.transform?.[4] ?? 0;

                const xB =
                    itemB.transform?.[4] ?? 0;

                return xA - xB;
            }
        );

        for (const item of ordenados) {
            const texto = String(
                item.str || ""
            ).trim();

            if (!texto) {
                continue;
            }

            const x =
                item.transform?.[4] ?? 0;

            const y =
                item.transform?.[5] ?? 0;

            let chaveExistente = null;

            for (const chave of grupos.keys()) {
                if (
                    Math.abs(
                        Number(chave) - y
                    ) <= toleranciaY
                ) {
                    chaveExistente = chave;
                    break;
                }
            }

            const chave =
                chaveExistente ?? String(y);

            if (!grupos.has(chave)) {
                grupos.set(chave, []);
            }

            grupos.get(chave).push({
                x,
                texto
            });
        }

        return [...grupos.entries()]
            .sort(
                ([yA], [yB]) =>
                    Number(yB) - Number(yA)
            )
            .map(([, partes]) => {
                return partes
                    .sort(
                        (parteA, parteB) =>
                            parteA.x - parteB.x
                    )
                    .map(
                        (parte) => parte.texto
                    )
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();
            })
            .filter(Boolean);
    }

    function normalizarTexto(texto) {
        return String(texto || "")
            .replace(/\u00a0/g, " ")
            .replace(/[ \t]+/g, " ")
            .replace(/\r/g, "")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
    }

    function normalizarParaComparacao(texto) {
        return String(texto || "")
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();
    }

    // ============================================================
    // INTERPRETAÇÃO DO PDF SEF/MG
    // ============================================================

    function interpretarNotaSEFMG(texto) {
        const linhas = texto
            .split("\n")
            .map(
                (linha) => linha.trim()
            )
            .filter(Boolean);

        const valorProdutos = extrairValorTotal(texto);
        const valorPago = extrairValorPago(texto);
        const valorEfetivo = valorPago > 0
            ? valorPago
            : valorProdutos;

        return {
            origem: "PDF_SEF_MG",

            mercadoNome:
                extrairMercado(linhas),

            cnpj:
                extrairCNPJ(texto),

            dataCompra:
                extrairDataCompra(texto),

            chaveAcesso:
                extrairChaveAcesso(texto),

            formaPagamento:
                extrairFormaPagamento(texto),

            quantidadeTotalItens:
                extrairQuantidadeTotal(texto),

            // Valor efetivamente desembolsado, usado pelo painel Gastos.
            valorTotal:
                valorEfetivo,

            // Valores preservados para auditoria e exibição do desconto.
            valorProdutos:
                valorProdutos,

            valorPago:
                valorEfetivo,

            desconto:
                arredondarMoeda(
                    Math.max(0, valorProdutos - valorEfetivo)
                ),

            itens:
                extrairItensSEFMG(linhas),

            nomeArquivo:
                ESTADO.arquivo?.name || "",

            importadoEm:
                new Date().toISOString()
        };
    }

    function extrairMercado(linhas) {
        const indiceTitulo =
            linhas.findIndex((linha) =>
                /Nota Fiscal de Consumidor Eletrônica/i
                    .test(linha)
            );

        const candidatos = linhas.slice(
            Math.max(0, indiceTitulo + 1),
            indiceTitulo + 7
        );

        const mercado = candidatos.find(
            (linha) => {
                return (
                    linha.length >= 4 &&
                    !/^CNPJ/i.test(linha) &&
                    !/Inscrição Estadual/i
                        .test(linha) &&
                    !/Secretaria de Estado/i
                        .test(linha) &&
                    !/^\d{2}\/\d{2}\/\d{4}/
                        .test(linha)
                );
            }
        );

        return mercado ||
            "Estabelecimento não identificado";
    }

    function extrairCNPJ(texto) {
        const correspondencia = texto.match(
            /CNPJ\s*:\s*([\d.\-\/]{14,18})/i
        );

        return correspondencia
            ? somenteDigitos(
                correspondencia[1]
            ).slice(0, 14)
            : "";
    }

    function extrairDataCompra(texto) {
        const datas = [
            ...texto.matchAll(
                /\b(\d{2}\/\d{2}\/\d{4})(?:[,\s]+(\d{2}:\d{2}(?::\d{2})?))?/g
            )
        ];

        if (!datas.length) {
            return "";
        }

        const correspondencia =
            datas[datas.length - 1];

        const [dia, mes, ano] =
            correspondencia[1].split("/");

        const horario =
            correspondencia[2] || "00:00";

        return `${ano}-${mes}-${dia}T${horario}`;
    }

    function extrairChaveAcesso(texto) {
        const blocos = texto.match(
            /(?:\d[\s.-]*){44}/g
        );

        if (!blocos) {
            return "";
        }

        for (const bloco of blocos) {
            const chave =
                somenteDigitos(bloco);

            if (chave.length === 44) {
                return chave;
            }
        }

        return "";
    }

    function extrairFormaPagamento(texto) {
        const correspondencia = texto.match(
            /Forma de Pagamento\s+(.+?)(?=\n|$)/i
        );

        return correspondencia
            ? correspondencia[1].trim()
            : "";
    }

    function extrairQuantidadeTotal(texto) {
        const textoComparacao =
            normalizarParaComparacao(texto);

        const correspondencias = [
            ...textoComparacao.matchAll(
                /qtde total de itens\s*:?\s+(\d+)/g
            )
        ];

        if (!correspondencias.length) {
            return 0;
        }

        return converterNumero(
            correspondencias[
                correspondencias.length - 1
            ][1]
        );
    }

    function extrairValorTotal(texto) {
        const correspondencias = [
            ...texto.matchAll(
                /Valor total R\$?\s*:?\s*(?:R\$)?\s*([\d.,]+)/gi
            )
        ];

        if (!correspondencias.length) {
            return 0;
        }

        return converterMoeda(
            correspondencias[
                correspondencias.length - 1
            ][1]
        );
    }

    function extrairValorPago(texto) {
        const correspondencias = [
            ...texto.matchAll(
                /Valor pago R\$?\s*:?\s*(?:R\$)?\s*([\d.,]+)/gi
            )
        ];

        if (!correspondencias.length) {
            return 0;
        }

        return converterMoeda(
            correspondencias[
                correspondencias.length - 1
            ][1]
        );
    }

    function extrairItensSEFMG(linhas) {
        /*
         * O portal da SEF/MG pode gerar o PDF
         * em dois formatos:
         *
         * 1. todos os dados do produto aparecem
         *    em sequência;
         *
         * 2. os títulos das colunas ficam em
         *    uma linha e os valores ficam na
         *    linha seguinte.
         */

        const itensTabela =
            extrairItensTabelaSEFMG(linhas);

        if (itensTabela.length) {
            // Cada linha da NFC-e representa um item comprado.
            // Não remover duplicados: produtos iguais podem aparecer
            // várias vezes na mesma nota e contam no total oficial.
            return itensTabela;
        }

        const itens = [];
        const textoUnificado =
            linhas.join("\n");

        const padraoItem =
            /(.+?)\s*\(C[oó]digo:\s*(\d+)\)\s*Qtde total de [ií]tens:\s*([\d.,]+)\s*UN:\s*([A-Za-zÀ-ÿ]+)\s*Valor total R\$:\s*R?\$?\s*([\d.,]+)/gi;

        let correspondencia;

        while (
            (
                correspondencia =
                    padraoItem.exec(
                        textoUnificado
                    )
            ) !== null
        ) {
            const item =
                criarItemInterpretado({
                    descricao:
                        correspondencia[1],

                    codigo:
                        correspondencia[2],

                    quantidade:
                        correspondencia[3],

                    unidade:
                        correspondencia[4],

                    valorTotal:
                        correspondencia[5]
                });

            if (item) {
                itens.push(item);
            }
        }

        if (itens.length) {
            // Preserva ocorrências repetidas da nota fiscal.
            return itens;
        }

        return extrairItensPorLinhas(
            linhas
        );
    }

    function extrairItensTabelaSEFMG(linhas) {
        const itens = [];

        for (
            let indice = 0;
            indice < linhas.length;
            indice += 1
        ) {
            const linhaCabecalho =
                linhas[indice];

            const linhaComparacao =
                normalizarParaComparacao(
                    linhaCabecalho
                );

            const pareceCabecalhoProduto =
                linhaComparacao.includes(
                    "(codigo:"
                ) &&
                linhaComparacao.includes(
                    "qtde total de itens"
                ) &&
                linhaComparacao.includes(
                    "un:"
                ) &&
                linhaComparacao.includes(
                    "valor total r$"
                );

            if (!pareceCabecalhoProduto) {
                continue;
            }

            const descricao =
                linhaCabecalho
                    .split(
                        /\(C[oó]digo:/i
                    )[0]
                    ?.trim();

            let blocoValores = "";
            let itemEncontrado = null;

            let indiceValorEncontrado =
                indice;

            for (
                let deslocamento = 1;
                deslocamento <= 3;
                deslocamento += 1
            ) {
                const linhaValores =
                    linhas[
                        indice + deslocamento
                    ];

                if (!linhaValores) {
                    break;
                }

                const proximaComparacao =
                    normalizarParaComparacao(
                        linhaValores
                    );

                if (
                    proximaComparacao.includes(
                        "(codigo:"
                    ) &&
                    proximaComparacao.includes(
                        "qtde total de itens"
                    )
                ) {
                    break;
                }

                blocoValores =
                    `${blocoValores} ${linhaValores}`
                        .trim();

                const valores =
                    blocoValores.match(
                        /^(\d+)\)?\s+([\d.,]+)\s+([A-Za-zÀ-ÿ]{1,10})\s+([\d.,]+)$/i
                    );

                if (!valores) {
                    continue;
                }

                itemEncontrado =
                    criarItemInterpretado({
                        descricao,
                        codigo:
                            valores[1],
                        quantidade:
                            valores[2],
                        unidade:
                            valores[3],
                        valorTotal:
                            valores[4]
                    });

                indiceValorEncontrado =
                    indice + deslocamento;

                break;
            }

            if (itemEncontrado) {
                itens.push(
                    itemEncontrado
                );

                indice =
                    indiceValorEncontrado;
            }
        }

        return itens;
    }

    function extrairItensPorLinhas(linhas) {
        const itens = [];

        for (
            let indice = 0;
            indice < linhas.length;
            indice += 1
        ) {
            const linha = linhas[indice];
            const codigoMatch = linha.match(
                /\(C[oó]digo:\s*(\d+)\)/i
            );

            if (!codigoMatch) {
                continue;
            }

            let descricao = linha
                .slice(0, codigoMatch.index)
                .trim();

            // Alguns PDFs colocam a descrição na linha anterior e o código
            // sozinho na linha seguinte, como ocorre em notas do MULTICOM.
            if (!descricao && indice > 0) {
                const anterior = linhas[indice - 1];
                const anteriorComparacao =
                    normalizarParaComparacao(anterior);

                if (
                    anterior &&
                    !anteriorComparacao.includes("qtde total de itens") &&
                    !anteriorComparacao.startsWith("un:") &&
                    !anteriorComparacao.includes("valor total r$")
                ) {
                    descricao = anterior.trim();
                }
            }

            const bloco = linhas
                .slice(indice, indice + 12)
                .join(" ");

            const quantidadeMatch = bloco.match(
                /Qtde total de [ií]tens:\s*([\d.,]+)/i
            );

            const unidadeMatch = bloco.match(
                /UN:\s*([A-Za-zÀ-ÿ]{1,10})/i
            );

            const valorMatch = bloco.match(
                /Valor total R\$:\s*(?:R\$)?\s*([\d.,]+)/i
            );

            if (!quantidadeMatch || !valorMatch) {
                continue;
            }

            const item = criarItemInterpretado({
                descricao,
                codigo: codigoMatch[1],
                quantidade: quantidadeMatch[1],
                unidade: unidadeMatch?.[1] || "UN",
                valorTotal: valorMatch[1]
            });

            if (item) {
                itens.push(item);
            }
        }

        // Cada ocorrência representa uma linha real da nota.
        return itens;
    }

    function criarItemInterpretado({
        descricao,
        codigo,
        quantidade,
        unidade,
        valorTotal
    }) {
        const descricaoLimpa =
            limparDescricaoItem(descricao);

        if (
            !descricaoLimpa ||
            /(?:Filtrar|Filtar)\s+[ií]tens/i
                .test(descricaoLimpa) ||
            /Nota Fiscal/i
                .test(descricaoLimpa)
        ) {
            return null;
        }

        const quantidadeConvertida =
            converterNumero(quantidade);

        const valorConvertido =
            converterMoeda(valorTotal);

        const unidadeLimpa =
            String(unidade || "UN")
                .replace(
                    /[^A-Za-zÀ-ÿ]/g,
                    ""
                )
                .toUpperCase() ||
            "UN";

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
                quantidadeConvertida,

            unidade:
                unidadeLimpa,

            precoTotal:
                valorConvertido,

            precoUnitario:
                quantidadeConvertida > 0
                    ? arredondarMoeda(
                        valorConvertido /
                        quantidadeConvertida
                    )
                    : valorConvertido
        };
    }

    function limparDescricaoItem(descricao) {
        return String(descricao || "")
            .replace(
                /.*?(?:Filtrar|Filtar)\s+[ií]tens\s*/i,
                ""
            )
            .replace(/\s+/g, " ")
            .trim();
    }

    function formatarNomeProduto(descricao) {
        const texto =
            limparDescricaoItem(descricao)
                .toLowerCase();

        return texto.replace(
            /\b\p{L}/gu,
            (letra) =>
                letra.toUpperCase()
        );
    }

    function removerItensDuplicados(itens) {
        const mapa = new Map();

        for (const item of itens) {
            const chave = [
                item.codigo,
                item.descricaoOriginal,
                item.quantidade,
                item.precoTotal
            ].join("|");

            if (!mapa.has(chave)) {
                mapa.set(chave, item);
            }
        }

        return [...mapa.values()];
    }

    // ============================================================
    // NORMALIZAÇÃO DE NOTA RECEBIDA PELO QR CODE
    // ============================================================

    function clonarSeguro(valor) {
        if (
            typeof structuredClone ===
            "function"
        ) {
            return structuredClone(valor);
        }

        return JSON.parse(
            JSON.stringify(valor)
        );
    }

    function primeiroValorValido(...valores) {
        for (const valor of valores) {
            if (
                valor !== undefined &&
                valor !== null &&
                valor !== ""
            ) {
                return valor;
            }
        }

        return "";
    }

    function obterListaItensExterna(nota) {
        const possibilidades = [
            nota?.itens,
            nota?.produtos,
            nota?.items,
            nota?.dados?.itens,
            nota?.dados?.produtos,
            nota?.nota?.itens,
            nota?.nota?.produtos
        ];

        return possibilidades.find(
            Array.isArray
        ) || [];
    }

    function normalizarItemExterno(
        item,
        indice
    ) {
        const descricaoOriginal = String(
            primeiroValorValido(
                item?.descricaoOriginal,
                item?.descricao,
                item?.produtoNome,
                item?.nome,
                item?.produto,
                item?.item,
                `Produto ${indice + 1}`
            )
        ).trim();

        const quantidade =
            converterNumero(
                primeiroValorValido(
                    item?.quantidade,
                    item?.qtd,
                    item?.qtde,
                    1
                )
            );

        const precoTotalInformado =
            converterNumero(
                primeiroValorValido(
                    item?.precoTotal,
                    item?.valorTotal,
                    item?.total,
                    item?.subtotal,
                    item?.valor_total,
                    0
                )
            );

        const precoUnitarioInformado =
            converterNumero(
                primeiroValorValido(
                    item?.precoUnitario,
                    item?.valorUnitario,
                    item?.preco,
                    item?.valor,
                    0
                )
            );

        const precoTotal =
            precoTotalInformado > 0
                ? precoTotalInformado
                : arredondarMoeda(
                    quantidade *
                    precoUnitarioInformado
                );

        const precoUnitario =
            precoUnitarioInformado > 0
                ? precoUnitarioInformado
                : quantidade > 0
                    ? arredondarMoeda(
                        precoTotal /
                        quantidade
                    )
                    : precoTotal;

        return {
            ...clonarSeguro(
                item || {}
            ),

            descricaoOriginal,

            produtoNome: String(
                primeiroValorValido(
                    item?.produtoNome,
                    item?.nomeNormalizado,
                    formatarNomeProduto(
                        descricaoOriginal
                    )
                )
            ).trim(),

            codigo: somenteDigitos(
                primeiroValorValido(
                    item?.codigo,
                    item?.codigoProduto,
                    item?.cProd,
                    item?.ean,
                    item?.gtin
                )
            ),

            quantidade:
                quantidade > 0
                    ? quantidade
                    : 1,

            unidade: String(
                primeiroValorValido(
                    item?.unidade,
                    item?.un,
                    item?.tipoUnidade,
                    "UN"
                )
            )
                .trim()
                .toUpperCase() ||
                "UN",

            precoUnitario:
                arredondarMoeda(
                    precoUnitario
                ),

            precoTotal:
                arredondarMoeda(
                    precoTotal
                )
        };
    }

    function normalizarNotaExterna(
        valorRecebido
    ) {
        const recebido =
            valorRecebido?.data?.nota ||
            valorRecebido?.data?.dados ||
            valorRecebido?.data ||
            valorRecebido?.nota ||
            valorRecebido?.dados ||
            valorRecebido;

        if (
            !recebido ||
            typeof recebido !== "object"
        ) {
            throw new Error(
                "A consulta foi concluída, mas não retornou os dados da nota."
            );
        }

        const itens =
            obterListaItensExterna(
                recebido
            )
                .map(
                    normalizarItemExterno
                )
                .filter((item) => {
                    return (
                        item.produtoNome &&
                        item.quantidade > 0
                    );
                });

        const valorTotalInformado =
            converterNumero(
                primeiroValorValido(
                    recebido?.valorTotal,
                    recebido?.total,
                    recebido?.totalNota,
                    recebido?.valor_total,
                    recebido?.dados
                        ?.valorTotal,
                    recebido?.dados
                        ?.total,
                    0
                )
            );

        const valorCalculado =
            arredondarMoeda(
                itens.reduce(
                    (total, item) =>
                        total +
                        item.precoTotal,
                    0
                )
            );

        return {
            ...clonarSeguro(recebido),

            origem: String(
                primeiroValorValido(
                    recebido?.origem,
                    "QR_CODE_NFCE"
                )
            ),

            mercadoNome: String(
                primeiroValorValido(
                    recebido?.mercadoNome,
                    recebido?.estabelecimento,
                    recebido?.supermercado,
                    recebido?.emitente?.nome,
                    recebido?.emitente
                        ?.razaoSocial,
                    recebido?.razaoSocial,
                    recebido?.nomeEmpresa,
                    "Estabelecimento não identificado"
                )
            ).trim(),

            cnpj: somenteDigitos(
                primeiroValorValido(
                    recebido?.cnpj,
                    recebido?.emitente?.cnpj,
                    recebido
                        ?.estabelecimentoCnpj
                )
            ).slice(0, 14),

            dataCompra:
                primeiroValorValido(
                    recebido?.dataCompra,
                    recebido?.dataEmissao,
                    recebido?.data,
                    recebido?.emissao
                ),

            chaveAcesso:
                somenteDigitos(
                    primeiroValorValido(
                        recebido?.chaveAcesso,
                        recebido?.chave,
                        recebido?.chaveNfce,
                        recebido?.chaveNFCE
                    )
                ).slice(0, 44),

            formaPagamento: String(
                primeiroValorValido(
                    recebido?.formaPagamento,
                    recebido?.pagamento
                        ?.forma,
                    recebido?.pagamento
                )
            ).trim(),

            quantidadeTotalItens:
                itens.length,

            valorTotal:
                valorTotalInformado > 0
                    ? arredondarMoeda(
                        valorTotalInformado
                    )
                    : valorCalculado,

            itens,

            nomeArquivo: "",

            importadoEm:
                recebido?.importadoEm ||
                new Date().toISOString()
        };
    }

    // ============================================================
    // VALIDAÇÃO
    // ============================================================

    function validarNota(nota) {
        if (
            !nota ||
            typeof nota !== "object"
        ) {
            throw new Error(
                "Os dados da nota fiscal são inválidos."
            );
        }

        if (
            !Array.isArray(nota.itens) ||
            !nota.itens.length
        ) {
            throw new Error(
                "A nota foi recebida, mas nenhum produto foi reconhecido."
            );
        }

        if (!nota.valorTotal) {
            nota.valorTotal =
                arredondarMoeda(
                    nota.itens.reduce(
                        (total, item) =>
                            total +
                            item.precoTotal,
                        0
                    )
                );
        }

        if (!nota.quantidadeTotalItens) {
            nota.quantidadeTotalItens =
                nota.itens.length;
        }
    }

    // ============================================================
    // CONFERÊNCIA
    // ============================================================

    function obterConferenciaNota(nota) {
        const quantidadeOficial = Math.max(
            0,
            Math.trunc(converterNumero(nota?.quantidadeTotalItens))
        );
        const quantidadeExtraida = Array.isArray(nota?.itens)
            ? nota.itens.length
            : 0;
        const valorPago = arredondarMoeda(
            converterNumero(nota?.valorPago ?? nota?.valorTotal)
        );
        const valorProdutos = arredondarMoeda(
            converterNumero(nota?.valorProdutos ?? nota?.valorTotal)
        );
        const valorItens = arredondarMoeda(
            (nota?.itens || []).reduce(
                (total, item) => total + converterNumero(item?.precoTotal),
                0
            )
        );

        return {
            quantidadeOficial,
            quantidadeExtraida,
            quantidadeDiferente:
                quantidadeOficial > 0 &&
                quantidadeOficial !== quantidadeExtraida,
            valorPago,
            valorProdutos,
            desconto: arredondarMoeda(
                Math.max(0, valorProdutos - valorPago)
            ),
            valorItens,
            valorDiferente:
                valorProdutos > 0 &&
                Math.abs(valorProdutos - valorItens) >= 0.01
        };
    }

    function exibirNota(nota) {
        const resultado =
            document.getElementById(
                "nota-pdf-resultado"
            );

        if (!resultado) {
            return;
        }

        const conferencia = obterConferenciaNota(nota);
        const possuiDivergencia =
            conferencia.quantidadeDiferente ||
            conferencia.valorDiferente;

        resultado.innerHTML = `
            <div class="nota-pdf-resumo">
                <div class="nota-pdf-card">
                    <span>Estabelecimento</span>

                    <strong>
                        ${escaparHTML(
                            nota.mercadoNome
                        )}
                    </strong>
                </div>

                <div class="nota-pdf-card">
                    <span>CNPJ</span>

                    <strong>
                        ${escaparHTML(
                            formatarCNPJ(
                                nota.cnpj
                            )
                        )}
                    </strong>
                </div>

                <div class="nota-pdf-card">
                    <span>Itens informados na nota</span>

                    <strong>
                        ${conferencia.quantidadeOficial || conferencia.quantidadeExtraida}
                    </strong>
                </div>

                <div class="nota-pdf-card">
                    <span>Itens extraídos</span>

                    <strong>
                        ${conferencia.quantidadeExtraida}
                    </strong>
                </div>

                <div class="nota-pdf-card">
                    <span>Valor dos produtos</span>

                    <strong>
                        ${formatarMoeda(
                            conferencia.valorProdutos
                        )}
                    </strong>
                </div>

                <div class="nota-pdf-card">
                    <span>Valor pago</span>

                    <strong>
                        ${formatarMoeda(
                            conferencia.valorPago
                        )}
                    </strong>
                </div>

                <div class="nota-pdf-card">
                    <span>Desconto/diferença</span>

                    <strong>
                        ${formatarMoeda(
                            conferencia.desconto
                        )}
                    </strong>
                </div>

                <div class="nota-pdf-card">
                    <span>Soma dos itens extraídos</span>

                    <strong>
                        ${formatarMoeda(
                            conferencia.valorItens
                        )}
                    </strong>
                </div>
            </div>

            ${possuiDivergencia
                ? `
                    <div class="nota-pdf-conferencia-aviso">
                        Atenção: os dados extraídos não conferem completamente com o resumo oficial da nota.
                        A soma dos itens será comparada ao valor bruto dos produtos.
                        O módulo Gastos salvará o valor efetivamente pago de ${formatarMoeda(conferencia.valorPago)}.
                        Confira a lista de itens antes de confirmar.
                    </div>
                `
                : `
                    <div class="nota-pdf-conferencia-ok">
                        Quantidade e valor conferem com o resumo oficial da nota.
                    </div>
                `}

            <div class="nota-pdf-tabela-wrapper">
                <table class="nota-pdf-tabela">
                    <thead>
                        <tr>
                            <th>Produto</th>
                            <th>Quantidade</th>
                            <th>Unidade</th>
                            <th>Preço unitário</th>
                            <th>Total</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${nota.itens
                            .map(
                                (item, indice) =>
                                    criarLinhaItem(
                                        item,
                                        indice
                                    )
                            )
                            .join("")}
                    </tbody>
                </table>
            </div>

            <div class="nota-pdf-acoes">
                <button
                    type="button"
                    class="nota-pdf-botao nota-pdf-botao-secundario"
                    id="nota-pdf-cancelar"
                >
                    Cancelar
                </button>

                <button
                    type="button"
                    class="nota-pdf-botao nota-pdf-botao-principal"
                    id="nota-pdf-confirmar"
                >
                    Confirmar importação
                </button>
            </div>
        `;

        resultado
            .querySelector(
                "#nota-pdf-cancelar"
            )
            ?.addEventListener(
                "click",
                fechar
            );

        resultado
            .querySelector(
                "#nota-pdf-confirmar"
            )
            ?.addEventListener(
                "click",
                confirmarImportacao
            );
    }

    function criarLinhaItem(
        item,
        indice
    ) {
        return `
            <tr data-indice="${indice}">
                <td>
                    <input
                        type="text"
                        data-campo="produtoNome"
                        value="${escaparAtributo(
                            item.produtoNome
                        )}"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        data-campo="quantidade"
                        min="0"
                        step="0.001"
                        value="${item.quantidade}"
                    >
                </td>

                <td>
                    <input
                        type="text"
                        data-campo="unidade"
                        value="${escaparAtributo(
                            item.unidade
                        )}"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        data-campo="precoUnitario"
                        min="0"
                        step="0.01"
                        value="${item.precoUnitario
                            .toFixed(2)}"
                    >
                </td>

                <td>
                    <input
                        type="number"
                        data-campo="precoTotal"
                        min="0"
                        step="0.01"
                        value="${item.precoTotal
                            .toFixed(2)}"
                    >
                </td>
            </tr>
        `;
    }

    function confirmarImportacao() {
        if (!ESTADO.nota) {
            mostrarErro(
                "Nenhuma nota fiscal está disponível para confirmar."
            );

            return;
        }

        const linhas =
            document.querySelectorAll(
                ".nota-pdf-tabela tbody tr"
            );

        const itensRevisados =
            [...linhas]
                .map((linha) => {
                    const indice =
                        Number(
                            linha.dataset.indice
                        );

                    const itemOriginal =
                        ESTADO.nota
                            .itens[indice];

                    const obterValor =
                        (campo) => {
                            return linha
                                .querySelector(
                                    `[data-campo="${campo}"]`
                                )
                                ?.value;
                        };

                    const produtoNome =
                        obterValor(
                            "produtoNome"
                        )
                            ?.trim() ||
                        "";

                    const quantidade =
                        converterNumero(
                            obterValor(
                                "quantidade"
                            )
                        );

                    const precoUnitario =
                        converterNumero(
                            obterValor(
                                "precoUnitario"
                            )
                        );

                    let precoTotal =
                        converterNumero(
                            obterValor(
                                "precoTotal"
                            )
                        );

                    if (
                        !precoTotal &&
                        quantidade > 0
                    ) {
                        precoTotal =
                            arredondarMoeda(
                                quantidade *
                                precoUnitario
                            );
                    }

                    return {
                        ...itemOriginal,

                        produtoNome,

                        quantidade,

                        unidade:
                            obterValor(
                                "unidade"
                            )
                                ?.trim()
                                .toUpperCase() ||
                            "UN",

                        precoUnitario:
                            arredondarMoeda(
                                precoUnitario
                            ),

                        precoTotal:
                            arredondarMoeda(
                                precoTotal
                            )
                    };
                })
                .filter((item) => {
                    return (
                        item.produtoNome &&
                        item.quantidade > 0
                    );
                });

        if (!itensRevisados.length) {
            mostrarErro(
                "Mantenha pelo menos um produto com nome e quantidade válida."
            );

            return;
        }

        const valorItensRevisados =
            arredondarMoeda(
                itensRevisados.reduce(
                    (total, item) =>
                        total +
                        item.precoTotal,
                    0
                )
            );

        const valorPagoOficial = arredondarMoeda(
            converterNumero(
                ESTADO.nota.valorPago ?? ESTADO.nota.valorTotal
            )
        );

        const valorProdutosOficial = arredondarMoeda(
            converterNumero(
                ESTADO.nota.valorProdutos ?? ESTADO.nota.valorTotal
            )
        );

        const quantidadeTotalOficial = Math.max(
            0,
            Math.trunc(
                converterNumero(
                    ESTADO.nota.quantidadeTotalItens
                )
            )
        );

        const notaConfirmada = {
            ...ESTADO.nota,

            origemImportacao:
                ESTADO.origemAtual ||
                ESTADO.nota.origem ||
                "NOTA_FISCAL",

            itens:
                itensRevisados,

            // Mantém quantidade, valor bruto e valor efetivamente pago.
            // O painel Gastos usa valorTotal como o desembolso real.
            quantidadeTotalItens:
                quantidadeTotalOficial || itensRevisados.length,

            quantidadeItensExtraidos:
                itensRevisados.length,

            valorTotal:
                valorPagoOficial > 0
                    ? valorPagoOficial
                    : valorItensRevisados,

            valorPago:
                valorPagoOficial > 0
                    ? valorPagoOficial
                    : valorItensRevisados,

            valorProdutos:
                valorProdutosOficial > 0
                    ? valorProdutosOficial
                    : valorItensRevisados,

            desconto:
                arredondarMoeda(
                    Math.max(
                        0,
                        valorProdutosOficial - valorPagoOficial
                    )
                ),

            valorItensExtraidos:
                valorItensRevisados,

            possuiDivergenciaExtracao:
                (
                    quantidadeTotalOficial > 0 &&
                    quantidadeTotalOficial !== itensRevisados.length
                ) || (
                    valorProdutosOficial > 0 &&
                    Math.abs(
                        valorProdutosOficial - valorItensRevisados
                    ) >= 0.01
                ),

            revisadaEm:
                new Date().toISOString()
        };

        ESTADO.nota =
            notaConfirmada;

        /*
         * Evento novo e genérico.
         *
         * Será usado pelo novo fluxo de QR Code
         * e pelas futuras integrações.
         */
        window.dispatchEvent(
            new CustomEvent(
                "listalar:nota-importada",
                {
                    detail:
                        notaConfirmada
                }
            )
        );

        /*
         * Compatibilidade com gastos.js 1.2.0.
         *
         * O arquivo atual ainda escuta
         * listalar:nota-pdf-importada.
         */
        window.dispatchEvent(
            new CustomEvent(
                "listalar:nota-pdf-importada",
                {
                    detail:
                        notaConfirmada
                }
            )
        );

        console.log(
            "✅ Nota fiscal conferida e enviada ao módulo Gastos:",
            notaConfirmada
        );

        fechar();
    }

    // ============================================================
    // INTERFACE E MENSAGENS
    // ============================================================

    function atualizarStatus(mensagem) {
        const status =
            document.getElementById(
                "nota-pdf-status"
            );

        if (!status) {
            return;
        }

        status.textContent =
            mensagem;

        status.classList.add(
            "ativo"
        );
    }

    function mostrarErro(mensagem) {
        const resultado =
            document.getElementById(
                "nota-pdf-resultado"
            );

        atualizarStatus(
            "Não foi possível concluir a leitura."
        );

        if (resultado) {
            resultado.innerHTML = `
                <div class="nota-pdf-erro">
                    ${escaparHTML(
                        mensagem
                    )}
                </div>
            `;
        }
    }

    // ============================================================
    // UTILITÁRIOS
    // ============================================================

    function converterMoeda(valor) {
        const texto =
            String(valor || "")
                .replace(
                    /[^\d,.-]/g,
                    ""
                )
                .trim();

        if (!texto) {
            return 0;
        }

        if (texto.includes(",")) {
            return Number(
                texto
                    .replace(/\./g, "")
                    .replace(",", ".")
            ) || 0;
        }

        return Number(texto) || 0;
    }

    function converterNumero(valor) {
        const texto =
            String(valor ?? "")
                .replace(
                    /[^\d,.-]/g,
                    ""
                )
                .trim();

        if (!texto) {
            return 0;
        }

        if (
            texto.includes(",") &&
            texto.includes(".")
        ) {
            return Number(
                texto
                    .replace(/\./g, "")
                    .replace(",", ".")
            ) || 0;
        }

        if (texto.includes(",")) {
            return Number(
                texto.replace(",", ".")
            ) || 0;
        }

        return Number(texto) || 0;
    }

    function arredondarMoeda(valor) {
        return Math.round(
            (
                Number(valor) +
                Number.EPSILON
            ) * 100
        ) / 100;
    }

    function somenteDigitos(valor) {
        return String(valor || "")
            .replace(/\D/g, "");
    }

    function formatarMoeda(valor) {
        return Number(
            valor || 0
        ).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }

    function formatarCNPJ(cnpj) {
        const numeros =
            somenteDigitos(cnpj);

        if (numeros.length !== 14) {
            return cnpj ||
                "Não identificado";
        }

        return numeros.replace(
            /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
            "$1.$2.$3/$4-$5"
        );
    }

    function escaparHTML(valor) {
        return String(valor ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function escaparAtributo(valor) {
        return escaparHTML(valor);
    }

    // ============================================================
    // API PÚBLICA
    // ============================================================

    return {
        versao: VERSAO,

        abrir,

        abrirComNota,

        fechar,

        obterUltimaNota() {
            return ESTADO.nota
                ? clonarSeguro(
                    ESTADO.nota
                )
                : null;
        }
    };
})();

// ============================================================
// COMPATIBILIDADE E EVENTOS
// ============================================================

/*
 * Nome antigo preservado para não quebrar
 * o gastos.js existente.
 */
window.ImportadorNotaPDF =
    ImportadorNotaPDF;

/*
 * Nome novo e genérico.
 */
window.ListaLarConferenciaNota =
    ImportadorNotaPDF;

/*
 * Abre a seleção de PDF.
 */
window.addEventListener(
    "listalar:abrir-importador-nota",
    () => {
        ImportadorNotaPDF.abrir();
    }
);

/*
 * Abre diretamente a conferência de uma nota
 * recebida pelo leitor de QR Code.
 */
window.addEventListener(
    "listalar:conferir-nota",
    (evento) => {
        const nota =
            evento?.detail?.data?.nota ||
            evento?.detail?.data?.dados ||
            evento?.detail?.data ||
            evento?.detail?.nota ||
            evento?.detail?.dados ||
            evento?.detail;

        ImportadorNotaPDF
            .abrirComNota(nota);
    }
);

console.log(
    `✅ Importador e conferidor de nota fiscal carregado — versão ${ImportadorNotaPDF.versao}`
);
