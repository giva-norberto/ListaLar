// ============================================================
// LISTALAR — MÓDULO GASTOS
// Arquivo: gastos.js
// Versão: 1.3.0
//
// Responsabilidades:
// - Criar o acesso "Gastos"
// - Criar a tela "Meus Gastos"
// - Abrir a importação por QR Code ou PDF
// - Receber e preparar os dados conferidos da nota
//
// Este arquivo não altera os módulos existentes.
// ============================================================

(() => {
    "use strict";

    const VERSAO = "1.3.0";

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
        authDomain: "compras-da-casa.firebaseapp.com",
        projectId: "compras-da-casa",
        storageBucket: "compras-da-casa.firebasestorage.app",
        messagingSenderId: "63765433273",
        appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
    };

    /*
     * Mesma regra usada no módulo Tarefas:
     * - acesso geral quando gastosLiberados === true;
     * - acesso permanente para familiaPilotoId;
     * - administrador como piloto apenas enquanto o documento
     *   configuracoes/modulos ainda não existir.
     */
    const ADMIN_COMO_PILOTO_SEM_CONFIG = true;

    const IDS = {
        estilo: "listalar-gastos-estilo",
        botaoMenu: "listalar-menu-gastos",
        tela: "listalar-tela-gastos",
        botaoFechar: "listalar-gastos-fechar",
        botaoImportar: "listalar-gastos-importar-nf",
        resumoImportacao: "listalar-gastos-resumo-importacao",
        aviso: "listalar-gastos-aviso",

        modalDuplicidade:
            "listalar-gastos-modal-duplicidade",

        modalCancelar:
            "listalar-gastos-modal-cancelar",

        modalSubstituir:
            "listalar-gastos-modal-substituir",

        modalNovaCompra:
            "listalar-gastos-modal-nova-compra",

        modalOrigem:
            "listalar-gastos-modal-origem",

        modalOrigemQr:
            "listalar-gastos-modal-origem-qr",

        modalOrigemPdf:
            "listalar-gastos-modal-origem-pdf",

        modalOrigemCancelar:
            "listalar-gastos-modal-origem-cancelar"
    };

    let ultimaNotaImportada = null;
    let modoImportacaoAtual = null;

    let resolverModoImportacao = null;
    let resolverOrigemImportacao = null;

    /*
     * O conferidor universal emite o evento genérico e também
     * o evento antigo de compatibilidade.
     *
     * Esta referência impede que a mesma nota seja processada
     * duas vezes pelo módulo Gastos.
     */
    let ultimaNotaRecebidaReferencia = null;
    let ultimaNotaRecebidaEm = 0;

    let familiaIdAtual = "";
    let moduloLiberado = false;
    let interfaceInicializada = false;
    let promessaFirebaseGastos = null;

    // ========================================================
    // UTILITÁRIOS
    // ========================================================

    function escaparHTML(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function formatarMoeda(valor) {
        const numero = Number(valor);

        if (!Number.isFinite(numero)) {
            return "R$ 0,00";
        }

        return numero.toLocaleString("pt-BR", {
            style: "currency",
            currency: "BRL"
        });
    }

    function formatarQuantidade(valor) {
        const numero = Number(valor);

        if (!Number.isFinite(numero)) {
            return "0";
        }

        return numero.toLocaleString("pt-BR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 3
        });
    }

    function mostrarAviso(
        mensagem,
        tipo = "info"
    ) {
        const aviso = document.getElementById(
            IDS.aviso
        );

        if (!aviso) {
            return;
        }

        aviso.textContent = mensagem;
        aviso.className =
            `listalar-gastos-aviso ${tipo}`;

        aviso.hidden = false;

        window.clearTimeout(
            mostrarAviso.timeout
        );

        mostrarAviso.timeout =
            window.setTimeout(() => {
                aviso.hidden = true;
            }, 4500);
    }

    function controlePrecosEstaAtivo() {
        try {
            return Boolean(
                window.ListaLarPrecos &&
                typeof window.ListaLarPrecos
                    .estaAtivo === "function" &&
                window.ListaLarPrecos
                    .estaAtivo() === true
            );
        } catch (erro) {
            console.warn(
                "⚠️ Não foi possível verificar o Controle de Preços:",
                erro
            );

            return false;
        }
    }

    // ========================================================
    // CONTROLE DE ACESSO DO MÓDULO
    // ========================================================

    function carregarFirebaseGastos() {
        if (promessaFirebaseGastos) {
            return promessaFirebaseGastos;
        }

        promessaFirebaseGastos =
            Promise.all([
                import(
                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
                ),

                import(
                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
                ),

                import(
                    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
                )
            ]).then(([
                moduloApp,
                moduloAuth,
                moduloFirestore
            ]) => {
                const app =
                    moduloApp.getApps().length
                        ? moduloApp.getApp()
                        : moduloApp.initializeApp(
                            FIREBASE_CONFIG
                        );

                return {
                    auth:
                        moduloAuth.getAuth(app),

                    db:
                        moduloFirestore
                            .getFirestore(app),

                    onAuthStateChanged:
                        moduloAuth
                            .onAuthStateChanged,

                    doc:
                        moduloFirestore.doc,

                    getDoc:
                        moduloFirestore.getDoc
                };
            });

        return promessaFirebaseGastos;
    }

    function definirVisibilidadeGastos(
        liberado
    ) {
        moduloLiberado =
            liberado === true;

        if (moduloLiberado) {
            if (!interfaceInicializada) {
                criarTela();
                criarBotaoMenu();
                configurarEventos();

                interfaceInicializada = true;
            } else {
                const botao =
                    document.getElementById(
                        IDS.botaoMenu
                    );

                if (botao) {
                    botao.hidden = false;
                }
            }

            return;
        }

        const botao =
            document.getElementById(
                IDS.botaoMenu
            );

        if (botao) {
            botao.hidden = true;
        }

        fecharModalDuplicidade();
        fecharModalOrigem();
        fecharTela();
    }

    async function carregarContextoGastos(
        usuario,
        firebase
    ) {
        const usuarioSnapshot =
            await firebase.getDoc(
                firebase.doc(
                    firebase.db,
                    "usuarios",
                    usuario.uid
                )
            );

        if (!usuarioSnapshot.exists()) {
            familiaIdAtual = "";
            definirVisibilidadeGastos(false);
            return;
        }

        const dadosUsuario =
            usuarioSnapshot.data();

        const familiaId = String(
            dadosUsuario.familiaId || ""
        ).trim();

        if (!familiaId) {
            familiaIdAtual = "";
            definirVisibilidadeGastos(false);
            return;
        }

        const modulosSnapshot =
            await firebase.getDoc(
                firebase.doc(
                    firebase.db,
                    "configuracoes",
                    "modulos"
                )
            );

        const modulos =
            modulosSnapshot.exists()
                ? modulosSnapshot.data()
                : {};

        familiaIdAtual = familiaId;

        const liberado =
            modulos.gastosLiberados === true ||
            modulos.familiaPilotoId ===
                familiaId ||
            (
                ADMIN_COMO_PILOTO_SEM_CONFIG &&
                !modulosSnapshot.exists() &&
                dadosUsuario.adminSistema ===
                    true
            );

        definirVisibilidadeGastos(
            liberado
        );

        console.log(
            "Diagnóstico módulo Gastos:",
            {
                familiaId:
                    familiaIdAtual,

                familiaPilotoId:
                    modulos
                        .familiaPilotoId ||
                    "",

                gastosLiberados:
                    modulos
                        .gastosLiberados ===
                    true,

                liberado:
                    moduloLiberado
            }
        );

        window.dispatchEvent(
            new CustomEvent(
                "listalar:gastos-pronto",
                {
                    detail: {
                        familiaId:
                            familiaIdAtual,

                        liberado:
                            moduloLiberado
                    }
                }
            )
        );
    }

    async function iniciarControleAcessoGastos() {
        try {
            const firebase =
                await carregarFirebaseGastos();

            firebase.onAuthStateChanged(
                firebase.auth,

                async (usuario) => {
                    if (!usuario) {
                        familiaIdAtual = "";

                        definirVisibilidadeGastos(
                            false
                        );

                        return;
                    }

                    try {
                        await carregarContextoGastos(
                            usuario,
                            firebase
                        );
                    } catch (erro) {
                        console.error(
                            "❌ Erro ao verificar a liberação do módulo Gastos:",
                            erro
                        );

                        familiaIdAtual = "";

                        definirVisibilidadeGastos(
                            false
                        );
                    }
                }
            );
        } catch (erro) {
            console.error(
                "❌ Erro ao iniciar o controle de acesso do módulo Gastos:",
                erro
            );

            familiaIdAtual = "";

            definirVisibilidadeGastos(
                false
            );
        }
    }

    // ========================================================
    // ESTILOS
    // ========================================================

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

        style.id = IDS.estilo;

        style.textContent = `
            body.listalar-gastos-aberto {
                overflow: hidden !important;
            }

            .listalar-menu-gastos {
                border: 0;
                background: transparent;
                color: inherit;
                font: inherit;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                min-width: 62px;
                min-height: 48px;
                padding: 7px 9px;
                border-radius: 12px;
                transition:
                    background-color 0.2s ease,
                    transform 0.2s ease;
            }

            .listalar-menu-gastos:hover {
                background:
                    rgba(37, 99, 235, 0.09);
            }

            .listalar-menu-gastos:active {
                transform: scale(0.96);
            }

            .listalar-menu-gastos-icone {
                font-size: 21px;
                line-height: 1;
            }

            .listalar-menu-gastos-texto {
                font-size: 12px;
                font-weight: 700;
                line-height: 1;
                white-space: nowrap;
            }

            #bottom-nav:has(
                #listalar-menu-gastos
            ),

            #bottomNav:has(
                #listalar-menu-gastos
            ),

            #menu-inferior:has(
                #listalar-menu-gastos
            ),

            #menuInferior:has(
                #listalar-menu-gastos
            ),

            .bottom-nav:has(
                #listalar-menu-gastos
            ),

            .bottom-navigation:has(
                #listalar-menu-gastos
            ),

            .menu-inferior:has(
                #listalar-menu-gastos
            ),

            .menu-bottom:has(
                #listalar-menu-gastos
            ),

            .nav-bottom:has(
                #listalar-menu-gastos
            ),

            .mobile-nav:has(
                #listalar-menu-gastos
            ),

            [data-menu-principal]:has(
                #listalar-menu-gastos
            ) {
                width: 100% !important;
                display: flex !important;
                flex-wrap: nowrap !important;
                align-items:
                    stretch !important;
                justify-content:
                    stretch !important;
                gap: 4px !important;
                box-sizing:
                    border-box !important;
            }

            #bottom-nav:has(
                #listalar-menu-gastos
            ) > *,

            #bottomNav:has(
                #listalar-menu-gastos
            ) > *,

            #menu-inferior:has(
                #listalar-menu-gastos
            ) > *,

            #menuInferior:has(
                #listalar-menu-gastos
            ) > *,

            .bottom-nav:has(
                #listalar-menu-gastos
            ) > *,

            .bottom-navigation:has(
                #listalar-menu-gastos
            ) > *,

            .menu-inferior:has(
                #listalar-menu-gastos
            ) > *,

            .menu-bottom:has(
                #listalar-menu-gastos
            ) > *,

            .nav-bottom:has(
                #listalar-menu-gastos
            ) > *,

            .mobile-nav:has(
                #listalar-menu-gastos
            ) > *,

            [data-menu-principal]:has(
                #listalar-menu-gastos
            ) > * {
                flex: 1 1 0 !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: none !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
                box-sizing:
                    border-box !important;
            }

            #bottom-nav:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            #bottomNav:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            #menu-inferior:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            #menuInferior:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            .bottom-nav:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            .bottom-navigation:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            .menu-inferior:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            .menu-bottom:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            .nav-bottom:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            .mobile-nav:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos,

            [data-menu-principal]:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos {
                width: auto !important;
                min-width: 0 !important;
                max-width: none !important;
                min-height: 56px;
                padding: 6px 2px;
                flex-direction: column;
                gap: 2px;
            }

            #bottom-nav:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            #bottomNav:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            #menu-inferior:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            #menuInferior:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            .bottom-nav:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            .bottom-navigation:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            .menu-inferior:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            .menu-bottom:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            .nav-bottom:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            .mobile-nav:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto,

            [data-menu-principal]:has(
                #listalar-menu-gastos
            )
            .listalar-menu-gastos-texto {
                max-width: 100%;
                overflow: hidden;
                font-size: 11px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .listalar-menu-gastos-fixo {
                position: fixed;
                right: 16px;
                bottom: 18px;
                z-index: 9990;
                color: #ffffff;
                background: #2563eb;
                box-shadow:
                    0 8px 24px
                    rgba(0, 0, 0, 0.22);
                padding: 10px 14px;
            }

            .listalar-gastos-tela {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: none;
                background: #f4f7fb;
                color: #172033;
                overflow-y: auto;
                overscroll-behavior:
                    contain;
            }

            .listalar-gastos-tela.aberta {
                display: block;
            }

            .listalar-gastos-cabecalho {
                position: sticky;
                top: 0;
                z-index: 5;
                display: flex;
                align-items: center;
                justify-content:
                    space-between;
                gap: 14px;
                min-height: 68px;
                padding:
                    max(
                        14px,
                        env(safe-area-inset-top)
                    )
                    18px
                    14px;
                color: #ffffff;
                background:
                    linear-gradient(
                        135deg,
                        #1d4ed8,
                        #2563eb
                    );
                box-shadow:
                    0 4px 16px
                    rgba(15, 23, 42, 0.18);
            }

            .listalar-gastos-cabecalho-titulo {
                display: flex;
                align-items: center;
                gap: 11px;
                min-width: 0;
            }

            .listalar-gastos-cabecalho-icone {
                flex: 0 0 auto;
                display: grid;
                place-items: center;
                width: 42px;
                height: 42px;
                border-radius: 13px;
                font-size: 23px;
                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.16
                    );
            }

            .listalar-gastos-cabecalho h1 {
                margin: 0;
                font-size: 21px;
                line-height: 1.15;
            }

            .listalar-gastos-cabecalho p {
                margin: 3px 0 0;
                font-size: 12px;
                opacity: 0.88;
            }

            .listalar-gastos-fechar {
                flex: 0 0 auto;
                display: grid;
                place-items: center;
                width: 42px;
                height: 42px;
                border: 0;
                border-radius: 50%;
                color: #ffffff;
                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.17
                    );
                font-size: 25px;
                cursor: pointer;
            }

            .listalar-gastos-fechar:active {
                transform: scale(0.94);
            }

            .listalar-gastos-conteudo {
                width: min(100%, 920px);
                margin: 0 auto;
                padding:
                    18px 16px 110px;
            }

            .listalar-gastos-boas-vindas {
                margin-bottom: 16px;
                padding: 18px;
                border-radius: 18px;
                color: #ffffff;
                background:
                    linear-gradient(
                        135deg,
                        #0f766e,
                        #14b8a6
                    );
                box-shadow:
                    0 10px 24px
                    rgba(
                        15,
                        118,
                        110,
                        0.18
                    );
            }

            .listalar-gastos-boas-vindas h2 {
                margin: 0 0 7px;
                font-size: 19px;
            }

            .listalar-gastos-boas-vindas p {
                margin: 0;
                font-size: 14px;
                line-height: 1.45;
                opacity: 0.94;
            }

            .listalar-gastos-grade-resumo {
                display: grid;
                grid-template-columns:
                    repeat(
                        3,
                        minmax(0, 1fr)
                    );
                gap: 12px;
                margin-bottom: 16px;
            }

            .listalar-gastos-card-resumo {
                min-height: 105px;
                padding: 15px;
                border:
                    1px solid #e3e9f2;
                border-radius: 17px;
                background: #ffffff;
                box-shadow:
                    0 5px 15px
                    rgba(
                        15,
                        23,
                        42,
                        0.06
                    );
            }

            .listalar-gastos-card-resumo span {
                display: block;
                margin-bottom: 9px;
                color: #64748b;
                font-size: 12px;
                font-weight: 700;
            }

            .listalar-gastos-card-resumo strong {
                display: block;
                color: #172033;
                font-size: 20px;
                line-height: 1.2;
                overflow-wrap: anywhere;
            }

            .listalar-gastos-card {
                margin-bottom: 16px;
                padding: 18px;
                border:
                    1px solid #e3e9f2;
                border-radius: 18px;
                background: #ffffff;
                box-shadow:
                    0 5px 16px
                    rgba(
                        15,
                        23,
                        42,
                        0.06
                    );
            }

            .listalar-gastos-card-topo {
                display: flex;
                align-items:
                    flex-start;
                justify-content:
                    space-between;
                gap: 16px;
                margin-bottom: 15px;
            }

            .listalar-gastos-card-topo h2 {
                margin: 0 0 4px;
                font-size: 18px;
            }

            .listalar-gastos-card-topo p {
                margin: 0;
                color: #64748b;
                font-size: 13px;
                line-height: 1.4;
            }

            .listalar-gastos-botao-principal {
                width: 100%;
                min-height: 50px;
                border: 0;
                border-radius: 14px;
                color: #ffffff;
                background: #2563eb;
                font-size: 15px;
                font-weight: 800;
                cursor: pointer;
                box-shadow:
                    0 7px 16px
                    rgba(
                        37,
                        99,
                        235,
                        0.22
                    );
            }

            .listalar-gastos-botao-principal:hover {
                background: #1d4ed8;
            }

            .listalar-gastos-botao-principal:active {
                transform: scale(0.985);
            }

            .listalar-gastos-resumo-importacao {
                display: none;
            }

            .listalar-gastos-resumo-importacao.visivel {
                display: block;
            }

            .listalar-gastos-nota-cabecalho {
                display: grid;
                grid-template-columns:
                    1fr auto;
                gap: 12px;
                align-items: start;
                padding-bottom: 14px;
                border-bottom:
                    1px solid #e8edf5;
            }

            .listalar-gastos-nota-cabecalho h3 {
                margin: 0 0 5px;
                font-size: 17px;
            }

            .listalar-gastos-nota-cabecalho p {
                margin: 0;
                color: #64748b;
                font-size: 13px;
                line-height: 1.45;
            }

            .listalar-gastos-nota-total {
                color: #0f766e;
                font-size: 19px;
                font-weight: 900;
                white-space: nowrap;
            }

            .listalar-gastos-produtos {
                margin-top: 13px;
            }

            .listalar-gastos-produto {
                display: grid;
                grid-template-columns:
                    minmax(0, 1fr)
                    auto;
                gap: 12px;
                padding: 11px 0;
                border-bottom:
                    1px solid #edf1f6;
            }

            .listalar-gastos-produto:last-child {
                border-bottom: 0;
            }

            .listalar-gastos-produto strong {
                display: block;
                margin-bottom: 4px;
                font-size: 14px;
                line-height: 1.3;
            }

            .listalar-gastos-produto small {
                color: #64748b;
                font-size: 12px;
            }

            .listalar-gastos-produto-valor {
                font-size: 14px;
                font-weight: 800;
                white-space: nowrap;
            }

            .listalar-gastos-vazio {
                padding: 22px 14px;
                border:
                    1px dashed #cbd5e1;
                border-radius: 14px;
                text-align: center;
                color: #64748b;
                background: #f8fafc;
            }

            .listalar-gastos-vazio-icone {
                display: block;
                margin-bottom: 7px;
                font-size: 28px;
            }

            .listalar-gastos-aviso {
                position: fixed;
                left: 50%;
                bottom:
                    max(
                        22px,
                        env(
                            safe-area-inset-bottom
                        )
                    );
                z-index: 11000;
                width:
                    min(
                        calc(100% - 32px),
                        480px
                    );
                transform:
                    translateX(-50%);
                padding: 13px 16px;
                border-radius: 13px;
                color: #ffffff;
                background: #334155;
                font-size: 14px;
                font-weight: 700;
                text-align: center;
                box-shadow:
                    0 10px 28px
                    rgba(0, 0, 0, 0.24);
            }

            .listalar-gastos-aviso.sucesso {
                background: #15803d;
            }

            .listalar-gastos-aviso.erro {
                background: #b91c1c;
            }

            .listalar-gastos-aviso.info {
                background: #334155;
            }

            .listalar-gastos-modal {
                position: fixed;
                inset: 0;
                z-index: 12000;
                display: none;
                align-items: center;
                justify-content: center;
                padding:
                    max(
                        18px,
                        env(safe-area-inset-top)
                    )
                    16px
                    max(
                        18px,
                        env(
                            safe-area-inset-bottom
                        )
                    );
                background:
                    rgba(
                        15,
                        23,
                        42,
                        0.62
                    );
                backdrop-filter:
                    blur(3px);
            }

            .listalar-gastos-modal.aberto {
                display: flex;
            }

            .listalar-gastos-modal-conteudo {
                width:
                    min(
                        100%,
                        500px
                    );
                max-height:
                    calc(100vh - 36px);
                overflow-y: auto;
                padding: 22px;
                border-radius: 20px;
                background: #ffffff;
                box-shadow:
                    0 24px 60px
                    rgba(
                        15,
                        23,
                        42,
                        0.34
                    );
                animation:
                    listalar-gastos-modal-entrada
                    0.2s ease-out;
            }

            @keyframes
            listalar-gastos-modal-entrada {
                from {
                    opacity: 0;
                    transform:
                        translateY(12px)
                        scale(0.98);
                }

                to {
                    opacity: 1;
                    transform:
                        translateY(0)
                        scale(1);
                }
            }

            .listalar-gastos-modal-icone {
                display: grid;
                place-items: center;
                width: 52px;
                height: 52px;
                margin:
                    0 auto 13px;
                border-radius: 16px;
                background: #dbeafe;
                font-size: 27px;
            }

            .listalar-gastos-modal h2 {
                margin: 0;
                color: #172033;
                font-size: 21px;
                text-align: center;
            }

            .listalar-gastos-modal-descricao {
                margin:
                    9px 0 18px;
                color: #64748b;
                font-size: 14px;
                line-height: 1.5;
                text-align: center;
            }

            .listalar-gastos-modal-opcoes {
                display: grid;
                gap: 10px;
            }

            .listalar-gastos-modal-opcao {
                width: 100%;
                min-height: 58px;
                padding: 12px 14px;
                border:
                    1px solid #dbe4f0;
                border-radius: 14px;
                color: #172033;
                background: #f8fafc;
                font: inherit;
                font-size: 14px;
                font-weight: 800;
                line-height: 1.35;
                text-align: left;
                cursor: pointer;
                transition:
                    border-color
                    0.2s ease,
                    background-color
                    0.2s ease,
                    transform
                    0.2s ease;
            }

            .listalar-gastos-modal-opcao:hover {
                border-color: #2563eb;
                background: #eff6ff;
            }

            .listalar-gastos-modal-opcao:active {
                transform: scale(0.985);
            }

            .listalar-gastos-modal-opcao.destaque {
                border-color: #2563eb;
                color: #ffffff;
                background: #2563eb;
            }

            .listalar-gastos-modal-opcao.destaque:hover {
                background: #1d4ed8;
            }

            .listalar-gastos-modal-opcao-conteudo {
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .listalar-gastos-modal-opcao-icone {
                flex: 0 0 auto;
                display: grid;
                place-items: center;
                width: 42px;
                height: 42px;
                border-radius: 12px;
                background: #dbeafe;
                font-size: 22px;
            }

            .listalar-gastos-modal-opcao.destaque
            .listalar-gastos-modal-opcao-icone {
                background:
                    rgba(
                        255,
                        255,
                        255,
                        0.18
                    );
            }

            .listalar-gastos-modal-opcao-textos {
                min-width: 0;
            }

            .listalar-gastos-modal-opcao-textos strong,
            .listalar-gastos-modal-opcao-textos small {
                display: block;
            }

            .listalar-gastos-modal-opcao-textos small {
                margin-top: 3px;
                color: #64748b;
                font-size: 12px;
                font-weight: 600;
            }

            .listalar-gastos-modal-opcao.destaque
            .listalar-gastos-modal-opcao-textos small {
                color:
                    rgba(
                        255,
                        255,
                        255,
                        0.84
                    );
            }

            .listalar-gastos-modal-cancelar {
                width: 100%;
                min-height: 45px;
                margin-top: 10px;
                border: 0;
                border-radius: 13px;
                color: #64748b;
                background: transparent;
                font: inherit;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
            }

            .listalar-gastos-modal-cancelar:hover {
                background: #f1f5f9;
            }

            @media (max-width: 680px) {
                .listalar-gastos-cabecalho {
                    min-height: 62px;
                    padding-left: 14px;
                    padding-right: 14px;
                }

                .listalar-gastos-cabecalho h1 {
                    font-size: 19px;
                }

                .listalar-gastos-cabecalho p {
                    display: none;
                }

                .listalar-gastos-conteudo {
                    padding:
                        14px 12px 100px;
                }

                .listalar-gastos-grade-resumo {
                    grid-template-columns:
                        1fr 1fr;
                    gap: 10px;
                }

                .listalar-gastos-card-resumo {
                    min-height: 92px;
                    padding: 13px;
                }

                .listalar-gastos-card-resumo:first-child {
                    grid-column:
                        1 / -1;
                }

                .listalar-gastos-card-resumo strong {
                    font-size: 18px;
                }

                .listalar-gastos-card {
                    padding: 15px;
                }

                .listalar-gastos-nota-cabecalho {
                    grid-template-columns:
                        1fr;
                }

                .listalar-gastos-nota-total {
                    font-size: 18px;
                }

                .listalar-gastos-modal-conteudo {
                    padding:
                        19px 16px 16px;
                    border-radius: 18px;
                }

                .listalar-gastos-modal h2 {
                    font-size: 19px;
                }

                .listalar-gastos-modal-opcao {
                    min-height: 55px;
                }
            }

            @media (max-width: 390px) {
                .listalar-menu-gastos {
                    min-width: 0;
                    padding-left: 2px;
                    padding-right: 2px;
                }

                .listalar-menu-gastos-texto {
                    font-size: 10px;
                }

                .listalar-gastos-grade-resumo {
                    grid-template-columns:
                        1fr;
                }

                .listalar-gastos-card-resumo:first-child {
                    grid-column: auto;
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ========================================================
    // TELA
    // ========================================================

    function criarTela() {
        if (
            document.getElementById(
                IDS.tela
            )
        ) {
            return;
        }

        const tela =
            document.createElement(
                "section"
            );

        tela.id = IDS.tela;
        tela.className =
            "listalar-gastos-tela";

        tela.setAttribute(
            "aria-hidden",
            "true"
        );

        tela.innerHTML = `
            <header
                class="listalar-gastos-cabecalho"
            >
                <div
                    class="listalar-gastos-cabecalho-titulo"
                >
                    <div
                        class="listalar-gastos-cabecalho-icone"
                    >
                        💰
                    </div>

                    <div>
                        <h1>Meus Gastos</h1>

                        <p>
                            Acompanhe as compras
                            da família
                        </p>
                    </div>
                </div>

                <button
                    id="${IDS.botaoFechar}"
                    class="listalar-gastos-fechar"
                    type="button"
                    aria-label="Fechar tela de gastos"
                    title="Fechar"
                >
                    ×
                </button>
            </header>

            <main
                class="listalar-gastos-conteudo"
            >
                <section
                    class="listalar-gastos-boas-vindas"
                >
                    <h2>
                        Controle suas compras
                    </h2>

                    <p>
                        Importe suas notas fiscais
                        para acompanhar valores,
                        produtos e supermercados.
                    </p>
                </section>

                <section
                    class="listalar-gastos-grade-resumo"
                >
                    <article
                        class="listalar-gastos-card-resumo"
                    >
                        <span>
                            Total importado
                        </span>

                        <strong
                            id="listalar-gastos-total-importado"
                        >
                            R$ 0,00
                        </strong>
                    </article>

                    <article
                        class="listalar-gastos-card-resumo"
                    >
                        <span>Produtos</span>

                        <strong
                            id="listalar-gastos-total-produtos"
                        >
                            0
                        </strong>
                    </article>

                    <article
                        class="listalar-gastos-card-resumo"
                    >
                        <span>Notas</span>

                        <strong
                            id="listalar-gastos-total-notas"
                        >
                            0
                        </strong>
                    </article>
                </section>

                <section
                    class="listalar-gastos-card"
                >
                    <div
                        class="listalar-gastos-card-topo"
                    >
                        <div>
                            <h2>
                                Importar compra
                            </h2>

                            <p>
                                Leia o QR Code da
                                NFC-e ou selecione
                                o PDF da nota para
                                conferir produtos
                                e valores.
                            </p>
                        </div>
                    </div>

                    <button
                        id="${IDS.botaoImportar}"
                        class="listalar-gastos-botao-principal"
                        type="button"
                    >
                        🧾 Importar compra
                    </button>
                </section>

                <section
                    id="${IDS.resumoImportacao}"
                    class="listalar-gastos-card listalar-gastos-resumo-importacao"
                ></section>

                <section
                    id="listalar-gastos-historico"
                    class="listalar-gastos-card"
                >
                    <div
                        class="listalar-gastos-card-topo"
                    >
                        <div>
                            <h2>
                                Histórico
                            </h2>

                            <p>
                                As notas salvas
                                aparecerão aqui.
                            </p>
                        </div>
                    </div>

                    <div
                        class="listalar-gastos-vazio"
                    >
                        <span
                            class="listalar-gastos-vazio-icone"
                        >
                            🧾
                        </span>

                        Nenhuma nota salva ainda.
                    </div>
                </section>
            </main>

            <div
                id="${IDS.aviso}"
                class="listalar-gastos-aviso info"
                role="status"
                hidden
            ></div>

            <div
                id="${IDS.modalDuplicidade}"
                class="listalar-gastos-modal"
                role="dialog"
                aria-modal="true"
                aria-hidden="true"
                aria-labelledby="listalar-gastos-modal-titulo"
            >
                <div
                    class="listalar-gastos-modal-conteudo"
                >
                    <div
                        class="listalar-gastos-modal-icone"
                        aria-hidden="true"
                    >
                        🧾
                    </div>

                    <h2
                        id="listalar-gastos-modal-titulo"
                    >
                        Como deseja importar?
                    </h2>

                    <p
                        class="listalar-gastos-modal-descricao"
                    >
                        O Controle de Preços
                        está ativo. Escolha como
                        esta nota fiscal deve
                        ser tratada.
                    </p>

                    <div
                        class="listalar-gastos-modal-opcoes"
                    >
                        <button
                            id="${IDS.modalSubstituir}"
                            class="listalar-gastos-modal-opcao destaque"
                            type="button"
                        >
                            Importar e substituir
                            compra manual
                        </button>

                        <button
                            id="${IDS.modalNovaCompra}"
                            class="listalar-gastos-modal-opcao"
                            type="button"
                        >
                            Importar como
                            nova compra
                        </button>
                    </div>

                    <button
                        id="${IDS.modalCancelar}"
                        class="listalar-gastos-modal-cancelar"
                        type="button"
                    >
                        Cancelar
                    </button>
                </div>
            </div>

            <div
                id="${IDS.modalOrigem}"
                class="listalar-gastos-modal"
                role="dialog"
                aria-modal="true"
                aria-hidden="true"
                aria-labelledby="listalar-gastos-modal-origem-titulo"
            >
                <div
                    class="listalar-gastos-modal-conteudo"
                >
                    <div
                        class="listalar-gastos-modal-icone"
                        aria-hidden="true"
                    >
                        🛒
                    </div>

                    <h2
                        id="listalar-gastos-modal-origem-titulo"
                    >
                        Como deseja importar?
                    </h2>

                    <p
                        class="listalar-gastos-modal-descricao"
                    >
                        Use a câmera para ler
                        o QR Code da NFC-e ou
                        selecione o PDF salvo
                        da nota fiscal.
                    </p>

                    <div
                        class="listalar-gastos-modal-opcoes"
                    >
                        <button
                            id="${IDS.modalOrigemQr}"
                            class="listalar-gastos-modal-opcao destaque"
                            type="button"
                        >
                            <span
                                class="listalar-gastos-modal-opcao-conteudo"
                            >
                                <span
                                    class="listalar-gastos-modal-opcao-icone"
                                    aria-hidden="true"
                                >
                                    📷
                                </span>

                                <span
                                    class="listalar-gastos-modal-opcao-textos"
                                >
                                    <strong>
                                        Ler QR Code
                                        da NFC-e
                                    </strong>

                                    <small>
                                        Opção mais
                                        rápida e
                                        automática
                                    </small>
                                </span>
                            </span>
                        </button>

                        <button
                            id="${IDS.modalOrigemPdf}"
                            class="listalar-gastos-modal-opcao"
                            type="button"
                        >
                            <span
                                class="listalar-gastos-modal-opcao-conteudo"
                            >
                                <span
                                    class="listalar-gastos-modal-opcao-icone"
                                    aria-hidden="true"
                                >
                                    📄
                                </span>

                                <span
                                    class="listalar-gastos-modal-opcao-textos"
                                >
                                    <strong>
                                        Selecionar PDF
                                    </strong>

                                    <small>
                                        Use o arquivo
                                        salvo pelo
                                        navegador
                                    </small>
                                </span>
                            </span>
                        </button>
                    </div>

                    <button
                        id="${IDS.modalOrigemCancelar}"
                        class="listalar-gastos-modal-cancelar"
                        type="button"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(
            tela
        );
    }

    // ========================================================
    // MENU
    // ========================================================

    function localizarContainerMenu() {
        const seletores = [
            "#bottom-nav",
            "#bottomNav",
            "#menu-inferior",
            "#menuInferior",
            ".bottom-nav",
            ".bottom-navigation",
            ".menu-inferior",
            ".menu-bottom",
            ".nav-bottom",
            ".mobile-nav",
            "[data-menu-principal]"
        ];

        for (
            const seletor of seletores
        ) {
            const elemento =
                document.querySelector(
                    seletor
                );

            if (elemento) {
                return elemento;
            }
        }

        return null;
    }

    function criarBotaoMenu() {
        if (
            document.getElementById(
                IDS.botaoMenu
            )
        ) {
            return;
        }

        const botao =
            document.createElement(
                "button"
            );

        botao.id = IDS.botaoMenu;
        botao.type = "button";
        botao.className =
            "listalar-menu-gastos";

        botao.setAttribute(
            "aria-label",
            "Abrir Gastos"
        );

        botao.title = "Gastos";

        botao.innerHTML = `
            <span
                class="listalar-menu-gastos-icone"
                aria-hidden="true"
            >
                💰
            </span>

            <span
                class="listalar-menu-gastos-texto"
            >
                Gastos
            </span>
        `;

        const menu =
            localizarContainerMenu();

        if (menu) {
            menu.appendChild(botao);
        } else {
            botao.classList.add(
                "listalar-menu-gastos-fixo"
            );

            document.body.appendChild(
                botao
            );

            console.warn(
                "⚠️ Módulo Gastos: menu principal não localizado. " +
                "Foi criado um botão provisório."
            );
        }
    }

    // ========================================================
    // ABERTURA E FECHAMENTO
    // ========================================================

    function abrirTela() {
        if (!moduloLiberado) {
            console.warn(
                "⚠️ Módulo Gastos não liberado para esta família."
            );

            return;
        }

        const tela =
            document.getElementById(
                IDS.tela
            );

        if (!tela) {
            criarTela();
        }

        const telaAtual =
            document.getElementById(
                IDS.tela
            );

        if (!telaAtual) {
            return;
        }

        telaAtual.classList.add(
            "aberta"
        );

        telaAtual.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "listalar-gastos-aberto"
        );

        telaAtual.scrollTo({
            top: 0,
            behavior: "instant"
        });
    }

    function fecharTela() {
        const tela =
            document.getElementById(
                IDS.tela
            );

        if (!tela) {
            return;
        }

        tela.classList.remove(
            "aberta"
        );

        tela.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "listalar-gastos-aberto"
        );
    }

    // ========================================================
    // IMPORTADOR DE NOTA FISCAL
    // ========================================================

    function fecharModalDuplicidade() {
        const modal =
            document.getElementById(
                IDS.modalDuplicidade
            );

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "aberto"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    function fecharModalOrigem() {
        const modal =
            document.getElementById(
                IDS.modalOrigem
            );

        if (!modal) {
            return;
        }

        modal.classList.remove(
            "aberto"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );
    }

    function finalizarEscolhaModoImportacao(
        modo
    ) {
        fecharModalDuplicidade();

        if (
            typeof resolverModoImportacao ===
            "function"
        ) {
            const resolver =
                resolverModoImportacao;

            resolverModoImportacao = null;

            resolver(modo);
        }
    }

    function finalizarEscolhaOrigemImportacao(
        origem
    ) {
        fecharModalOrigem();

        if (
            typeof resolverOrigemImportacao ===
            "function"
        ) {
            const resolver =
                resolverOrigemImportacao;

            resolverOrigemImportacao =
                null;

            resolver(origem);
        }
    }

    function escolherSubstituir() {
        finalizarEscolhaModoImportacao(
            "substituir_compra_manual"
        );
    }

    function escolherNovaCompra() {
        finalizarEscolhaModoImportacao(
            "nova_compra"
        );
    }

    function escolherCancelar() {
        finalizarEscolhaModoImportacao(
            null
        );
    }

    function escolherOrigemQrCode() {
        finalizarEscolhaOrigemImportacao(
            "qr_code"
        );
    }

    function escolherOrigemPdf() {
        finalizarEscolhaOrigemImportacao(
            "pdf"
        );
    }

    function escolherCancelarOrigem() {
        finalizarEscolhaOrigemImportacao(
            null
        );
    }

    function escolherModoImportacao() {
        const modal =
            document.getElementById(
                IDS.modalDuplicidade
            );

        if (!modal) {
            console.error(
                "❌ Modal de escolha da importação não foi encontrado."
            );

            return Promise.resolve(
                null
            );
        }

        if (
            typeof resolverModoImportacao ===
            "function"
        ) {
            resolverModoImportacao(
                null
            );

            resolverModoImportacao =
                null;
        }

        modal.classList.add(
            "aberto"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        window.setTimeout(() => {
            document
                .getElementById(
                    IDS.modalSubstituir
                )
                ?.focus();
        }, 0);

        return new Promise(
            (resolve) => {
                resolverModoImportacao =
                    resolve;
            }
        );
    }

    function escolherOrigemImportacao() {
        const modal =
            document.getElementById(
                IDS.modalOrigem
            );

        if (!modal) {
            console.error(
                "❌ Modal de origem da importação não foi encontrado."
            );

            return Promise.resolve(
                null
            );
        }

        if (
            typeof resolverOrigemImportacao ===
            "function"
        ) {
            resolverOrigemImportacao(
                null
            );

            resolverOrigemImportacao =
                null;
        }

        modal.classList.add(
            "aberto"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

        window.setTimeout(() => {
            document
                .getElementById(
                    IDS.modalOrigemQr
                )
                ?.focus();
        }, 0);

        return new Promise(
            (resolve) => {
                resolverOrigemImportacao =
                    resolve;
            }
        );
    }

    async function solicitarImportacaoNota() {
        if (!moduloLiberado) {
            console.warn(
                "⚠️ Importação bloqueada: módulo Gastos não liberado."
            );

            return;
        }

        modoImportacaoAtual = null;

        if (
            !controlePrecosEstaAtivo()
        ) {
            modoImportacaoAtual =
                "nota_fiscal";
        } else {
            const escolha =
                await escolherModoImportacao();

            if (!escolha) {
                return;
            }

            modoImportacaoAtual =
                escolha;
        }

        const origem =
            await escolherOrigemImportacao();

        if (!origem) {
            return;
        }

        if (
            origem === "qr_code"
        ) {
            abrirImportadorQrCode();
            return;
        }

        abrirImportadorPdf();
    }

    function obterImportadorQrCode() {
        return (
            window
                .ListaLarImportadorNfce ||
            window.ImportadorNFCe ||
            window.ImportadorNfceQR ||
            null
        );
    }

    function abrirImportadorQrCode() {
        const importador =
            obterImportadorQrCode();

        if (
            !importador ||
            typeof importador.abrir !==
                "function"
        ) {
            mostrarAviso(
                "O leitor de QR Code da NFC-e ainda não está disponível.",
                "erro"
            );

            console.error(
                "❌ ListaLarImportadorNfce.abrir() não foi encontrado."
            );

            return;
        }

        try {
            importador.abrir({
                familiaId:
                    familiaIdAtual,

                modoImportacao:
                    modoImportacaoAtual
            });
        } catch (erro) {
            console.error(
                "❌ Erro ao abrir o leitor de QR Code da NFC-e:",
                erro
            );

            mostrarAviso(
                "Não foi possível abrir a câmera para ler a nota.",
                "erro"
            );
        }
    }

    function abrirImportadorPdf() {
        const importador =
            window
                .ListaLarConferenciaNota ||
            window.ImportadorNotaPDF;

        if (
            !importador ||
            typeof importador.abrir !==
                "function"
        ) {
            mostrarAviso(
                "O importador de PDF ainda não está disponível.",
                "erro"
            );

            console.error(
                "❌ ImportadorNotaPDF.abrir() não foi encontrado."
            );

            return;
        }

        try {
            importador.abrir();
        } catch (erro) {
            console.error(
                "❌ Erro ao abrir o importador de PDF:",
                erro
            );

            mostrarAviso(
                "Não foi possível abrir o importador da nota.",
                "erro"
            );
        }
    }

    /*
     * Compatibilidade com chamadas
     * antigas da API pública.
     */
    function abrirImportadorNota() {
        abrirImportadorPdf();
    }

    // ========================================================
    // LEITURA E NORMALIZAÇÃO DA NOTA
    // ========================================================

    function obterProdutosDaNota(
        nota
    ) {
        if (
            !nota ||
            typeof nota !== "object"
        ) {
            return [];
        }

        const possibilidades = [
            nota.produtos,
            nota.itens,
            nota.items,
            nota.dados?.produtos,
            nota.dados?.itens,
            nota.nota?.produtos,
            nota.nota?.itens
        ];

        for (
            const lista of possibilidades
        ) {
            if (Array.isArray(lista)) {
                return lista;
            }
        }

        return [];
    }

    function obterValorTotal(
        nota,
        produtos
    ) {
        const possibilidades = [
            nota?.total,
            nota?.valorTotal,
            nota?.totalNota,
            nota?.valor_total,
            nota?.dados?.total,
            nota?.dados?.valorTotal,
            nota?.nota?.total,
            nota?.nota?.valorTotal
        ];

        for (
            const valor of possibilidades
        ) {
            const numero =
                Number(valor);

            if (
                Number.isFinite(numero)
            ) {
                return numero;
            }
        }

        return produtos.reduce(
            (soma, produto) => {
                const valoresProduto = [
                    produto?.precoTotal,
                    produto?.total,
                    produto?.valorTotal,
                    produto?.subtotal,
                    produto?.valor_total
                ];

                for (
                    const valor of
                    valoresProduto
                ) {
                    const numero =
                        Number(valor);

                    if (
                        Number.isFinite(
                            numero
                        )
                    ) {
                        return soma +
                            numero;
                    }
                }

                const quantidade =
                    Number(
                        produto
                            ?.quantidade ??
                        produto?.qtd ??
                        produto?.qtde ??
                        1
                    );

                const unitario =
                    Number(
                        produto
                            ?.valorUnitario ??
                        produto
                            ?.precoUnitario ??
                        produto?.preco ??
                        produto?.valor ??
                        0
                    );

                if (
                    Number.isFinite(
                        quantidade
                    ) &&
                    Number.isFinite(
                        unitario
                    )
                ) {
                    return soma +
                        quantidade *
                        unitario;
                }

                return soma;
            },
            0
        );
    }

    function obterNomeEstabelecimento(
        nota
    ) {
        const emitente =
            nota?.emitente;

        return (
            nota?.mercadoNome ||
            nota?.estabelecimento ||
            nota?.supermercado ||
            emitente?.nome ||
            emitente?.razaoSocial ||
            (
                typeof emitente ===
                "string"
                    ? emitente
                    : ""
            ) ||
            nota?.razaoSocial ||
            nota?.nomeEmpresa ||
            nota?.dados?.mercadoNome ||
            nota?.dados
                ?.estabelecimento ||
            nota?.dados
                ?.emitente?.nome ||
            nota?.dados
                ?.emitente
                ?.razaoSocial ||
            nota?.nota?.mercadoNome ||
            nota?.nota
                ?.estabelecimento ||
            nota?.nota
                ?.emitente?.nome ||
            nota?.nota
                ?.emitente
                ?.razaoSocial ||
            "Estabelecimento não identificado"
        );
    }

    function obterDataNota(nota) {
        const valor =
            nota?.dataCompra ||
            nota?.data ||
            nota?.dataEmissao ||
            nota?.emissao ||
            nota?.dados?.dataCompra ||
            nota?.dados?.data ||
            nota?.dados?.dataEmissao ||
            nota?.nota?.dataCompra ||
            nota?.nota?.data ||
            nota?.nota?.dataEmissao;

        if (!valor) {
            return "Data não identificada";
        }

        const data =
            new Date(valor);

        if (
            !Number.isNaN(
                data.getTime()
            )
        ) {
            return data
                .toLocaleDateString(
                    "pt-BR"
                );
        }

        return String(valor);
    }

    function obterNomeProduto(
        produto,
        indice
    ) {
        return (
            produto?.produtoNome ||
            produto
                ?.descricaoOriginal ||
            produto?.nome ||
            produto?.descricao ||
            produto?.produto ||
            produto?.item ||
            `Produto ${indice + 1}`
        );
    }

    function obterQuantidadeProduto(
        produto
    ) {
        return (
            produto?.quantidade ??
            produto?.qtd ??
            produto?.qtde ??
            1
        );
    }

    function obterUnidadeProduto(
        produto
    ) {
        return (
            produto?.unidade ||
            produto?.un ||
            produto?.tipoUnidade ||
            ""
        );
    }

    function obterTotalProduto(
        produto
    ) {
        const valoresTotais = [
            produto?.precoTotal,
            produto?.total,
            produto?.valorTotal,
            produto?.subtotal,
            produto?.valor_total
        ];

        for (
            const valor of valoresTotais
        ) {
            const numero =
                Number(valor);

            if (
                Number.isFinite(numero)
            ) {
                return numero;
            }
        }

        const quantidade =
            Number(
                obterQuantidadeProduto(
                    produto
                )
            );

        const unitario =
            Number(
                produto
                    ?.valorUnitario ??
                produto
                    ?.precoUnitario ??
                produto?.preco ??
                produto?.valor ??
                0
            );

        if (
            Number.isFinite(
                quantidade
            ) &&
            Number.isFinite(
                unitario
            )
        ) {
            return quantidade *
                unitario;
        }

        return 0;
    }

    function atualizarResumoSuperior(
        total,
        totalProdutos
    ) {
        const elementoTotal =
            document.getElementById(
                "listalar-gastos-total-importado"
            );

        const elementoProdutos =
            document.getElementById(
                "listalar-gastos-total-produtos"
            );

        const elementoNotas =
            document.getElementById(
                "listalar-gastos-total-notas"
            );

        if (elementoTotal) {
            elementoTotal.textContent =
                formatarMoeda(total);
        }

        if (elementoProdutos) {
            elementoProdutos.textContent =
                String(totalProdutos);
        }

        if (elementoNotas) {
            elementoNotas.textContent =
                "1";
        }
    }

    function exibirNotaImportada(
        nota
    ) {
        const resumo =
            document.getElementById(
                IDS.resumoImportacao
            );

        if (!resumo) {
            return;
        }

        const produtos =
            obterProdutosDaNota(
                nota
            );

        const total =
            obterValorTotal(
                nota,
                produtos
            );

        const estabelecimento =
            obterNomeEstabelecimento(
                nota
            );

        const dataNota =
            obterDataNota(nota);

        atualizarResumoSuperior(
            total,
            produtos.length
        );

        const limiteExibicao = 50;

        const produtosHTML =
            produtos
                .slice(
                    0,
                    limiteExibicao
                )
                .map(
                    (
                        produto,
                        indice
                    ) => {
                        const nome =
                            obterNomeProduto(
                                produto,
                                indice
                            );

                        const quantidade =
                            obterQuantidadeProduto(
                                produto
                            );

                        const unidade =
                            obterUnidadeProduto(
                                produto
                            );

                        const totalProduto =
                            obterTotalProduto(
                                produto
                            );

                        return `
                            <div
                                class="listalar-gastos-produto"
                            >
                                <div>
                                    <strong>
                                        ${escaparHTML(
                                            nome
                                        )}
                                    </strong>

                                    <small>
                                        ${formatarQuantidade(
                                            quantidade
                                        )}

                                        ${escaparHTML(
                                            unidade
                                        )}
                                    </small>
                                </div>

                                <div
                                    class="listalar-gastos-produto-valor"
                                >
                                    ${formatarMoeda(
                                        totalProduto
                                    )}
                                </div>
                            </div>
                        `;
                    }
                )
                .join("");

        const mensagemLimite =
            produtos.length >
            limiteExibicao
                ? `
                    <div
                        class="listalar-gastos-vazio"
                    >
                        Mais ${
                            produtos.length -
                            limiteExibicao
                        }
                        produtos foram
                        identificados na nota.
                    </div>
                `
                : "";

        let mensagemPreparacao =
            "Confira os dados antes da futura gravação no histórico.";

        if (
            modoImportacaoAtual ===
            "substituir_compra_manual"
        ) {
            mensagemPreparacao =
                "Esta nota será preparada para substituir a compra manual correspondente.";
        } else if (
            modoImportacaoAtual ===
            "nova_compra"
        ) {
            mensagemPreparacao =
                "Esta nota será tratada como uma nova compra independente.";
        }

        resumo.innerHTML = `
            <div
                class="listalar-gastos-card-topo"
            >
                <div>
                    <h2>
                        Nota importada
                    </h2>

                    <p>
                        ${escaparHTML(
                            mensagemPreparacao
                        )}
                    </p>
                </div>
            </div>

            <div
                class="listalar-gastos-nota-cabecalho"
            >
                <div>
                    <h3>
                        ${escaparHTML(
                            estabelecimento
                        )}
                    </h3>

                    <p>
                        ${escaparHTML(
                            dataNota
                        )}

                        · ${produtos.length}

                        ${
                            produtos.length ===
                            1
                                ? "produto"
                                : "produtos"
                        }
                    </p>
                </div>

                <div
                    class="listalar-gastos-nota-total"
                >
                    ${formatarMoeda(
                        total
                    )}
                </div>
            </div>

            <div
                class="listalar-gastos-produtos"
            >
                ${
                    produtosHTML ||
                    `
                        <div
                            class="listalar-gastos-vazio"
                        >
                            Nenhum produto foi
                            identificado na nota.
                        </div>
                    `
                }

                ${mensagemLimite}
            </div>
        `;

        resumo.classList.add(
            "visivel"
        );

        mostrarAviso(
            "Nota fiscal importada com sucesso.",
            "sucesso"
        );
    }

    function extrairNotaDoEvento(
        evento
    ) {
        const detalhe =
            evento?.detail;

        return (
            detalhe?.data?.nota ||
            detalhe?.data?.dados ||
            detalhe?.data ||
            detalhe?.nota ||
            detalhe?.dados ||
            detalhe
        );
    }

    function notaJaRecebida(nota) {
        const agora = Date.now();

        if (
            nota ===
                ultimaNotaRecebidaReferencia &&
            agora -
                ultimaNotaRecebidaEm <
                1500
        ) {
            return true;
        }

        ultimaNotaRecebidaReferencia =
            nota;

        ultimaNotaRecebidaEm =
            agora;

        return false;
    }

    function receberNotaImportada(
        evento
    ) {
        if (!moduloLiberado) {
            console.warn(
                "⚠️ Nota ignorada: módulo Gastos não liberado."
            );

            return;
        }

        const nota =
            extrairNotaDoEvento(
                evento
            );

        if (
            !nota ||
            typeof nota !== "object"
        ) {
            console.warn(
                "⚠️ O evento da nota não trouxe dados válidos:",
                evento
            );

            mostrarAviso(
                "A nota foi lida, mas os dados não foram encontrados.",
                "erro"
            );

            return;
        }

        if (
            notaJaRecebida(nota)
        ) {
            console.log(
                "ℹ️ Evento duplicado da mesma nota ignorado."
            );

            return;
        }

        ultimaNotaImportada =
            nota;

        abrirTela();

        exibirNotaImportada(
            nota
        );

        window.dispatchEvent(
            new CustomEvent(
                "listalar:gastos-nota-preparada",
                {
                    detail: {
                        nota,

                        modoImportacao:
                            modoImportacaoAtual,

                        familiaId:
                            familiaIdAtual
                    }
                }
            )
        );

        console.log(
            "✅ Nota recebida e preparada pelo módulo Gastos:",
            {
                nota,

                modoImportacao:
                    modoImportacaoAtual,

                familiaId:
                    familiaIdAtual,

                eventoOrigem:
                    evento?.type || ""
            }
        );
    }

    // ========================================================
    // EVENTOS
    // ========================================================

    function configurarEventos() {
        const botaoMenu =
            document.getElementById(
                IDS.botaoMenu
            );

        const botaoFechar =
            document.getElementById(
                IDS.botaoFechar
            );

        const botaoImportar =
            document.getElementById(
                IDS.botaoImportar
            );

        const tela =
            document.getElementById(
                IDS.tela
            );

        const modalDuplicidade =
            document.getElementById(
                IDS.modalDuplicidade
            );

        const modalCancelar =
            document.getElementById(
                IDS.modalCancelar
            );

        const modalSubstituir =
            document.getElementById(
                IDS.modalSubstituir
            );

        const modalNovaCompra =
            document.getElementById(
                IDS.modalNovaCompra
            );

        const modalOrigem =
            document.getElementById(
                IDS.modalOrigem
            );

        const modalOrigemQr =
            document.getElementById(
                IDS.modalOrigemQr
            );

        const modalOrigemPdf =
            document.getElementById(
                IDS.modalOrigemPdf
            );

        const modalOrigemCancelar =
            document.getElementById(
                IDS.modalOrigemCancelar
            );

        if (botaoMenu) {
            botaoMenu.addEventListener(
                "click",
                abrirTela
            );
        }

        if (botaoFechar) {
            botaoFechar.addEventListener(
                "click",
                fecharTela
            );
        }

        if (botaoImportar) {
            botaoImportar
                .addEventListener(
                    "click",
                    solicitarImportacaoNota
                );
        }

        if (modalSubstituir) {
            modalSubstituir
                .addEventListener(
                    "click",
                    escolherSubstituir
                );
        }

        if (modalNovaCompra) {
            modalNovaCompra
                .addEventListener(
                    "click",
                    escolherNovaCompra
                );
        }

        if (modalCancelar) {
            modalCancelar
                .addEventListener(
                    "click",
                    escolherCancelar
                );
        }

        if (modalOrigemQr) {
            modalOrigemQr
                .addEventListener(
                    "click",
                    escolherOrigemQrCode
                );
        }

        if (modalOrigemPdf) {
            modalOrigemPdf
                .addEventListener(
                    "click",
                    escolherOrigemPdf
                );
        }

        if (modalOrigemCancelar) {
            modalOrigemCancelar
                .addEventListener(
                    "click",
                    escolherCancelarOrigem
                );
        }

        if (modalDuplicidade) {
            modalDuplicidade
                .addEventListener(
                    "click",
                    (evento) => {
                        if (
                            evento.target ===
                            modalDuplicidade
                        ) {
                            escolherCancelar();
                        }
                    }
                );
        }

        if (modalOrigem) {
            modalOrigem
                .addEventListener(
                    "click",
                    (evento) => {
                        if (
                            evento.target ===
                            modalOrigem
                        ) {
                            escolherCancelarOrigem();
                        }
                    }
                );
        }

        if (tela) {
            tela.addEventListener(
                "click",
                (evento) => {
                    /*
                     * Não fecha ao clicar
                     * dentro da tela.
                     *
                     * O fechamento ocorre
                     * somente no botão ×.
                     */
                    evento.stopPropagation();
                }
            );
        }

        document.addEventListener(
            "keydown",
            (evento) => {
                if (
                    evento.key !==
                    "Escape"
                ) {
                    return;
                }

                const modalOrigemAberto =
                    document
                        .getElementById(
                            IDS.modalOrigem
                        )
                        ?.classList
                        .contains(
                            "aberto"
                        );

                if (
                    modalOrigemAberto
                ) {
                    escolherCancelarOrigem();
                    return;
                }

                const modalDuplicidadeAberto =
                    document
                        .getElementById(
                            IDS.modalDuplicidade
                        )
                        ?.classList
                        .contains(
                            "aberto"
                        );

                if (
                    modalDuplicidadeAberto
                ) {
                    escolherCancelar();
                    return;
                }

                fecharTela();
            }
        );

        window.addEventListener(
            "listalar:nota-importada",
            receberNotaImportada
        );

        /*
         * Compatibilidade com o
         * importador PDF anterior.
         */
        window.addEventListener(
            "listalar:nota-pdf-importada",
            receberNotaImportada
        );
    }

    // ========================================================
    // API PÚBLICA
    // ========================================================

    function obterUltimaNota() {
        return ultimaNotaImportada;
    }

    function obterModoImportacao() {
        return modoImportacaoAtual;
    }

    function obterFamiliaId() {
        return familiaIdAtual;
    }

    function estaLiberado() {
        return moduloLiberado;
    }

    window.ListaLarGastos = {
        versao:
            VERSAO,

        abrir:
            abrirTela,

        fechar:
            fecharTela,

        importarCompra:
            solicitarImportacaoNota,

        /*
         * Nome antigo mantido para
         * compatibilidade.
         */
        importarNF:
            solicitarImportacaoNota,

        abrirImportadorPdf,

        abrirImportadorQrCode,

        abrirImportadorNota,

        obterUltimaNota,

        obterModoImportacao,

        obterFamiliaId,

        estaLiberado
    };

    // ========================================================
    // INICIALIZAÇÃO
    // ========================================================

    function iniciar() {
        criarEstilos();

        iniciarControleAcessoGastos();

        console.log(
            `✅ Módulo Gastos carregado — versão ${VERSAO}`
        );
    }

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            iniciar,
            {
                once: true
            }
        );
    } else {
        iniciar();
    }
})();
