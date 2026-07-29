/**
 * ListaLar — Importador de NFC-e por QR Code
 * Arquivo: importar-nfce-qr.js
 * Versão: 1.0.0
 *
 * Responsabilidades:
 * - abrir a câmera traseira;
 * - ler o QR Code da NFC-e;
 * - permitir colar a URL manualmente;
 * - chamar a Cloud Function consultarNfce;
 * - encaminhar a nota para a tela universal de conferência.
 *
 * Este arquivo não grava diretamente no Firestore.
 */

(() => {
    "use strict";

    const VERSAO = "1.0.0";
    const REGIAO_FUNCOES = "southamerica-east1";

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
        authDomain: "compras-da-casa.firebaseapp.com",
        projectId: "compras-da-casa",
        storageBucket: "compras-da-casa.firebasestorage.app",
        messagingSenderId: "63765433273",
        appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
    };

    const IDS = {
        estilo: "listalar-nfce-qr-estilo",
        overlay: "listalar-nfce-qr-overlay",
        fechar: "listalar-nfce-qr-fechar",
        video: "listalar-nfce-qr-video",
        areaVideo: "listalar-nfce-qr-area-video",
        iniciar: "listalar-nfce-qr-iniciar",
        parar: "listalar-nfce-qr-parar",
        url: "listalar-nfce-qr-url",
        consultar: "listalar-nfce-qr-consultar",
        status: "listalar-nfce-qr-status"
    };

    const estado = {
        familiaId: "",
        modoImportacao: "nota_fiscal",
        stream: null,
        detector: null,
        temporizadorLeitura: null,
        processando: false,
        fechando: false,
        ultimaUrl: ""
    };

    let promessaFirebase = null;

    // ============================================================
    // ESTILOS
    // ============================================================

    function criarEstilos() {
        if (document.getElementById(IDS.estilo)) {
            return;
        }

        const style = document.createElement("style");

        style.id = IDS.estilo;

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
                background: rgba(15, 23, 42, 0.68);
                backdrop-filter: blur(4px);
            }

            .ll-nfce-modal {
                width: min(100%, 540px);
                max-height: calc(100vh - 36px);
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
                justify-content: space-between;
                gap: 14px;
                padding: 18px;
                color: #ffffff;
                background:
                    linear-gradient(
                        135deg,
                        #1d4ed8,
                        #2563eb
                    );
                border-radius: 22px 22px 0 0;
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
                background: rgba(255, 255, 255, 0.16);
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
                transform: translateZ(0);
            }

            .ll-nfce-mira {
                position: absolute;
                inset: 50% auto auto 50%;
                width: min(68%, 280px);
                aspect-ratio: 1;
                transform: translate(-50%, -50%);
                border: 3px solid rgba(255, 255, 255, 0.94);
                border-radius: 18px;
                box-shadow:
                    0 0 0 999px
                    rgba(15, 23, 42, 0.3);
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
                grid-template-columns: 1fr 1fr;
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
                cursor: not-allowed;
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
                text-transform: uppercase;
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
                border: 1px solid #cbd5e1;
                border-radius: 13px;
                color: #0f172a;
                background: #ffffff;
                font: inherit;
                font-size: 13px;
                line-height: 1.4;
                box-sizing: border-box;
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

            @media (max-width: 600px) {
                .ll-nfce-overlay {
                    align-items: flex-end;
                    padding: 0;
                }

                .ll-nfce-modal {
                    width: 100%;
                    max-height: 96vh;
                    border-radius: 22px 22px 0 0;
                }

                .ll-nfce-video-area {
                    aspect-ratio: 1 / 1;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ============================================================
    // UTILITÁRIOS DE INTERFACE
    // ============================================================

    function obterElemento(id) {
        return document.getElementById(id);
    }

    function definirStatus(
        mensagem,
        tipo = "info"
    ) {
        const status = obterElemento(
            IDS.status
        );

        if (!status) {
            return;
        }

        status.textContent = mensagem;
        status.className =
            `ll-nfce-status visivel ${tipo}`;
    }

    function limparStatus() {
        const status = obterElemento(
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
            .forEach((elemento) => {
                elemento.disabled =
                    estado.processando;
            });
    }

    // ============================================================
    // FIREBASE FUNCTIONS
    // ============================================================

    async function carregarFirebase() {
        if (promessaFirebase) {
            return promessaFirebase;
        }

        promessaFirebase = Promise.all([
            import(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
            ),

            import(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js"
            )
        ])
            .then(([
                moduloApp,
                moduloFunctions
            ]) => {
                const app =
                    moduloApp.getApps().length
                        ? moduloApp.getApp()
                        : moduloApp.initializeApp(
                            FIREBASE_CONFIG
                        );

                const functions =
                    moduloFunctions.getFunctions(
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
            })
            .catch((erro) => {
                promessaFirebase = null;
                throw erro;
            });

        return promessaFirebase;
    }

    // ============================================================
    // VALIDAÇÃO DA URL
    // ============================================================

    function normalizarUrl(valor) {
        const texto = String(
            valor || ""
        ).trim();

        if (!texto) {
            throw new Error(
                "A URL da NFC-e não foi informada."
            );
        }

        let url;

        try {
            url = new URL(texto);
        } catch {
            throw new Error(
                "O QR Code não contém uma URL válida."
            );
        }

        if (url.protocol !== "https:") {
            throw new Error(
                "A consulta da NFC-e deve usar uma URL HTTPS."
            );
        }

        const hostname =
            url.hostname.toLowerCase();

        if (
            hostname !== "gov.br" &&
            !hostname.endsWith(".gov.br")
        ) {
            throw new Error(
                "O QR Code não aponta para um portal fiscal oficial do governo."
            );
        }

        return url.toString();
    }

    function obterMensagemErro(erro) {
        const codigo = String(
            erro?.code || ""
        );

        const mensagem = String(
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

    // ============================================================
    // RESPOSTA DA CLOUD FUNCTION
    // ============================================================

    function obterNotaResposta(resposta) {
        return (
            resposta?.data?.nota ||
            resposta?.data?.dados ||
            resposta?.data ||
            resposta?.nota ||
            resposta?.dados ||
            resposta
        );
    }

    function abrirConferencia(nota) {
        const conferidor =
            window.ListaLarConferenciaNota ||
            window.ImportadorNotaPDF;

        if (
            conferidor &&
            typeof conferidor
                .abrirComNota === "function"
        ) {
            conferidor.abrirComNota(
                nota
            );

            return;
        }

        /*
         * Contingência caso o conferidor seja
         * carregado por evento.
         */
        window.dispatchEvent(
            new CustomEvent(
                "listalar:conferir-nota",
                {
                    detail: nota
                }
            )
        );
    }

    async function consultarUrl(valorUrl) {
        if (estado.processando) {
            return;
        }

        let url;

        try {
            url = normalizarUrl(
                valorUrl
            );
        } catch (erro) {
            definirStatus(
                erro.message,
                "erro"
            );

            return;
        }

        estado.ultimaUrl = url;

        definirProcessando(true);

        definirStatus(
            "Consultando a NFC-e no portal fiscal...",
            "info"
        );

        try {
            await pararCamera();

            const firebase =
                await carregarFirebase();

            const resposta =
                await firebase.consultarNfce({
                    url,
                    familiaId:
                        estado.familiaId
                });

            const nota =
                obterNotaResposta(
                    resposta
                );

            if (
                !nota ||
                typeof nota !== "object"
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
                    nota.familiaIdImportacao ||
                    estado.familiaId,

                modoImportacao:
                    nota.modoImportacao ||
                    estado.modoImportacao,

                origemImportacao:
                    nota.origemImportacao ||
                    "QR_CODE_NFCE"
            };

            definirStatus(
                "NFC-e encontrada. Abrindo a conferência...",
                "sucesso"
            );

            window.setTimeout(() => {
                fechar();

                abrirConferencia(
                    notaComContexto
                );
            }, 250);
        } catch (erro) {
            console.error(
                "❌ Erro ao consultar a NFC-e:",
                erro
            );

            definirStatus(
                obterMensagemErro(erro),
                "erro"
            );
        } finally {
            definirProcessando(false);
        }
    }

    // ============================================================
    // LEITOR NATIVO DE QR CODE
    // ============================================================

    async function criarDetectorQr() {
        if (!("BarcodeDetector" in window)) {
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
                formats: ["qr_code"]
            });
        } catch (erro) {
            console.warn(
                "⚠️ BarcodeDetector indisponível:",
                erro
            );

            return null;
        }
    }

    function agendarLeitura() {
        window.clearTimeout(
            estado.temporizadorLeitura
        );

        if (
            !estado.stream ||
            !estado.detector ||
            estado.processando
        ) {
            return;
        }

        estado.temporizadorLeitura =
            window.setTimeout(
                tentarLerQuadro,
                300
            );
    }

    async function tentarLerQuadro() {
        const video = obterElemento(
            IDS.video
        );

        if (
            !video ||
            !estado.stream ||
            !estado.detector ||
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
                const codigos =
                    await estado.detector
                        .detect(video);

                const valor = String(
                    codigos?.[0]
                        ?.rawValue ||
                    ""
                ).trim();

                if (valor) {
                    const campoUrl =
                        obterElemento(
                            IDS.url
                        );

                    if (campoUrl) {
                        campoUrl.value =
                            valor;
                    }

                    definirStatus(
                        "QR Code identificado.",
                        "sucesso"
                    );

                    await consultarUrl(
                        valor
                    );

                    return;
                }
            }
        } catch (erro) {
            /*
             * Alguns quadros podem falhar durante
             * movimentação da câmera. O leitor
             * simplesmente tenta novamente.
             */
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
            !navigator.mediaDevices
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
            const detector =
                await criarDetectorQr();

            if (!detector) {
                definirStatus(
                    "Este navegador não possui leitura nativa de QR Code. Cole a URL da NFC-e abaixo.",
                    "erro"
                );

                return;
            }

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
                                ideal: 1280
                            },

                            height: {
                                ideal: 720
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
                        (track) =>
                            track.stop()
                    );

                return;
            }

            estado.detector = detector;
            estado.stream = stream;

            video.srcObject = stream;

            await video.play();

            definirStatus(
                "Aponte a câmera para o QR Code impresso na NFC-e.",
                "info"
            );

            agendarLeitura();
        } catch (erro) {
            console.error(
                "❌ Erro ao abrir a câmera:",
                erro
            );

            const nome = String(
                erro?.name || ""
            );

            if (
                nome === "NotAllowedError" ||
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
                nome === "NotFoundError" ||
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
                "Não foi possível abrir a câmera. Cole a URL da NFC-e abaixo.",
                "erro"
            );
        }
    }

    async function pararCamera() {
        window.clearTimeout(
            estado.temporizadorLeitura
        );

        estado.temporizadorLeitura =
            null;

        if (estado.stream) {
            estado.stream
                .getTracks()
                .forEach((track) => {
                    try {
                        track.stop();
                    } catch {
                        /*
                         * A câmera já estava
                         * encerrada.
                         */
                    }
                });
        }

        estado.stream = null;
        estado.detector = null;

        const video =
            obterElemento(
                IDS.video
            );

        if (video) {
            video.pause();
            video.srcObject = null;
        }
    }

    // ============================================================
    // ABERTURA E FECHAMENTO
    // ============================================================

    async function fechar() {
        if (estado.fechando) {
            return;
        }

        estado.fechando = true;

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
            estado.fechando = false;
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

        overlay.id = IDS.overlay;
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
                </div>
            </section>
        `;

        document.body.appendChild(
            overlay
        );

        document.body.classList.add(
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
                    )?.value || ""
                );
            }
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

    function abrir(opcoes = {}) {
        estado.familiaId = String(
            opcoes.familiaId || ""
        ).trim();

        estado.modoImportacao = String(
            opcoes.modoImportacao ||
            "nota_fiscal"
        ).trim() || "nota_fiscal";

        estado.ultimaUrl = "";
        estado.processando = false;

        criarModal();

        /*
         * A abertura ocorre a partir de um clique
         * do usuário no seletor de importação.
         */
        window.setTimeout(() => {
            iniciarCamera();
        }, 100);
    }

    function obterContexto() {
        return {
            familiaId:
                estado.familiaId,

            modoImportacao:
                estado.modoImportacao,

            ultimaUrl:
                estado.ultimaUrl,

            cameraAtiva:
                Boolean(
                    estado.stream
                ),

            processando:
                estado.processando
        };
    }

    // ============================================================
    // API PÚBLICA
    // ============================================================

    window.ListaLarImportadorNfce = {
        versao: VERSAO,
        abrir,
        fechar,
        iniciarCamera,
        pararCamera,
        consultarUrl,
        obterContexto
    };

    /*
     * Nome alternativo aceito pelo
     * importar-compra.js.
     */
    window.ImportadorNFCe =
        window.ListaLarImportadorNfce;

    window.addEventListener(
        "listalar:abrir-importador-nfce",
        (evento) => {
            abrir(
                evento.detail || {}
            );
        }
    );

    document.addEventListener(
        "keydown",
        (evento) => {
            if (
                evento.key === "Escape" &&
                obterElemento(
                    IDS.overlay
                )
            ) {
                fechar();
            }
        }
    );

    /*
     * Interrompe a câmera quando o usuário
     * muda de aplicativo ou bloqueia a tela.
     */
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
