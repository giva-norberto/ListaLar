/**
 * ListaLar — Importador de NFC-e por QR Code
 * Arquivo: importar-nfce-qr.js
 * Versão: 1.2.0
 *
 * Responsabilidades:
 * - abrir a câmera traseira;
 * - ler o QR Code da NFC-e;
 * - usar BarcodeDetector quando disponível;
 * - usar jsQR como alternativa no Safari/iPhone;
 * - permitir colar a URL manualmente;
 * - chamar a Cloud Function consultarNfce;
 * - encaminhar a nota para a tela universal de conferência.
 *
 * Este arquivo não grava diretamente no Firestore.
 */

(() => {
    "use strict";

    const VERSAO = "1.2.0";
    const REGIAO_FUNCOES =
        "southamerica-east1";

    const URL_JSQR =
        "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

    const FIREBASE_CONFIG = {
        apiKey:
            "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",

        authDomain:
            "compras-da-casa.firebaseapp.com",

        projectId:
            "compras-da-casa",

        storageBucket:
            "compras-da-casa.firebasestorage.app",

        messagingSenderId:
            "63765433273",

        appId:
            "1:63765433273:web:c478a3dd33ef3cd55a0468"
    };

    const IDS = {
        estilo:
            "listalar-nfce-qr-estilo",

        overlay:
            "listalar-nfce-qr-overlay",

        fechar:
            "listalar-nfce-qr-fechar",

        video:
            "listalar-nfce-qr-video",

        areaVideo:
            "listalar-nfce-qr-area-video",

        iniciar:
            "listalar-nfce-qr-iniciar",

        parar:
            "listalar-nfce-qr-parar",

        url:
            "listalar-nfce-qr-url",

        consultar:
            "listalar-nfce-qr-consultar",

        status:
            "listalar-nfce-qr-status",

        fallback:
            "listalar-nfce-qr-fallback",

        fallbackAbrirPortal:
            "listalar-nfce-qr-fallback-portal",

        fallbackSelecionarPdf:
            "listalar-nfce-qr-fallback-pdf"
    };

    const estado = {
        familiaId: "",

        modoImportacao:
            "nota_fiscal",

        stream: null,

        detector: null,

        leitorQr: "",

        canvas: null,

        contextoCanvas: null,

        temporizadorLeitura:
            null,

        processando: false,

        fechando: false,

        ultimaUrl: "",

        ultimoQrLido: "",

        ultimaLeituraEm: 0
    };

    let promessaFirebase =
        null;

    let promessaJsQr =
        null;

    // ============================================================
    // ESTILOS
    // ============================================================

    function criarEstilos() {
        if (
            document.getElementById(
                IDS.estilo
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                "style"
            );

        style.id =
            IDS.estilo;

        style.textContent = `
            body.listalar-nfce-qr-aberto {
                overflow: hidden !important;
            }

            .ll-nfce-overlay {
                position: fixed;
                inset: 0;
                z-index: 14000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background:
                    rgba(15, 23, 42, 0.68);
                backdrop-filter:
                    blur(4px);
            }

            .ll-nfce-modal {
                width:
                    min(100%, 540px);
                max-height:
                    calc(100vh - 36px);
                overflow-y: auto;
                border-radius: 22px;
                background: #ffffff;
                box-shadow:
                    0 24px 70px
                    rgba(15, 23, 42, 0.36);
            }

            .ll-nfce-header {
                display: flex;
                align-items: center;
                justify-content:
                    space-between;
                gap: 14px;
                padding: 18px;
                color: #ffffff;
                background:
                    linear-gradient(
                        135deg,
                        #1d4ed8,
                        #2563eb
                    );
                border-radius:
                    22px 22px 0 0;
            }

            .ll-nfce-header h2 {
                margin: 0;
                font-size: 20px;
            }

            .ll-nfce-header p {
                margin: 3px 0 0;
                font-size: 12px;
                opacity: 0.88;
            }

            .ll-nfce-fechar {
                flex: 0 0 auto;
                display: grid;
                place-items: center;
                width: 40px;
                height: 40px;
                border: 0;
                border-radius: 50%;
                color: #ffffff;
                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.16
                    );
                font: inherit;
                font-size: 24px;
                cursor: pointer;
            }

            .ll-nfce-conteudo {
                padding: 18px;
            }

            .ll-nfce-video-area {
                position: relative;
                overflow: hidden;
                aspect-ratio: 4 / 3;
                border-radius: 18px;
                background: #0f172a;
            }

            .ll-nfce-video {
                width: 100%;
                height: 100%;
                object-fit: cover;
                transform:
                    translateZ(0);
            }

            .ll-nfce-mira {
                position: absolute;
                inset:
                    50% auto auto 50%;
                width:
                    min(68%, 280px);
                aspect-ratio: 1;
                transform:
                    translate(
                        -50%,
                        -50%
                    );
                border:
                    3px solid
                    rgba(
                        255,
                        255,
                        255,
                        0.94
                    );
                border-radius: 18px;
                box-shadow:
                    0 0 0 999px
                    rgba(
                        15,
                        23,
                        42,
                        0.3
                    );
                pointer-events: none;
            }

            .ll-nfce-orientacao {
                margin: 12px 0 0;
                color: #64748b;
                font-size: 13px;
                line-height: 1.45;
                text-align: center;
            }

            .ll-nfce-acoes {
                display: grid;
                grid-template-columns:
                    1fr 1fr;
                gap: 10px;
                margin-top: 14px;
            }

            .ll-nfce-botao {
                min-height: 46px;
                padding: 10px 14px;
                border: 0;
                border-radius: 13px;
                font: inherit;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
            }

            .ll-nfce-botao:disabled {
                cursor:
                    not-allowed;
                opacity: 0.58;
            }

            .ll-nfce-botao-principal {
                color: #ffffff;
                background: #2563eb;
            }

            .ll-nfce-botao-secundario {
                color: #334155;
                background: #e2e8f0;
            }

            .ll-nfce-divisor {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 18px 0;
                color: #94a3b8;
                font-size: 12px;
                font-weight: 800;
                text-transform:
                    uppercase;
            }

            .ll-nfce-divisor::before,
            .ll-nfce-divisor::after {
                content: "";
                flex: 1;
                height: 1px;
                background: #e2e8f0;
            }

            .ll-nfce-campo {
                display: grid;
                gap: 7px;
            }

            .ll-nfce-campo label {
                color: #334155;
                font-size: 13px;
                font-weight: 800;
            }

            .ll-nfce-campo textarea {
                width: 100%;
                min-height: 82px;
                resize: vertical;
                padding: 12px;
                border:
                    1px solid #cbd5e1;
                border-radius: 13px;
                color: #0f172a;
                background: #ffffff;
                font: inherit;
                font-size: 13px;
                line-height: 1.4;
                box-sizing:
                    border-box;
            }

            .ll-nfce-status {
                display: none;
                margin-top: 14px;
                padding: 12px 14px;
                border-radius: 13px;
                color: #334155;
                background: #f1f5f9;
                font-size: 13px;
                font-weight: 700;
                line-height: 1.45;
                text-align: center;
            }

            .ll-nfce-status.visivel {
                display: block;
            }

            .ll-nfce-status.sucesso {
                color: #166534;
                background: #dcfce7;
            }

            .ll-nfce-status.erro {
                color: #991b1b;
                background: #fee2e2;
            }

            .ll-nfce-fallback {
                display: none;
                margin-top: 14px;
                padding: 14px;
                border-radius: 16px;
                border:
                    1px dashed #fbbf24;
                background: #fffbeb;
            }

            .ll-nfce-fallback.visivel {
                display: block;
            }

            .ll-nfce-fallback-texto {
                margin: 0 0 12px;
                color: #92400e;
                font-size: 13px;
                font-weight: 700;
                line-height: 1.45;
                text-align: center;
            }

            .ll-nfce-fallback-acoes {
                display: grid;
                grid-template-columns:
                    1fr 1fr;
                gap: 10px;
            }

            @media (
                max-width: 420px
            ) {
                .ll-nfce-fallback-acoes {
                    grid-template-columns:
                        1fr;
                }
            }

            @media (
                max-width: 600px
            ) {
                .ll-nfce-overlay {
                    align-items:
                        flex-end;
                    padding: 0;
                }

                .ll-nfce-modal {
                    width: 100%;
                    max-height: 96vh;
                    border-radius:
                        22px 22px 0 0;
                }

                .ll-nfce-video-area {
                    aspect-ratio: 1 / 1;
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }

    // ============================================================
    // UTILITÁRIOS DE INTERFACE
    // ============================================================

    function obterElemento(id) {
        return document.getElementById(
            id
        );
    }

    function definirStatus(
        mensagem,
        tipo = "info"
    ) {
        const status =
            obterElemento(
                IDS.status
            );

        if (!status) {
            return;
        }

        status.textContent =
            mensagem;

        status.className =
            `ll-nfce-status visivel ${tipo}`;
    }

    function limparStatus() {
        const status =
            obterElemento(
                IDS.status
            );

        if (!status) {
            return;
        }

        status.textContent = "";

        status.className =
            "ll-nfce-status";
    }

    function definirProcessando(
        processando
    ) {
        estado.processando =
            processando === true;

        [
            IDS.iniciar,
            IDS.parar,
            IDS.consultar,
            IDS.url
        ]
            .map(obterElemento)
            .filter(Boolean)
            .forEach(
                (elemento) => {
                    elemento.disabled =
                        estado.processando;
                }
            );
    }

    // ============================================================
    // FIREBASE FUNCTIONS
    // ============================================================

    async function carregarFirebase() {
        if (promessaFirebase) {
            return promessaFirebase;
        }

        promessaFirebase =
            Promise.all([
                import(
                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
                ),

                import(
                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js"
                )
            ])
                .then(
                    ([
                        moduloApp,
                        moduloFunctions
                    ]) => {
                        const app =
                            moduloApp
                                .getApps()
                                .length
                                ? moduloApp
                                    .getApp()
                                : moduloApp
                                    .initializeApp(
                                        FIREBASE_CONFIG
                                    );

                        const functions =
                            moduloFunctions
                                .getFunctions(
                                    app,
                                    REGIAO_FUNCOES
                                );

                        return {
                            consultarNfce:
                                moduloFunctions
                                    .httpsCallable(
                                        functions,
                                        "consultarNfce"
                                    )
                        };
                    }
                )
                .catch((erro) => {
                    promessaFirebase =
                        null;

                    throw erro;
                });

        return promessaFirebase;
    }

    // ============================================================
    // VALIDAÇÃO DA URL
    // ============================================================

    function normalizarUrl(valor) {
        const conteudo =
            String(
                valor || ""
            ).trim();

        if (!conteudo) {
            throw new Error(
                "A URL da NFC-e não foi informada."
            );
        }

        let url;

        try {
            url =
                new URL(conteudo);
        } catch {
            throw new Error(
                "O QR Code não contém uma URL válida."
            );
        }

        if (
            url.protocol !==
            "https:"
        ) {
            throw new Error(
                "A consulta da NFC-e deve usar uma URL HTTPS."
            );
        }

        const hostname =
            url.hostname
                .toLowerCase()
                .replace(/\.$/, "");

        if (
            hostname !== "gov.br" &&
            !hostname.endsWith(
                ".gov.br"
            )
        ) {
            throw new Error(
                "O QR Code não aponta para um portal fiscal oficial do governo."
            );
        }

        return url.toString();
    }

    function obterMensagemErro(
        erro
    ) {
        const codigo =
            String(
                erro?.code || ""
            );

        const mensagem =
            String(
                erro?.message || ""
            ).trim();

        if (
            codigo.includes(
                "unauthenticated"
            )
        ) {
            return (
                "Sua sessão expirou. " +
                "Entre novamente no ListaLar."
            );
        }

        if (
            codigo.includes(
                "permission-denied"
            )
        ) {
            return (
                "Sua conta não tem permissão " +
                "para consultar esta nota."
            );
        }

        if (
            codigo.includes(
                "invalid-argument"
            )
        ) {
            return (
                mensagem ||
                "A URL informada não é uma NFC-e válida."
            );
        }

        if (
            codigo.includes(
                "deadline-exceeded"
            )
        ) {
            return (
                "O portal fiscal demorou demais " +
                "para responder."
            );
        }

        if (
            codigo.includes(
                "resource-exhausted"
            )
        ) {
            return (
                "Muitas consultas foram realizadas. " +
                "Tente novamente em instantes."
            );
        }

        if (
            codigo.includes(
                "failed-precondition"
            )
        ) {
            return (
                mensagem ||
                "O portal fiscal exigiu uma validação adicional."
            );
        }

        if (
            codigo.includes(
                "unavailable"
            )
        ) {
            return (
                "O portal fiscal está indisponível " +
                "no momento."
            );
        }

        return (
            mensagem ||
            "Não foi possível consultar a NFC-e."
        );
    }

    function ehBloqueioSeguranca(
        erro
    ) {
        const textoErro = [
            erro?.code,
            erro?.message,
            erro?.details?.motivo,
            erro?.details?.tipo
        ]
            .filter(Boolean)
            .join(" ")
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                ""
            )
            .toLowerCase();

        return [
            "cloudflare",
            "captcha",
            "recaptcha",
            "verificacao de seguranca",
            "checagem de seguranca",
            "challenge"
        ].some(
            (pista) =>
                textoErro.includes(
                    pista
                )
        );
    }

    // ============================================================
    // RESPOSTA DA CLOUD FUNCTION
    // ============================================================

    function obterNotaResposta(
        resposta
    ) {
        return (
            resposta?.data?.nota ||
            resposta?.data?.dados ||
            resposta?.data ||
            resposta?.nota ||
            resposta?.dados ||
            resposta
        );
    }

    function abrirConferencia(
        nota
    ) {
        const conferidor =
            window
                .ListaLarConferenciaNota ||
            window
                .ImportadorNotaPDF;

        if (
            conferidor &&
            typeof conferidor
                .abrirComNota ===
                "function"
        ) {
            conferidor
                .abrirComNota(
                    nota
                );

            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                "listalar:conferir-nota",
                {
                    detail: nota
                }
            )
        );
    }

    // ============================================================
    // FALLBACK: PORTAL BLOQUEADO (VERIFICAÇÃO DE SEGURANÇA)
    // ============================================================

    function ocultarFallbackBloqueio() {
        const bloco =
            obterElemento(
                IDS.fallback
            );

        if (bloco) {
            bloco.classList
                .remove(
                    "visivel"
                );
        }
    }

    function mostrarFallbackBloqueio(
        url
    ) {
        const bloco =
            obterElemento(
                IDS.fallback
            );

        if (!bloco) {
            return;
        }

        bloco.classList.add(
            "visivel"
        );

        const botaoPortal =
            obterElemento(
                IDS.fallbackAbrirPortal
            );

        if (botaoPortal) {
            botaoPortal.dataset.url =
                url ||
                estado.ultimaUrl ||
                "";
        }
    }

    function abrirPortalManualmente() {
        const url =
            obterElemento(
                IDS.fallbackAbrirPortal
            )?.dataset.url ||

            estado.ultimaUrl;

        if (!url) {
            definirStatus(
                "Não há uma URL de NFC-e para abrir. Leia o QR Code novamente.",
                "erro"
            );

            return;
        }

        window.open(
            url,
            "_blank",
            "noopener"
        );

        definirStatus(
            "Conclua a verificação no portal. Depois, volte aqui e use " +
            "\"Selecionar PDF da nota\" para importar a compra.",
            "info"
        );
    }

    function abrirImportadorPdfExistente() {
        const importador =
            window
                .ImportadorNotaPDF ||
            window
                .ListaLarConferenciaNota;

        if (
            importador &&
            typeof importador
                .abrir ===
                "function"
        ) {
            fechar();

            importador.abrir();

            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                "listalar:abrir-importador-nota"
            )
        );
    }

    async function consultarUrl(
        valorUrl
    ) {
        if (estado.processando) {
            return;
        }

        let url;

        try {
            url =
                normalizarUrl(
                    valorUrl
                );
        } catch (erro) {
            definirStatus(
                erro.message,
                "erro"
            );

            return;
        }

        estado.ultimaUrl =
            url;

        definirProcessando(
            true
        );

        ocultarFallbackBloqueio();

        definirStatus(
            "Consultando a NFC-e no portal fiscal...",
            "info"
        );

        try {
            await pararCamera();

            const firebase =
                await carregarFirebase();

            const resposta =
                await firebase
                    .consultarNfce({
                        url,

                        familiaId:
                            estado
                                .familiaId
                    });

            const nota =
                obterNotaResposta(
                    resposta
                );

            if (
                !nota ||
                typeof nota !==
                    "object"
            ) {
                throw new Error(
                    "A consulta terminou, mas não retornou os dados da nota."
                );
            }

            const notaComContexto = {
                ...nota,

                urlConsulta:
                    nota.urlConsulta ||
                    url,

                familiaIdImportacao:
                    nota
                        .familiaIdImportacao ||
                    estado.familiaId,

                modoImportacao:
                    nota
                        .modoImportacao ||
                    estado
                        .modoImportacao,

                origemImportacao:
                    nota
                        .origemImportacao ||
                    "QR_CODE_NFCE"
            };

            definirStatus(
                "NFC-e encontrada. Abrindo a conferência...",
                "sucesso"
            );

            window.setTimeout(
                () => {
                    fechar();

                    abrirConferencia(
                        notaComContexto
                    );
                },
                250
            );
        } catch (erro) {
            console.error(
                "❌ Erro ao consultar a NFC-e:",
                erro
            );

            definirStatus(
                obterMensagemErro(
                    erro
                ),
                "erro"
            );

            if (
                ehBloqueioSeguranca(
                    erro
                )
            ) {
                mostrarFallbackBloqueio(
                    url
                );
            }
        } finally {
            definirProcessando(
                false
            );
        }
    }

    // ============================================================
    // LEITOR NATIVO
    // ============================================================

    async function criarDetectorQr() {
        if (
            !(
                "BarcodeDetector"
                in window
            )
        ) {
            return null;
        }

        try {
            if (
                typeof BarcodeDetector
                    .getSupportedFormats ===
                "function"
            ) {
                const formatos =
                    await BarcodeDetector
                        .getSupportedFormats();

                if (
                    !formatos.includes(
                        "qr_code"
                    )
                ) {
                    return null;
                }
            }

            return new BarcodeDetector({
                formats: [
                    "qr_code"
                ]
            });
        } catch (erro) {
            console.warn(
                "⚠️ BarcodeDetector indisponível:",
                erro
            );

            return null;
        }
    }

    // ============================================================
    // FALLBACK jsQR PARA IPHONE E SAFARI
    // ============================================================

    function carregarJsQr() {
        if (
            typeof window.jsQR ===
            "function"
        ) {
            return Promise.resolve(
                window.jsQR
            );
        }

        if (promessaJsQr) {
            return promessaJsQr;
        }

        promessaJsQr =
            new Promise(
                (
                    resolver,
                    rejeitar
                ) => {
                    const existente =
                        document
                            .querySelector(
                                'script[data-listalar-jsqr="1"]'
                            );

                    if (existente) {
                        const concluir =
                            () => {
                                if (
                                    typeof window
                                        .jsQR ===
                                    "function"
                                ) {
                                    resolver(
                                        window.jsQR
                                    );

                                    return;
                                }

                                rejeitar(
                                    new Error(
                                        "A biblioteca jsQR não foi carregada."
                                    )
                                );
                            };

                        if (
                            existente
                                .dataset
                                .carregado ===
                            "1"
                        ) {
                            concluir();
                            return;
                        }

                        existente
                            .addEventListener(
                                "load",
                                concluir,
                                {
                                    once: true
                                }
                            );

                        existente
                            .addEventListener(
                                "error",
                                () => {
                                    rejeitar(
                                        new Error(
                                            "Não foi possível carregar o leitor de QR Code."
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
                        document
                            .createElement(
                                "script"
                            );

                    script.src =
                        URL_JSQR;

                    script.async =
                        true;

                    script.crossOrigin =
                        "anonymous";

                    script.dataset
                        .listalarJsqr =
                        "1";

                    script.onload =
                        () => {
                            script.dataset
                                .carregado =
                                "1";

                            if (
                                typeof window
                                    .jsQR ===
                                "function"
                            ) {
                                resolver(
                                    window.jsQR
                                );

                                return;
                            }

                            rejeitar(
                                new Error(
                                    "A biblioteca jsQR não ficou disponível."
                                )
                            );
                        };

                    script.onerror =
                        () => {
                            script.remove();

                            rejeitar(
                                new Error(
                                    "Não foi possível carregar o leitor de QR Code."
                                )
                            );
                        };

                    document.head
                        .appendChild(
                            script
                        );
                }
            )
                .catch((erro) => {
                    promessaJsQr =
                        null;

                    throw erro;
                });

        return promessaJsQr;
    }

    function prepararCanvas() {
        if (!estado.canvas) {
            estado.canvas =
                document
                    .createElement(
                        "canvas"
                    );

            estado.contextoCanvas =
                estado.canvas
                    .getContext(
                        "2d",
                        {
                            willReadFrequently:
                                true
                        }
                    );
        }

        return Boolean(
            estado.contextoCanvas
        );
    }

    async function prepararLeitorQr() {
        const detector =
            await criarDetectorQr();

        if (detector) {
            estado.detector =
                detector;

            estado.leitorQr =
                "barcode-detector";

            return;
        }

        definirStatus(
            "Preparando leitor compatível com iPhone...",
            "info"
        );

        await carregarJsQr();

        if (!prepararCanvas()) {
            throw new Error(
                "O navegador não conseguiu preparar o leitor de QR Code."
            );
        }

        estado.detector =
            null;

        estado.leitorQr =
            "jsqr";
    }

    async function detectarComBarcodeDetector(
        video
    ) {
        if (!estado.detector) {
            return "";
        }

        const codigos =
            await estado
                .detector
                .detect(video);

        return String(
            codigos?.[0]
                ?.rawValue ||
            ""
        ).trim();
    }

    function detectarComJsQr(
        video
    ) {
        if (
            typeof window.jsQR !==
                "function" ||
            !prepararCanvas()
        ) {
            return "";
        }

        const largura =
            video.videoWidth;

        const altura =
            video.videoHeight;

        if (
            !largura ||
            !altura
        ) {
            return "";
        }

        const limiteMaiorLado =
            900;

        const escala =
            Math.min(
                1,

                limiteMaiorLado /
                    Math.max(
                        largura,
                        altura
                    )
            );

        const larguraCanvas =
            Math.max(
                1,

                Math.round(
                    largura *
                    escala
                )
            );

        const alturaCanvas =
            Math.max(
                1,

                Math.round(
                    altura *
                    escala
                )
            );

        estado.canvas.width =
            larguraCanvas;

        estado.canvas.height =
            alturaCanvas;

        estado.contextoCanvas
            .drawImage(
                video,
                0,
                0,
                larguraCanvas,
                alturaCanvas
            );

        const imagem =
            estado.contextoCanvas
                .getImageData(
                    0,
                    0,
                    larguraCanvas,
                    alturaCanvas
                );

        const resultado =
            window.jsQR(
                imagem.data,
                imagem.width,
                imagem.height,
                {
                    inversionAttempts:
                        "attemptBoth"
                }
            );

        return String(
            resultado?.data ||
            ""
        ).trim();
    }

    function podeProcessarQr(
        valor
    ) {
        const agora =
            Date.now();

        if (
            valor ===
                estado
                    .ultimoQrLido &&

            agora -
                estado
                    .ultimaLeituraEm <
                5000
        ) {
            return false;
        }

        estado.ultimoQrLido =
            valor;

        estado.ultimaLeituraEm =
            agora;

        return true;
    }

    function agendarLeitura() {
        window.clearTimeout(
            estado
                .temporizadorLeitura
        );

        if (
            !estado.stream ||
            !estado.leitorQr ||
            estado.processando
        ) {
            return;
        }

        const intervalo =
            estado.leitorQr ===
                "jsqr"
                ? 180
                : 300;

        estado.temporizadorLeitura =
            window.setTimeout(
                tentarLerQuadro,
                intervalo
            );
    }

    async function tentarLerQuadro() {
        const video =
            obterElemento(
                IDS.video
            );

        if (
            !video ||
            !estado.stream ||
            !estado.leitorQr ||
            estado.processando
        ) {
            return;
        }

        try {
            if (
                video.readyState >=
                HTMLMediaElement
                    .HAVE_CURRENT_DATA
            ) {
                const valor =
                    estado.leitorQr ===
                        "barcode-detector"
                        ? await detectarComBarcodeDetector(
                            video
                        )
                        : detectarComJsQr(
                            video
                        );

                if (
                    valor &&
                    podeProcessarQr(
                        valor
                    )
                ) {
                    const campoUrl =
                        obterElemento(
                            IDS.url
                        );

                    if (campoUrl) {
                        campoUrl.value =
                            valor;
                    }

                    let urlNormalizada;

                    try {
                        urlNormalizada =
                            normalizarUrl(
                                valor
                            );
                    } catch (erro) {
                        definirStatus(
                            "O QR Code foi lido, mas não é uma NFC-e oficial. " +
                            erro.message,
                            "erro"
                        );

                        agendarLeitura();

                        return;
                    }

                    definirStatus(
                        "QR Code da NFC-e identificado.",
                        "sucesso"
                    );

                    await consultarUrl(
                        urlNormalizada
                    );

                    return;
                }
            }
        } catch (erro) {
            console.debug(
                "Leitura de quadro não concluída:",
                erro
            );
        }

        agendarLeitura();
    }

    // ============================================================
    // CÂMERA
    // ============================================================

    async function iniciarCamera() {
        if (estado.processando) {
            return;
        }

        limparStatus();

        if (
            !navigator
                .mediaDevices
                ?.getUserMedia
        ) {
            definirStatus(
                "Este navegador não permite acesso à câmera. Cole a URL da NFC-e abaixo.",
                "erro"
            );

            return;
        }

        await pararCamera();

        definirStatus(
            "Abrindo a câmera...",
            "info"
        );

        try {
            await prepararLeitorQr();

            const stream =
                await navigator
                    .mediaDevices
                    .getUserMedia({
                        audio: false,

                        video: {
                            facingMode: {
                                ideal:
                                    "environment"
                            },

                            width: {
                                ideal:
                                    1280
                            },

                            height: {
                                ideal:
                                    720
                            }
                        }
                    });

            const video =
                obterElemento(
                    IDS.video
                );

            if (!video) {
                stream
                    .getTracks()
                    .forEach(
                        (track) => {
                            track.stop();
                        }
                    );

                return;
            }

            estado.stream =
                stream;

            video.srcObject =
                stream;

            await video.play();

            definirStatus(
                estado.leitorQr ===
                    "barcode-detector"
                    ? "Aponte a câmera para o QR Code impresso na NFC-e."
                    : "Leitor compatível com iPhone ativado. Aponte para o QR Code da NFC-e.",
                "info"
            );

            agendarLeitura();
        } catch (erro) {
            console.error(
                "❌ Erro ao abrir a câmera:",
                erro
            );

            await pararCamera();

            const nome =
                String(
                    erro?.name || ""
                );

            if (
                nome ===
                    "NotAllowedError" ||
                nome ===
                    "PermissionDeniedError"
            ) {
                definirStatus(
                    "A permissão da câmera foi negada. Autorize a câmera ou cole a URL abaixo.",
                    "erro"
                );

                return;
            }

            if (
                nome ===
                    "NotFoundError" ||
                nome ===
                    "DevicesNotFoundError"
            ) {
                definirStatus(
                    "Nenhuma câmera foi encontrada neste dispositivo.",
                    "erro"
                );

                return;
            }

            definirStatus(
                erro?.message ||
                "Não foi possível abrir a câmera. Cole a URL da NFC-e abaixo.",
                "erro"
            );
        }
    }

    async function pararCamera() {
        window.clearTimeout(
            estado
                .temporizadorLeitura
        );

        estado.temporizadorLeitura =
            null;

        if (estado.stream) {
            estado.stream
                .getTracks()
                .forEach(
                    (track) => {
                        try {
                            track.stop();
                        } catch {
                            // A câmera já foi encerrada.
                        }
                    }
                );
        }

        estado.stream =
            null;

        estado.detector =
            null;

        estado.leitorQr =
            "";

        const video =
            obterElemento(
                IDS.video
            );

        if (video) {
            video.pause();

            video.srcObject =
                null;
        }
    }

    // ============================================================
    // ABERTURA E FECHAMENTO
    // ============================================================

    async function fechar() {
        if (estado.fechando) {
            return;
        }

        estado.fechando =
            true;

        try {
            await pararCamera();

            obterElemento(
                IDS.overlay
            )?.remove();

            document.body
                .classList
                .remove(
                    "listalar-nfce-qr-aberto"
                );
        } finally {
            estado.fechando =
                false;
        }
    }

    function criarModal() {
        criarEstilos();

        const existente =
            obterElemento(
                IDS.overlay
            );

        if (existente) {
            existente.remove();
        }

        const overlay =
            document.createElement(
                "div"
            );

        overlay.id =
            IDS.overlay;

        overlay.className =
            "ll-nfce-overlay";

        overlay.setAttribute(
            "role",
            "dialog"
        );

        overlay.setAttribute(
            "aria-modal",
            "true"
        );

        overlay.setAttribute(
            "aria-labelledby",
            "ll-nfce-titulo"
        );

        overlay.innerHTML = `
            <section class="ll-nfce-modal">
                <header class="ll-nfce-header">
                    <div>
                        <h2 id="ll-nfce-titulo">
                            Ler QR Code da NFC-e
                        </h2>

                        <p>
                            A compra será conferida
                            antes de ser importada
                        </p>
                    </div>

                    <button
                        id="${IDS.fechar}"
                        class="ll-nfce-fechar"
                        type="button"
                        aria-label="Fechar leitor"
                    >
                        ×
                    </button>
                </header>

                <div class="ll-nfce-conteudo">
                    <div
                        id="${IDS.areaVideo}"
                        class="ll-nfce-video-area"
                    >
                        <video
                            id="${IDS.video}"
                            class="ll-nfce-video"
                            playsinline
                            muted
                        ></video>

                        <div
                            class="ll-nfce-mira"
                        ></div>
                    </div>

                    <p class="ll-nfce-orientacao">
                        Centralize o QR Code dentro
                        do quadrado e mantenha o
                        celular firme.
                    </p>

                    <div class="ll-nfce-acoes">
                        <button
                            id="${IDS.iniciar}"
                            class="ll-nfce-botao ll-nfce-botao-principal"
                            type="button"
                        >
                            Abrir câmera
                        </button>

                        <button
                            id="${IDS.parar}"
                            class="ll-nfce-botao ll-nfce-botao-secundario"
                            type="button"
                        >
                            Parar câmera
                        </button>
                    </div>

                    <div class="ll-nfce-divisor">
                        ou cole o endereço
                    </div>

                    <div class="ll-nfce-campo">
                        <label for="${IDS.url}">
                            URL de consulta da NFC-e
                        </label>

                        <textarea
                            id="${IDS.url}"
                            inputmode="url"
                            autocomplete="off"
                            autocapitalize="off"
                            spellcheck="false"
                            placeholder="https://...gov.br/..."
                        ></textarea>

                        <button
                            id="${IDS.consultar}"
                            class="ll-nfce-botao ll-nfce-botao-principal"
                            type="button"
                        >
                            Consultar NFC-e
                        </button>
                    </div>

                    <div
                        id="${IDS.status}"
                        class="ll-nfce-status"
                        role="status"
                        aria-live="polite"
                    ></div>

                    <div
                        id="${IDS.fallback}"
                        class="ll-nfce-fallback"
                    >
                        <p class="ll-nfce-fallback-texto">
                            O portal fiscal pediu uma
                            verificação de segurança.
                            Conclua no portal e depois
                            importe pelo PDF da nota.
                        </p>

                        <div class="ll-nfce-fallback-acoes">
                            <button
                                id="${IDS.fallbackAbrirPortal}"
                                class="ll-nfce-botao ll-nfce-botao-secundario"
                                type="button"
                            >
                                Abrir portal
                            </button>

                            <button
                                id="${IDS.fallbackSelecionarPdf}"
                                class="ll-nfce-botao ll-nfce-botao-principal"
                                type="button"
                            >
                                Selecionar PDF da nota
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        `;

        document.body
            .appendChild(
                overlay
            );

        document.body
            .classList
            .add(
                "listalar-nfce-qr-aberto"
            );

        obterElemento(
            IDS.fechar
        )?.addEventListener(
            "click",
            fechar
        );

        obterElemento(
            IDS.iniciar
        )?.addEventListener(
            "click",
            iniciarCamera
        );

        obterElemento(
            IDS.parar
        )?.addEventListener(
            "click",
            pararCamera
        );

        obterElemento(
            IDS.consultar
        )?.addEventListener(
            "click",
            () => {
                consultarUrl(
                    obterElemento(
                        IDS.url
                    )?.value ||
                    ""
                );
            }
        );

        obterElemento(
            IDS.fallbackAbrirPortal
        )?.addEventListener(
            "click",
            abrirPortalManualmente
        );

        obterElemento(
            IDS.fallbackSelecionarPdf
        )?.addEventListener(
            "click",
            abrirImportadorPdfExistente
        );

        obterElemento(
            IDS.url
        )?.addEventListener(
            "keydown",
            (evento) => {
                if (
                    (
                        evento.ctrlKey ||
                        evento.metaKey
                    ) &&
                    evento.key ===
                        "Enter"
                ) {
                    consultarUrl(
                        evento
                            .currentTarget
                            .value
                    );
                }
            }
        );

        overlay.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target ===
                    overlay
                ) {
                    fechar();
                }
            }
        );
    }

    function abrir(
        opcoes = {}
    ) {
        estado.familiaId =
            String(
                opcoes.familiaId ||
                ""
            ).trim();

        estado.modoImportacao =
            String(
                opcoes
                    .modoImportacao ||
                "nota_fiscal"
            ).trim() ||
            "nota_fiscal";

        estado.ultimaUrl =
            "";

        estado.ultimoQrLido =
            "";

        estado.ultimaLeituraEm =
            0;

        estado.processando =
            false;

        criarModal();

        window.setTimeout(
            () => {
                iniciarCamera();
            },
            100
        );
    }

    function obterContexto() {
        return {
            familiaId:
                estado.familiaId,

            modoImportacao:
                estado
                    .modoImportacao,

            ultimaUrl:
                estado.ultimaUrl,

            cameraAtiva:
                Boolean(
                    estado.stream
                ),

            processando:
                estado.processando,

            leitorQr:
                estado.leitorQr
        };
    }

    // ============================================================
    // API PÚBLICA
    // ============================================================

    window
        .ListaLarImportadorNfce = {
            versao:
                VERSAO,

            abrir,

            fechar,

            iniciarCamera,

            pararCamera,

            consultarUrl,

            obterContexto
        };

    window.ImportadorNFCe =
        window
            .ListaLarImportadorNfce;

    window.addEventListener(
        "listalar:abrir-importador-nfce",

        (evento) => {
            abrir(
                evento.detail ||
                {}
            );
        }
    );

    document.addEventListener(
        "keydown",

        (evento) => {
            if (
                evento.key ===
                    "Escape" &&

                obterElemento(
                    IDS.overlay
                )
            ) {
                fechar();
            }
        }
    );

    document.addEventListener(
        "visibilitychange",

        () => {
            if (
                document.hidden &&
                estado.stream
            ) {
                pararCamera();
            }
        }
    );

    console.log(
        `✅ Importador NFC-e por QR Code carregado — versão ${VERSAO}`
    );
})();
