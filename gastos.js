// ============================================================
// LISTALAR — MÓDULO GASTOS
// Arquivo: gastos.js
// Versão: 2.4.0
//
// Funções:
// - Painel de gastos da família;
// - Importação exclusiva por PDF (sem QR Code);
// - Gravação permanente de notas fiscais no Firestore;
// - Gravação de compras manuais usando o Controle de Preços;
// - Itens salvos em subcoleção;
// - Indicadores, gráficos simples e histórico;
// - Não altera o cadastro principal de produtos.
// ============================================================

(() => {
    "use strict";

    const VERSAO = "2.4.1";
    const ADMIN_COMO_PILOTO_SEM_CONFIG = true;
    const LIMITE_HISTORICO = 120;

    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyC2U7q5HupxKyI3QiAyan-2Sio55NSir0Y",
        authDomain: "compras-da-casa.firebaseapp.com",
        projectId: "compras-da-casa",
        storageBucket: "compras-da-casa.firebasestorage.app",
        messagingSenderId: "63765433273",
        appId: "1:63765433273:web:c478a3dd33ef3cd55a0468"
    };

    const IDS = Object.freeze({
        estilo: "listalar-gastos-estilo",
        botaoMenu: "listalar-menu-gastos",
        tela: "listalar-tela-gastos",
        botaoFechar: "listalar-gastos-fechar",
        botaoImportarPdf: "listalar-gastos-importar-pdf",
        seletorPeriodo: "listalar-gastos-periodo",
        aviso: "listalar-gastos-aviso",
        carregando: "listalar-gastos-carregando",

        totalPeriodo: "listalar-gastos-total-periodo",
        totalCompras: "listalar-gastos-total-compras",
        totalNotas: "listalar-gastos-total-notas",
        totalManuais: "listalar-gastos-total-manuais",
        ticketMedio: "listalar-gastos-ticket-medio",

        graficoMensal: "listalar-gastos-grafico-mensal",
        graficoOrigem: "listalar-gastos-grafico-origem",
        historico: "listalar-gastos-historico",

        modalManual: "listalar-gastos-modal-manual",
        manualEstabelecimento: "listalar-gastos-manual-estabelecimento",
        manualData: "listalar-gastos-manual-data",
        manualResumo: "listalar-gastos-manual-resumo",
        manualConfirmar: "listalar-gastos-manual-confirmar",
        manualCancelar: "listalar-gastos-manual-cancelar",
        modalEditar: "listalar-gastos-modal-editar",
        editarEstabelecimento: "listalar-gastos-editar-estabelecimento",
        editarData: "listalar-gastos-editar-data",
        editarResumo: "listalar-gastos-editar-resumo",
        editarConfirmar: "listalar-gastos-editar-confirmar",
        editarCancelar: "listalar-gastos-editar-cancelar",

        modalDetalhes: "listalar-gastos-modal-detalhes",
        detalhesTitulo: "listalar-gastos-detalhes-titulo",
        detalhesResumo: "listalar-gastos-detalhes-resumo",
        detalhesItens: "listalar-gastos-detalhes-itens",
        detalhesFechar: "listalar-gastos-detalhes-fechar"
    });

    const ESTADO = {
        firebase: null,
        usuario: null,
        familiaId: "",
        liberado: false,
        interfaceInicializada: false,
        unsubscribeGastos: null,
        registros: [],
        periodo: "mes_atual",
        salvando: false,
        ultimaNotaReferencia: null,
        ultimaNotaRecebidaEm: 0,
        resolverCompraManual: null,
        contextoCompraManual: null,
        registroEmEdicao: null,
        registroEmDetalhes: null,
        carregandoDetalhes: false,
        excluindoRegistro: false
    };

    // ========================================================
    // UTILITÁRIOS
    // ========================================================

    function elemento(id) {
        return document.getElementById(id);
    }

    function escaparHTML(valor) {
        return String(valor ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function numeroSeguro(valor, padrao = 0) {
        if (
            valor === null ||
            valor === undefined ||
            valor === ""
        ) {
            return padrao;
        }

        if (typeof valor === "number") {
            return Number.isFinite(valor)
                ? valor
                : padrao;
        }

        let texto = String(valor)
            .trim()
            .replace(/\s/g, "")
            .replace(/^R\$/i, "");

        if (
            texto.includes(",") &&
            texto.includes(".")
        ) {
            texto = texto
                .replace(/\./g, "")
                .replace(",", ".");
        } else {
            texto = texto.replace(",", ".");
        }

        const numero = Number(texto);

        return Number.isFinite(numero)
            ? numero
            : padrao;
    }

    function arredondarMoeda(valor) {
        return Math.round(
            (numeroSeguro(valor, 0) + Number.EPSILON) * 100
        ) / 100;
    }

    function formatarMoeda(valor) {
        return arredondarMoeda(valor).toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );
    }

    function formatarQuantidade(valor) {
        return numeroSeguro(valor, 0).toLocaleString(
            "pt-BR",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 3
            }
        );
    }

    function normalizarTexto(valor) {
        return String(valor ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .replace(/\s+/g, " ");
    }

    function somenteDigitos(valor) {
        return String(valor ?? "").replace(/\D/g, "");
    }

    function dataHojeISO() {
        const agora = new Date();
        const ano = agora.getFullYear();
        const mes = String(agora.getMonth() + 1).padStart(2, "0");
        const dia = String(agora.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    }

    function converterParaData(valor) {
        if (!valor) {
            return new Date();
        }

        if (
            valor &&
            typeof valor.toDate === "function"
        ) {
            return valor.toDate();
        }

        if (typeof valor === "number") {
            const dataNumero = new Date(valor);
            return Number.isNaN(dataNumero.getTime())
                ? new Date()
                : dataNumero;
        }

        const texto = String(valor).trim();

        const brasileiro = texto.match(
            /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/
        );

        if (brasileiro) {
            return new Date(
                Number(brasileiro[3]),
                Number(brasileiro[2]) - 1,
                Number(brasileiro[1]),
                Number(brasileiro[4] || 12),
                Number(brasileiro[5] || 0)
            );
        }

        const isoSomenteData = texto.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

        if (isoSomenteData) {
            return new Date(
                Number(isoSomenteData[1]),
                Number(isoSomenteData[2]) - 1,
                Number(isoSomenteData[3]),
                12,
                0
            );
        }

        const data = new Date(texto);

        return Number.isNaN(data.getTime())
            ? new Date()
            : data;
    }

    function dataParaISO(data) {
        const valor = converterParaData(data);
        const ano = valor.getFullYear();
        const mes = String(valor.getMonth() + 1).padStart(2, "0");
        const dia = String(valor.getDate()).padStart(2, "0");
        return `${ano}-${mes}-${dia}`;
    }

    function competenciaDaData(data) {
        return dataParaISO(data).slice(0, 7);
    }

    function formatarData(valor) {
        return converterParaData(valor).toLocaleDateString("pt-BR");
    }

    function hashTexto(valor) {
        let hash = 2166136261;
        const texto = String(valor);

        for (let indice = 0; indice < texto.length; indice += 1) {
            hash ^= texto.charCodeAt(indice);
            hash = Math.imul(hash, 16777619);
        }

        return (hash >>> 0).toString(36);
    }

    function mostrarAviso(mensagem, tipo = "info") {
        const aviso = elemento(IDS.aviso);

        if (!aviso) {
            return;
        }

        aviso.textContent = mensagem;
        aviso.className = `listalar-gastos-aviso ${tipo}`;
        aviso.hidden = false;

        window.clearTimeout(mostrarAviso.timeout);

        mostrarAviso.timeout = window.setTimeout(
            () => {
                aviso.hidden = true;
            },
            4500
        );
    }

    function definirCarregando(ativo, texto = "Carregando...") {
        const carregando = elemento(IDS.carregando);

        if (!carregando) {
            return;
        }

        carregando.textContent = texto;
        carregando.hidden = !ativo;
    }

    // ========================================================
    // FIREBASE E ACESSO
    // ========================================================

    async function carregarFirebase() {
        if (ESTADO.firebase) {
            return ESTADO.firebase;
        }

        const [
            moduloApp,
            moduloAuth,
            moduloFirestore
        ] = await Promise.all([
            import(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
            ),
            import(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"
            ),
            import(
                "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
            )
        ]);

        const app = moduloApp.getApps().length
            ? moduloApp.getApp()
            : moduloApp.initializeApp(FIREBASE_CONFIG);

        ESTADO.firebase = {
            auth: moduloAuth.getAuth(app),
            db: moduloFirestore.getFirestore(app),

            onAuthStateChanged:
                moduloAuth.onAuthStateChanged,

            doc: moduloFirestore.doc,
            getDoc: moduloFirestore.getDoc,
            setDoc: moduloFirestore.setDoc,
            deleteDoc: moduloFirestore.deleteDoc,
            collection: moduloFirestore.collection,
            query: moduloFirestore.query,
            orderBy: moduloFirestore.orderBy,
            limit: moduloFirestore.limit,
            onSnapshot: moduloFirestore.onSnapshot,
            getDocs: moduloFirestore.getDocs,
            writeBatch: moduloFirestore.writeBatch,
            serverTimestamp:
                moduloFirestore.serverTimestamp
        };

        return ESTADO.firebase;
    }

    function referenciaFamilia() {
        if (
            !ESTADO.firebase ||
            !ESTADO.familiaId
        ) {
            return null;
        }

        return ESTADO.firebase.doc(
            ESTADO.firebase.db,
            "familias",
            ESTADO.familiaId
        );
    }

    function colecaoGastos() {
        const familia = referenciaFamilia();

        if (!familia) {
            return null;
        }

        return ESTADO.firebase.collection(
            familia,
            "gastos"
        );
    }

    function definirVisibilidade(liberado) {
        ESTADO.liberado = liberado === true;

        const botao = elemento(IDS.botaoMenu);

        if (!ESTADO.liberado) {
            if (botao) {
                botao.hidden = true;
            }

            fecharTela();
            pararHistorico();
            return;
        }

        if (!ESTADO.interfaceInicializada) {
            criarTela();
            criarBotaoMenu();
            configurarEventos();
            ESTADO.interfaceInicializada = true;
        } else if (botao) {
            botao.hidden = false;
        }

        iniciarHistorico();
    }

    async function carregarContexto(usuario) {
        const firebase = await carregarFirebase();

        const usuarioSnapshot = await firebase.getDoc(
            firebase.doc(
                firebase.db,
                "usuarios",
                usuario.uid
            )
        );

        if (!usuarioSnapshot.exists()) {
            ESTADO.usuario = null;
            ESTADO.familiaId = "";
            definirVisibilidade(false);
            return;
        }

        const dadosUsuario = usuarioSnapshot.data();
        const familiaId = String(
            dadosUsuario.familiaId || ""
        ).trim();

        if (!familiaId) {
            ESTADO.usuario = null;
            ESTADO.familiaId = "";
            definirVisibilidade(false);
            return;
        }

        const modulosSnapshot = await firebase.getDoc(
            firebase.doc(
                firebase.db,
                "configuracoes",
                "modulos"
            )
        );

        const modulos = modulosSnapshot.exists()
            ? modulosSnapshot.data()
            : {};

        ESTADO.usuario = usuario;
        ESTADO.familiaId = familiaId;

        const liberado =
            modulos.gastosLiberados === true ||
            modulos.familiaPilotoId === familiaId ||
            (
                ADMIN_COMO_PILOTO_SEM_CONFIG &&
                !modulosSnapshot.exists() &&
                dadosUsuario.adminSistema === true
            );

        definirVisibilidade(liberado);

        window.dispatchEvent(
            new CustomEvent(
                "listalar:gastos-pronto",
                {
                    detail: {
                        familiaId,
                        liberado
                    }
                }
            )
        );
    }

    async function iniciarControleAcesso() {
        try {
            const firebase = await carregarFirebase();

            firebase.onAuthStateChanged(
                firebase.auth,
                async (usuario) => {
                    if (!usuario) {
                        ESTADO.usuario = null;
                        ESTADO.familiaId = "";
                        definirVisibilidade(false);
                        return;
                    }

                    try {
                        await carregarContexto(usuario);
                    } catch (erro) {
                        console.error(
                            "ListaLar Gastos: erro ao carregar contexto:",
                            erro
                        );

                        ESTADO.usuario = null;
                        ESTADO.familiaId = "";
                        definirVisibilidade(false);
                    }
                }
            );
        } catch (erro) {
            console.error(
                "ListaLar Gastos: Firebase indisponível:",
                erro
            );
        }
    }

    // ========================================================
    // ESTILOS
    // ========================================================

    function criarEstilos() {
        if (elemento(IDS.estilo)) {
            return;
        }

        const style = document.createElement("style");
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

            #bottom-nav:has(#listalar-menu-gastos),
            #bottomNav:has(#listalar-menu-gastos),
            #menu-inferior:has(#listalar-menu-gastos),
            #menuInferior:has(#listalar-menu-gastos),
            .bottom-nav:has(#listalar-menu-gastos),
            .bottom-navigation:has(#listalar-menu-gastos),
            .menu-inferior:has(#listalar-menu-gastos),
            .menu-bottom:has(#listalar-menu-gastos),
            .nav-bottom:has(#listalar-menu-gastos),
            .mobile-nav:has(#listalar-menu-gastos),
            [data-menu-principal]:has(#listalar-menu-gastos) {
                width: 100% !important;
                display: flex !important;
                flex-wrap: nowrap !important;
                align-items: stretch !important;
                gap: 4px !important;
            }

            #bottom-nav:has(#listalar-menu-gastos) > *,
            #bottomNav:has(#listalar-menu-gastos) > *,
            #menu-inferior:has(#listalar-menu-gastos) > *,
            #menuInferior:has(#listalar-menu-gastos) > *,
            .bottom-nav:has(#listalar-menu-gastos) > *,
            .bottom-navigation:has(#listalar-menu-gastos) > *,
            .menu-inferior:has(#listalar-menu-gastos) > *,
            .menu-bottom:has(#listalar-menu-gastos) > *,
            .nav-bottom:has(#listalar-menu-gastos) > *,
            .mobile-nav:has(#listalar-menu-gastos) > *,
            [data-menu-principal]:has(#listalar-menu-gastos) > * {
                flex: 1 1 0 !important;
                width: auto !important;
                min-width: 0 !important;
                max-width: none !important;
                margin-left: 0 !important;
                margin-right: 0 !important;
            }

            #bottom-nav:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            #bottomNav:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            #menu-inferior:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            #menuInferior:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            .bottom-nav:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            .bottom-navigation:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            .menu-inferior:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            .menu-bottom:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            .nav-bottom:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            .mobile-nav:has(#listalar-menu-gastos)
            .listalar-menu-gastos,
            [data-menu-principal]:has(#listalar-menu-gastos)
            .listalar-menu-gastos {
                width: auto !important;
                min-width: 0 !important;
                min-height: 56px;
                padding: 6px 2px;
                flex-direction: column;
                gap: 2px;
            }

            .listalar-gastos-tela {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: none;
                background: #f4f7fb;
                color: #172033;
                overflow-y: auto;
                overscroll-behavior: contain;
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
                justify-content: space-between;
                gap: 14px;
                min-height: 68px;
                padding:
                    max(14px, env(safe-area-inset-top))
                    18px
                    14px;
                color: #ffffff;
                background:
                    linear-gradient(135deg, #1d4ed8, #2563eb);
                box-shadow:
                    0 4px 16px rgba(15, 23, 42, 0.18);
            }

            .listalar-gastos-cabecalho-titulo {
                display: flex;
                align-items: center;
                gap: 11px;
                min-width: 0;
            }

            .listalar-gastos-cabecalho-icone {
                display: grid;
                place-items: center;
                width: 42px;
                height: 42px;
                border-radius: 13px;
                font-size: 23px;
                background: rgba(255, 255, 255, 0.16);
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
                display: grid;
                place-items: center;
                width: 42px;
                height: 42px;
                border: 0;
                border-radius: 50%;
                color: #ffffff;
                background: rgba(255, 255, 255, 0.17);
                font-size: 25px;
                cursor: pointer;
            }

            .listalar-gastos-conteudo {
                width: min(100%, 960px);
                margin: 0 auto;
                padding: 16px 16px 110px;
                box-sizing: border-box;
            }

            .listalar-gastos-filtro {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 14px;
            }

            .listalar-gastos-filtro strong {
                font-size: 16px;
            }

            .listalar-gastos-select {
                min-height: 42px;
                padding: 8px 34px 8px 12px;
                border: 1px solid #dbe4f0;
                border-radius: 12px;
                background: #ffffff;
                color: #172033;
                font: inherit;
                font-size: 14px;
                font-weight: 700;
            }

            .listalar-gastos-grade-resumo {
                display: grid;
                grid-template-columns:
                    repeat(4, minmax(0, 1fr));
                gap: 11px;
                margin-bottom: 14px;
            }

            .listalar-gastos-card-resumo {
                min-height: 96px;
                padding: 14px;
                border: 1px solid #e3e9f2;
                border-radius: 16px;
                background: #ffffff;
                box-shadow:
                    0 5px 15px rgba(15, 23, 42, 0.05);
                box-sizing: border-box;
            }

            .listalar-gastos-card-resumo span {
                display: block;
                margin-bottom: 8px;
                color: #64748b;
                font-size: 11px;
                font-weight: 800;
            }

            .listalar-gastos-card-resumo strong {
                display: block;
                color: #172033;
                font-size: 19px;
                line-height: 1.2;
                overflow-wrap: anywhere;
            }

            .listalar-gastos-card-resumo.principal {
                color: #ffffff;
                border-color: transparent;
                background:
                    linear-gradient(135deg, #0f766e, #14b8a6);
            }

            .listalar-gastos-card-resumo.principal span,
            .listalar-gastos-card-resumo.principal strong {
                color: #ffffff;
            }

            .listalar-gastos-card-resumo.compras { border-color:#bfdbfe; background:linear-gradient(145deg,#eff6ff,#dbeafe); }
            .listalar-gastos-card-resumo.compras strong { color:#1d4ed8; }
            .listalar-gastos-card-resumo.notas { border-color:#ddd6fe; background:linear-gradient(145deg,#faf5ff,#ede9fe); }
            .listalar-gastos-card-resumo.notas strong { color:#6d28d9; }
            .listalar-gastos-card-resumo.manuais { border-color:#bbf7d0; background:linear-gradient(145deg,#f0fdf4,#dcfce7); }
            .listalar-gastos-card-resumo.manuais strong { color:#15803d; }
            .listalar-gastos-card-resumo.ticket { border-color:#fde68a; background:linear-gradient(145deg,#fffbeb,#fef3c7); }
            .listalar-gastos-card-resumo.ticket strong { color:#a16207; }

            .listalar-gastos-card {
                margin-bottom: 14px;
                padding: 17px;
                border: 1px solid #e3e9f2;
                border-radius: 18px;
                background: #ffffff;
                box-shadow:
                    0 5px 16px rgba(15, 23, 42, 0.05);
            }

            .listalar-gastos-card-topo {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 14px;
                margin-bottom: 14px;
            }

            .listalar-gastos-card-topo h2 {
                margin: 0 0 4px;
                font-size: 17px;
            }

            .listalar-gastos-card-topo p {
                margin: 0;
                color: #64748b;
                font-size: 12px;
                line-height: 1.4;
            }

            .listalar-gastos-acoes {
                display: grid;
                grid-template-columns:
                    repeat(2, minmax(0, 1fr));
                gap: 10px;
            }

            .listalar-gastos-botao {
                min-height: 52px;
                padding: 11px 13px;
                border: 0;
                border-radius: 14px;
                color: #ffffff;
                background: #2563eb;
                font: inherit;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
            }

            .listalar-gastos-botao.secundario {
                color: #166534;
                border: 1px solid #86efac;
                background: #dcfce7;
            }

            .listalar-gastos-botao:disabled {
                opacity: 0.55;
                cursor: wait;
            }

            .listalar-gastos-graficos {
                display: grid;
                grid-template-columns:
                    minmax(0, 1.45fr)
                    minmax(240px, 0.75fr);
                gap: 14px;
                margin-bottom: 14px;
            }

            .listalar-gastos-graficos .listalar-gastos-card {
                margin-bottom: 0;
            }

            .listalar-gastos-barras {
                display: grid;
                grid-template-columns:
                    repeat(6, minmax(42px, 1fr));
                gap: 9px;
                align-items: end;
                min-height: 190px;
                padding-top: 10px;
            }

            .listalar-gastos-barra-coluna {
                display: grid;
                grid-template-rows:
                    1fr auto auto;
                gap: 6px;
                min-width: 0;
                height: 180px;
                text-align: center;
            }

            .listalar-gastos-barra-area {
                display: flex;
                align-items: flex-end;
                justify-content: center;
                min-height: 112px;
            }

            .listalar-gastos-barra {
                width: min(34px, 75%);
                min-height: 4px;
                border-radius: 9px 9px 4px 4px;
                background:
                    linear-gradient(180deg, #2563eb, #60a5fa);
            }

            .listalar-gastos-barra-coluna strong {
                font-size: 10px;
                white-space: nowrap;
            }

            .listalar-gastos-barra-coluna small {
                color: #64748b;
                font-size: 10px;
            }

            .listalar-gastos-origem-linha {
                margin-bottom: 17px;
            }

            .listalar-gastos-origem-linha:last-child {
                margin-bottom: 0;
            }

            .listalar-gastos-origem-cabecalho {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                margin-bottom: 6px;
                font-size: 12px;
                font-weight: 800;
            }

            .listalar-gastos-origem-trilho {
                height: 12px;
                overflow: hidden;
                border-radius: 999px;
                background: #e2e8f0;
            }

            .listalar-gastos-origem-preenchimento {
                height: 100%;
                min-width: 0;
                border-radius: inherit;
                background: #2563eb;
            }

            .listalar-gastos-origem-preenchimento.manual {
                background: #16a34a;
            }

            .listalar-gastos-card-topo h2 { display:inline-flex; align-items:center; gap:8px; color:#172033; }
            .listalar-gastos-card-topo h2::before { content:""; width:7px; height:22px; border-radius:999px; background:linear-gradient(180deg,#2563eb,#06b6d4); box-shadow:0 3px 8px rgba(37,99,235,.25); }

            .listalar-gastos-historico-lista {
                display: grid;
                gap: 10px;
            }

            .listalar-gastos-registro {
                display: grid;
                grid-template-columns:
                    auto minmax(0, 1fr) auto;
                gap: 11px;
                align-items: center;
                padding: 12px;
                border: 1px solid #cfe0f5;
                border-left: 5px solid #7c3aed;
                border-radius: 14px;
                background: linear-gradient(135deg, #ffffff, #f5f3ff);
                box-shadow: 0 5px 14px rgba(15, 23, 42, .06);
            }

            .listalar-gastos-registro-icone {
                display: grid;
                place-items: center;
                width: 40px;
                height: 40px;
                border-radius: 12px;
                background: #dbeafe;
                font-size: 20px;
            }

            .listalar-gastos-registro.manual
            .listalar-gastos-registro-icone {
                background: #dcfce7;
            }

            .listalar-gastos-registro.manual { border-left-color:#16a34a; background:linear-gradient(135deg,#ffffff,#f0fdf4); }

            .listalar-gastos-registro-conteudo {
                min-width: 0;
            }

            .listalar-gastos-registro-conteudo strong {
                display: block;
                overflow: hidden;
                font-size: 14px;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .listalar-gastos-registro-conteudo small {
                display: block;
                margin-top: 4px;
                color: #64748b;
                font-size: 11px;
            }

            .listalar-gastos-registro-valor {
                font-size: 14px;
                font-weight: 900;
                white-space: nowrap;
            }

            .listalar-gastos-registro-lateral { display:grid; justify-items:end; gap:8px; }
            .listalar-gastos-registro-acoes { display:flex; gap:6px; }
            .listalar-gastos-registro-acao { width:34px; height:34px; display:grid; place-items:center; padding:0; border:0; border-radius:10px; cursor:pointer; font-size:16px; }
            .listalar-gastos-registro-acao.editar { color:#1d4ed8; background:#dbeafe; }
            .listalar-gastos-registro-acao.excluir { color:#b91c1c; background:#fee2e2; }
            .listalar-gastos-registro-acao:active { transform:scale(.94); }

            .listalar-gastos-registro {
                cursor: pointer;
                transition: transform .16s ease, box-shadow .16s ease;
            }

            .listalar-gastos-registro:active {
                transform: scale(.992);
            }

            .listalar-gastos-registro-dica {
                display: block;
                margin-top: 5px;
                color: #2563eb;
                font-size: 10px;
                font-weight: 800;
            }

            .listalar-gastos-detalhes-resumo {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 9px;
                margin: 12px 0 16px;
            }

            .listalar-gastos-detalhes-resumo-item {
                padding: 11px;
                border: 1px solid #dbeafe;
                border-radius: 13px;
                background: #eff6ff;
            }

            .listalar-gastos-detalhes-resumo-item span {
                display: block;
                margin-bottom: 4px;
                color: #64748b;
                font-size: 10px;
                font-weight: 800;
            }

            .listalar-gastos-detalhes-resumo-item strong {
                display: block;
                color: #172033;
                font-size: 13px;
                overflow-wrap: anywhere;
            }

            .listalar-gastos-detalhes-itens {
                display: grid;
                gap: 9px;
                max-height: 52vh;
                overflow-y: auto;
                padding-right: 2px;
            }

            .listalar-gastos-detalhe-item {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 8px 12px;
                padding: 12px;
                border: 1px solid #e2e8f0;
                border-radius: 13px;
                background: #f8fafc;
            }

            .listalar-gastos-detalhe-item-nome {
                min-width: 0;
                color: #172033;
                font-size: 13px;
                font-weight: 900;
                line-height: 1.3;
                overflow-wrap: anywhere;
            }

            .listalar-gastos-detalhe-item-total {
                color: #0f766e;
                font-size: 13px;
                font-weight: 900;
                white-space: nowrap;
            }

            .listalar-gastos-detalhe-item-info {
                grid-column: 1 / -1;
                color: #64748b;
                font-size: 11px;
                line-height: 1.4;
            }

            .listalar-gastos-detalhes-vazio {
                padding: 20px 12px;
                border: 1px dashed #cbd5e1;
                border-radius: 13px;
                color: #64748b;
                background: #f8fafc;
                text-align: center;
                font-size: 13px;
                font-weight: 700;
            }

            .listalar-gastos-vazio {
                padding: 22px 14px;
                border: 1px dashed #cbd5e1;
                border-radius: 14px;
                text-align: center;
                color: #64748b;
                background: #f8fafc;
                font-size: 13px;
            }

            .listalar-gastos-carregando {
                position: sticky;
                top: 74px;
                z-index: 4;
                margin-bottom: 10px;
                padding: 10px 13px;
                border-radius: 12px;
                color: #1e3a8a;
                background: #dbeafe;
                text-align: center;
                font-size: 13px;
                font-weight: 800;
            }

            .listalar-gastos-aviso {
                position: fixed;
                left: 50%;
                bottom:
                    max(22px, env(safe-area-inset-bottom));
                z-index: 13000;
                width: min(calc(100% - 32px), 480px);
                transform: translateX(-50%);
                padding: 13px 16px;
                border-radius: 13px;
                color: #ffffff;
                background: #334155;
                font-size: 14px;
                font-weight: 700;
                text-align: center;
                box-shadow:
                    0 10px 28px rgba(0, 0, 0, 0.24);
            }

            .listalar-gastos-aviso.sucesso {
                background: #15803d;
            }

            .listalar-gastos-aviso.erro {
                background: #b91c1c;
            }

            .listalar-gastos-modal {
                position: fixed;
                inset: 0;
                z-index: 12000;
                display: none;
                align-items: center;
                justify-content: center;
                padding:
                    max(18px, env(safe-area-inset-top))
                    16px
                    max(18px, env(safe-area-inset-bottom));
                background: rgba(15, 23, 42, 0.62);
                backdrop-filter: blur(3px);
            }

            .listalar-gastos-modal.aberto {
                display: flex;
            }

            .listalar-gastos-modal-conteudo {
                width: min(100%, 460px);
                max-height: calc(100vh - 36px);
                overflow-y: auto;
                padding: 21px;
                border-radius: 20px;
                background: #ffffff;
                box-shadow:
                    0 24px 60px rgba(15, 23, 42, 0.34);
            }

            .listalar-gastos-modal h2 {
                margin: 0 0 7px;
                font-size: 20px;
            }

            .listalar-gastos-modal p {
                margin: 0 0 16px;
                color: #64748b;
                font-size: 13px;
                line-height: 1.45;
            }

            .listalar-gastos-campo {
                display: grid;
                gap: 6px;
                margin-bottom: 12px;
            }

            .listalar-gastos-campo label {
                color: #475569;
                font-size: 12px;
                font-weight: 800;
            }

            .listalar-gastos-campo input {
                width: 100%;
                min-height: 46px;
                padding: 10px 12px;
                border: 1px solid #cbd5e1;
                border-radius: 12px;
                background: #ffffff;
                color: #172033;
                font: inherit;
                font-size: 16px;
                box-sizing: border-box;
            }

            .listalar-gastos-manual-resumo {
                margin: 13px 0;
                padding: 12px;
                border-radius: 13px;
                color: #166534;
                background: #dcfce7;
                font-size: 13px;
                font-weight: 800;
            }

            .listalar-gastos-modal-acoes {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 9px;
                margin-top: 15px;
            }

            .listalar-gastos-modal-acoes button {
                min-height: 47px;
                border: 0;
                border-radius: 13px;
                font: inherit;
                font-size: 14px;
                font-weight: 800;
                cursor: pointer;
            }

            .listalar-gastos-modal-cancelar {
                color: #475569;
                background: #e2e8f0;
            }

            .listalar-gastos-modal-confirmar {
                color: #ffffff;
                background: #16a34a;
            }

            @media (max-width: 720px) {
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
                    padding: 13px 11px 100px;
                }

                .listalar-gastos-grade-resumo {
                    grid-template-columns: 1fr 1fr;
                    gap: 9px;
                }

                .listalar-gastos-card-resumo {
                    min-height: 88px;
                    padding: 12px;
                }

                .listalar-gastos-card-resumo.principal {
                    grid-column: 1 / -1;
                }

                .listalar-gastos-graficos {
                    grid-template-columns: 1fr;
                }

                .listalar-gastos-acoes {
                    grid-template-columns: 1fr;
                }

                .listalar-gastos-barras {
                    gap: 5px;
                }

                .listalar-gastos-registro {
                    grid-template-columns:
                        auto minmax(0, 1fr);
                }

                .listalar-gastos-registro-valor {
                    grid-column: 2;
                }
            }

            @media (max-width: 390px) {
                .listalar-menu-gastos-texto {
                    max-width: 100%;
                    overflow: hidden;
                    font-size: 10px;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .listalar-gastos-card-resumo strong {
                    font-size: 17px;
                }

                .listalar-gastos-barras {
                    overflow-x: auto;
                    grid-template-columns:
                        repeat(6, minmax(48px, 1fr));
                }
            }
        `;

        document.head.appendChild(style);
    }

    // ========================================================
    // TELA E MENU
    // ========================================================

    function criarTela() {
        if (elemento(IDS.tela)) {
            return;
        }

        const tela = document.createElement("section");
        tela.id = IDS.tela;
        tela.className = "listalar-gastos-tela";
        tela.setAttribute("aria-hidden", "true");

        tela.innerHTML = `
            <header class="listalar-gastos-cabecalho">
                <div class="listalar-gastos-cabecalho-titulo">
                    <div
                        class="listalar-gastos-cabecalho-icone"
                        aria-hidden="true"
                    >
                        💰
                    </div>

                    <div>
                        <h1>Meus Gastos</h1>
                        <p>
                            Histórico e análise das compras da família
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

            <main class="listalar-gastos-conteudo">
                <div
                    id="${IDS.carregando}"
                    class="listalar-gastos-carregando"
                    hidden
                >
                    Carregando...
                </div>

                <section class="listalar-gastos-filtro">
                    <strong>Visão financeira</strong>

                    <select
                        id="${IDS.seletorPeriodo}"
                        class="listalar-gastos-select"
                        aria-label="Período do painel"
                    >
                        <option value="mes_atual">
                            Este mês
                        </option>
                        <option value="ultimos_3_meses">
                            Últimos 3 meses
                        </option>
                        <option value="ano_atual">
                            Este ano
                        </option>
                        <option value="todos">
                            Todo o histórico
                        </option>
                    </select>
                </section>

                <section class="listalar-gastos-grade-resumo">
                    <article
                        class="listalar-gastos-card-resumo principal"
                    >
                        <span>Total no período</span>
                        <strong id="${IDS.totalPeriodo}">
                            R$ 0,00
                        </strong>
                    </article>

                    <article class="listalar-gastos-card-resumo compras">
                        <span>🛒 Compras</span>
                        <strong id="${IDS.totalCompras}">
                            0
                        </strong>
                    </article>

                    <article class="listalar-gastos-card-resumo notas">
                        <span>🧾 Notas fiscais</span>
                        <strong id="${IDS.totalNotas}">
                            R$ 0,00
                        </strong>
                    </article>

                    <article class="listalar-gastos-card-resumo manuais">
                        <span>💵 Compras manuais</span>
                        <strong id="${IDS.totalManuais}">
                            R$ 0,00
                        </strong>
                    </article>

                    <article class="listalar-gastos-card-resumo ticket">
                        <span>📊 Ticket médio</span>
                        <strong id="${IDS.ticketMedio}">
                            R$ 0,00
                        </strong>
                    </article>
                </section>

                <section class="listalar-gastos-card">
                    <div class="listalar-gastos-card-topo">
                        <div>
                            <h2>Registrar compra</h2>
                            <p>
                                A nota fiscal e a compra manual são
                                armazenadas separadamente.
                            </p>
                        </div>
                    </div>

                    <div class="listalar-gastos-acoes">
                        <button
                            id="${IDS.botaoImportarPdf}"
                            class="listalar-gastos-botao"
                            type="button"
                        >
                            📄 Importar nota fiscal em PDF
                        </button>
                    </div>
                </section>

                <section class="listalar-gastos-graficos">
                    <article class="listalar-gastos-card">
                        <div class="listalar-gastos-card-topo">
                            <div>
                                <h2>Evolução dos gastos</h2>
                                <p>Totais dos últimos seis meses.</p>
                            </div>
                        </div>

                        <div
                            id="${IDS.graficoMensal}"
                            class="listalar-gastos-barras"
                        ></div>
                    </article>

                    <article class="listalar-gastos-card">
                        <div class="listalar-gastos-card-topo">
                            <div>
                                <h2>Origem dos gastos</h2>
                                <p>PDF versus compra manual.</p>
                            </div>
                        </div>

                        <div id="${IDS.graficoOrigem}"></div>
                    </article>
                </section>

                <section class="listalar-gastos-card">
                    <div class="listalar-gastos-card-topo">
                        <div>
                            <h2>Histórico</h2>
                            <p>
                                Compras salvas no período selecionado.
                            </p>
                        </div>
                    </div>

                    <div
                        id="${IDS.historico}"
                        class="listalar-gastos-historico-lista"
                    ></div>
                </section>
            </main>

            <div
                id="${IDS.aviso}"
                class="listalar-gastos-aviso info"
                role="status"
                hidden
            ></div>

            <div
                id="${IDS.modalManual}"
                class="listalar-gastos-modal"
                role="dialog"
                aria-modal="true"
                aria-hidden="true"
                aria-labelledby="listalar-gastos-manual-titulo"
            >
                <div class="listalar-gastos-modal-conteudo">
                    <h2 id="listalar-gastos-manual-titulo">
                        Confirmar compra com preços
                    </h2>

                    <p>
                        Informe o estabelecimento. A data de hoje já
                        está preenchida e pode ser alterada.
                    </p>

                    <div class="listalar-gastos-campo">
                        <label
                            for="${IDS.manualEstabelecimento}"
                        >
                            Estabelecimento
                        </label>

                        <input
                            id="${IDS.manualEstabelecimento}"
                            type="text"
                            autocomplete="organization"
                            placeholder="Ex.: Mercado do bairro"
                        >
                    </div>

                    <div class="listalar-gastos-campo">
                        <label for="${IDS.manualData}">
                            Data da compra
                        </label>

                        <input
                            id="${IDS.manualData}"
                            type="date"
                        >
                    </div>

                    <div
                        id="${IDS.manualResumo}"
                        class="listalar-gastos-manual-resumo"
                    ></div>

                    <div class="listalar-gastos-modal-acoes">
                        <button
                            id="${IDS.manualCancelar}"
                            class="listalar-gastos-modal-cancelar"
                            type="button"
                        >
                            Cancelar
                        </button>

                        <button
                            id="${IDS.manualConfirmar}"
                            class="listalar-gastos-modal-confirmar"
                            type="button"
                        >
                            Salvar compra
                        </button>
                    </div>
                </div>
            </div>

            <div id="${IDS.modalEditar}" class="listalar-gastos-modal" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="listalar-gastos-editar-titulo">
                <div class="listalar-gastos-modal-conteudo">
                    <h2 id="listalar-gastos-editar-titulo">Editar nota fiscal</h2>
                    <p>Altere o estabelecimento ou a data. Valores e itens fiscais serão preservados.</p>
                    <div class="listalar-gastos-campo">
                        <label for="${IDS.editarEstabelecimento}">Estabelecimento</label>
                        <input id="${IDS.editarEstabelecimento}" type="text" maxlength="120" autocomplete="organization">
                    </div>
                    <div class="listalar-gastos-campo">
                        <label for="${IDS.editarData}">Data da compra</label>
                        <input id="${IDS.editarData}" type="date">
                    </div>
                    <div id="${IDS.editarResumo}" class="listalar-gastos-manual-resumo"></div>
                    <div class="listalar-gastos-modal-acoes">
                        <button id="${IDS.editarCancelar}" class="listalar-gastos-modal-cancelar" type="button">Cancelar</button>
                        <button id="${IDS.editarConfirmar}" class="listalar-gastos-modal-confirmar" type="button">Salvar alterações</button>
                    </div>
                </div>
            </div>

            <div
                id="${IDS.modalDetalhes}"
                class="listalar-gastos-modal"
                role="dialog"
                aria-modal="true"
                aria-hidden="true"
                aria-labelledby="${IDS.detalhesTitulo}"
            >
                <div class="listalar-gastos-modal-conteudo">
                    <h2 id="${IDS.detalhesTitulo}">Itens da compra</h2>
                    <div id="${IDS.detalhesResumo}" class="listalar-gastos-detalhes-resumo"></div>
                    <div id="${IDS.detalhesItens}" class="listalar-gastos-detalhes-itens"></div>
                    <div class="listalar-gastos-modal-acoes" style="grid-template-columns:1fr;">
                        <button
                            id="${IDS.detalhesFechar}"
                            class="listalar-gastos-modal-cancelar"
                            type="button"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(tela);
    }

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

        for (const seletor of seletores) {
            const container = document.querySelector(seletor);

            if (container) {
                return container;
            }
        }

        return null;
    }

    function criarBotaoMenu() {
        if (elemento(IDS.botaoMenu)) {
            return;
        }

        const botao = document.createElement("button");
        botao.id = IDS.botaoMenu;
        botao.type = "button";
        botao.className = "listalar-menu-gastos";
        botao.title = "Gastos";
        botao.setAttribute("aria-label", "Abrir Gastos");

        botao.innerHTML = `
            <span
                class="listalar-menu-gastos-icone"
                aria-hidden="true"
            >
                💰
            </span>

            <span class="listalar-menu-gastos-texto">
                Gastos
            </span>
        `;

        const menu = localizarContainerMenu();

        if (menu) {
            menu.appendChild(botao);
        } else {
            botao.style.position = "fixed";
            botao.style.right = "16px";
            botao.style.bottom = "18px";
            botao.style.zIndex = "9990";
            botao.style.background = "#2563eb";
            botao.style.color = "#ffffff";
            document.body.appendChild(botao);
        }
    }

    function abrirTela() {
        if (!ESTADO.liberado) {
            return;
        }

        const tela = elemento(IDS.tela);

        if (!tela) {
            return;
        }

        tela.classList.add("aberta");
        tela.setAttribute("aria-hidden", "false");
        document.body.classList.add("listalar-gastos-aberto");
        tela.scrollTo({ top: 0, behavior: "instant" });
        renderizarPainel();
    }

    function fecharTela() {
        const tela = elemento(IDS.tela);

        if (!tela) {
            return;
        }

        fecharModalManual();
        fecharModalEditar();
        fecharModalDetalhes();
        tela.classList.remove("aberta");
        tela.setAttribute("aria-hidden", "true");
        document.body.classList.remove("listalar-gastos-aberto");
    }

    // ========================================================
    // NORMALIZAÇÃO DA NOTA
    // ========================================================

    function obterListaItens(nota) {
        const possibilidades = [
            nota?.produtos,
            nota?.itens,
            nota?.items,
            nota?.dados?.produtos,
            nota?.dados?.itens,
            nota?.nota?.produtos,
            nota?.nota?.itens
        ];

        return possibilidades.find(Array.isArray) || [];
    }

    function obterPrimeiroValor(objeto, caminhos) {
        for (const caminho of caminhos) {
            const partes = caminho.split(".");
            let atual = objeto;

            for (const parte of partes) {
                atual = atual?.[parte];
            }

            if (
                atual !== undefined &&
                atual !== null &&
                atual !== ""
            ) {
                return atual;
            }
        }

        return "";
    }

    function obterNomeEstabelecimento(nota) {
        const valor = obterPrimeiroValor(
            nota,
            [
                "mercadoNome",
                "estabelecimento",
                "supermercado",
                "emitente.nome",
                "emitente.razaoSocial",
                "razaoSocial",
                "nomeEmpresa",
                "dados.mercadoNome",
                "dados.estabelecimento",
                "dados.emitente.nome",
                "dados.emitente.razaoSocial",
                "nota.mercadoNome",
                "nota.estabelecimento",
                "nota.emitente.nome",
                "nota.emitente.razaoSocial"
            ]
        );

        if (
            typeof nota?.emitente === "string" &&
            !valor
        ) {
            return normalizarTexto(nota.emitente);
        }

        return normalizarTexto(valor) ||
            "Estabelecimento não identificado";
    }

    function obterCnpjEstabelecimento(nota) {
        return somenteDigitos(
            obterPrimeiroValor(
                nota,
                [
                    "cnpj",
                    "emitente.cnpj",
                    "estabelecimentoCnpj",
                    "dados.cnpj",
                    "dados.emitente.cnpj",
                    "nota.cnpj",
                    "nota.emitente.cnpj"
                ]
            )
        );
    }

    function obterDataCompraNota(nota) {
        const valor = obterPrimeiroValor(
            nota,
            [
                "dataCompra",
                "data",
                "dataEmissao",
                "emissao",
                "dados.dataCompra",
                "dados.data",
                "dados.dataEmissao",
                "nota.dataCompra",
                "nota.data",
                "nota.dataEmissao"
            ]
        );

        return converterParaData(valor || new Date());
    }

    function obterValorTotalNota(nota, itens) {
        const valor = obterPrimeiroValor(
            nota,
            [
                "total",
                "valorTotal",
                "totalNota",
                "valor_total",
                "dados.total",
                "dados.valorTotal",
                "nota.total",
                "nota.valorTotal"
            ]
        );

        const totalInformado = numeroSeguro(valor, NaN);

        if (Number.isFinite(totalInformado)) {
            return arredondarMoeda(totalInformado);
        }

        return arredondarMoeda(
            itens.reduce(
                (soma, item) =>
                    soma + obterTotalItem(item),
                0
            )
        );
    }

    function obterCodigoItem(item) {
        return normalizarTexto(
            obterPrimeiroValor(
                item,
                [
                    "codigoItem",
                    "codigo",
                    "codigoProduto",
                    "cod",
                    "idProduto",
                    "sku"
                ]
            )
        );
    }

    function obterGtinItem(item) {
        const valor = somenteDigitos(
            obterPrimeiroValor(
                item,
                [
                    "gtin",
                    "ean",
                    "codigoBarras",
                    "codigoDeBarras",
                    "cEAN"
                ]
            )
        );

        return [8, 12, 13, 14].includes(valor.length)
            ? valor
            : "";
    }

    function obterDescricaoItem(item, indice) {
        return normalizarTexto(
            obterPrimeiroValor(
                item,
                [
                    "descricaoEditada",
                    "produtoNome",
                    "descricaoOriginal",
                    "nome",
                    "descricao",
                    "produto",
                    "item"
                ]
            )
        ) || `Item ${indice + 1}`;
    }

    function obterDescricaoOriginalItem(item, indice) {
        return normalizarTexto(
            obterPrimeiroValor(
                item,
                [
                    "descricaoOriginal",
                    "descricao",
                    "produtoNome",
                    "nome",
                    "produto",
                    "item"
                ]
            )
        ) || `Item ${indice + 1}`;
    }

    function obterQuantidadeItem(item) {
        return Math.max(
            0,
            numeroSeguro(
                obterPrimeiroValor(
                    item,
                    [
                        "quantidade",
                        "qtd",
                        "qtde"
                    ]
                ),
                1
            )
        );
    }

    function obterUnidadeItem(item) {
        return normalizarTexto(
            obterPrimeiroValor(
                item,
                [
                    "unidade",
                    "un",
                    "tipoUnidade"
                ]
            )
        ).toUpperCase().slice(0, 6);
    }

    function obterPrecoUnitarioItem(item) {
        return arredondarMoeda(
            numeroSeguro(
                obterPrimeiroValor(
                    item,
                    [
                        "precoUnitario",
                        "valorUnitario",
                        "preco",
                        "valor"
                    ]
                ),
                0
            )
        );
    }

    function obterTotalItem(item) {
        const total = numeroSeguro(
            obterPrimeiroValor(
                item,
                [
                    "precoTotal",
                    "total",
                    "valorTotal",
                    "subtotal",
                    "valor_total"
                ]
            ),
            NaN
        );

        if (Number.isFinite(total)) {
            return arredondarMoeda(total);
        }

        return arredondarMoeda(
            obterQuantidadeItem(item) *
            obterPrecoUnitarioItem(item)
        );
    }

    function normalizarNota(nota) {
        const itensOriginais = obterListaItens(nota);
        const estabelecimentoNome =
            obterNomeEstabelecimento(nota);
        const estabelecimentoCnpj =
            obterCnpjEstabelecimento(nota);
        const dataCompra =
            obterDataCompraNota(nota);

        const itens = itensOriginais.map(
            (item, indice) => {
                const codigoItem =
                    obterCodigoItem(item);
                const gtin = obterGtinItem(item);

                return {
                    ordem: indice + 1,
                    codigoItem,
                    gtin,
                    descricaoOriginal:
                        obterDescricaoOriginalItem(
                            item,
                            indice
                        ),
                    descricao:
                        obterDescricaoItem(
                            item,
                            indice
                        ),
                    quantidade:
                        obterQuantidadeItem(item),
                    unidade:
                        obterUnidadeItem(item),
                    precoUnitario:
                        obterPrecoUnitarioItem(item),
                    valorTotal:
                        obterTotalItem(item),
                    identificadorFiscal:
                        gtin ||
                        (
                            estabelecimentoCnpj &&
                            codigoItem
                                ? `${estabelecimentoCnpj}_${codigoItem}`
                                : ""
                        )
                };
            }
        );

        const valorTotal =
            obterValorTotalNota(nota, itens);

        const chaveAcesso = somenteDigitos(
            obterPrimeiroValor(
                nota,
                [
                    "chaveAcesso",
                    "chave",
                    "nota.chaveAcesso",
                    "dados.chaveAcesso"
                ]
            )
        );

        const assinaturaBase = [
            estabelecimentoCnpj,
            dataParaISO(dataCompra),
            valorTotal.toFixed(2),
            itens.length,
            itens.map(
                (item) =>
                    `${item.codigoItem}:${item.valorTotal}`
            ).join("|")
        ].join("::");

        return {
            id:
                chaveAcesso ||
                `pdf_${hashTexto(assinaturaBase)}`,

            tipoRegistro: "nota_fiscal",
            origem: "PDF",

            estabelecimentoNome,
            estabelecimentoCnpj,

            dataCompra: dataParaISO(dataCompra),
            dataCompraMs: dataCompra.getTime(),
            competencia: competenciaDaData(dataCompra),

            valorTotal,
            quantidadeItens: itens.length,

            chaveAcesso,
            itens
        };
    }

    // ========================================================
    // GRAVAÇÃO
    // ========================================================

    async function apagarItensExistentes(
        referenciaGasto
    ) {
        const firebase = ESTADO.firebase;
        const itensSnapshot = await firebase.getDocs(
            firebase.collection(
                referenciaGasto,
                "itens"
            )
        );

        if (itensSnapshot.empty) {
            return;
        }

        let batch = firebase.writeBatch(firebase.db);
        let operacoes = 0;

        for (const documento of itensSnapshot.docs) {
            batch.delete(documento.ref);
            operacoes += 1;

            if (operacoes >= 400) {
                await batch.commit();
                batch = firebase.writeBatch(firebase.db);
                operacoes = 0;
            }
        }

        if (operacoes > 0) {
            await batch.commit();
        }
    }

    async function salvarRegistroComItens(
        registro,
        itens
    ) {
        if (
            ESTADO.salvando ||
            !ESTADO.firebase ||
            !ESTADO.usuario ||
            !ESTADO.familiaId
        ) {
            return;
        }

        ESTADO.salvando = true;
        definirCarregando(true, "Salvando compra...");

        const firebase = ESTADO.firebase;
        const gastos = colecaoGastos();

        if (!gastos) {
            ESTADO.salvando = false;
            definirCarregando(false);
            throw new Error("FAMILIA_NAO_IDENTIFICADA");
        }

        const referenciaGasto = firebase.doc(
            gastos,
            registro.id
        );

        try {
            await apagarItensExistentes(
                referenciaGasto
            );

            await firebase.setDoc(
                referenciaGasto,
                {
                    tipoRegistro:
                        registro.tipoRegistro,
                    origem:
                        registro.origem,

                    estabelecimentoNome:
                        registro.estabelecimentoNome || "",
                    estabelecimentoCnpj:
                        registro.estabelecimentoCnpj || "",

                    dataCompra:
                        registro.dataCompra,
                    dataCompraMs:
                        registro.dataCompraMs,
                    competencia:
                        registro.competencia,

                    valorTotal:
                        arredondarMoeda(
                            registro.valorTotal
                        ),
                    quantidadeItens:
                        Number(
                            registro.quantidadeItens ||
                            itens.length
                        ),

                    chaveAcesso:
                        registro.chaveAcesso || "",

                    familiaId:
                        ESTADO.familiaId,
                    usuarioId:
                        ESTADO.usuario.uid,

                    atualizadoEm:
                        firebase.serverTimestamp(),

                    criadoEm:
                        registro.criadoEm ||
                        firebase.serverTimestamp()
                },
                {
                    merge: true
                }
            );

            let batch = firebase.writeBatch(firebase.db);
            let operacoes = 0;

            for (
                let indice = 0;
                indice < itens.length;
                indice += 1
            ) {
                const item = itens[indice];
                const idItem = String(
                    item.ordem || indice + 1
                ).padStart(4, "0");

                const referenciaItem = firebase.doc(
                    firebase.collection(
                        referenciaGasto,
                        "itens"
                    ),
                    idItem
                );

                batch.set(
                    referenciaItem,
                    {
                        ordem:
                            item.ordem || indice + 1,
                        codigoItem:
                            item.codigoItem || "",
                        produtoId:
                            item.produtoId || "",
                        gtin:
                            item.gtin || "",
                        descricaoOriginal:
                            item.descricaoOriginal ||
                            item.descricao ||
                            "",
                        descricao:
                            item.descricao || "",
                        quantidade:
                            numeroSeguro(
                                item.quantidade,
                                0
                            ),
                        unidade:
                            item.unidade || "",
                        precoUnitario:
                            arredondarMoeda(
                                item.precoUnitario
                            ),
                        valorTotal:
                            arredondarMoeda(
                                item.valorTotal
                            ),
                        identificadorFiscal:
                            item.identificadorFiscal || ""
                    }
                );

                operacoes += 1;

                if (operacoes >= 400) {
                    await batch.commit();
                    batch = firebase.writeBatch(
                        firebase.db
                    );
                    operacoes = 0;
                }
            }

            if (operacoes > 0) {
                await batch.commit();
            }

            mostrarAviso(
                registro.tipoRegistro === "nota_fiscal"
                    ? "Nota fiscal salva com sucesso."
                    : "Compra manual salva com sucesso.",
                "sucesso"
            );

            window.dispatchEvent(
                new CustomEvent(
                    "listalar:gasto-salvo",
                    {
                        detail: {
                            gastoId:
                                registro.id,
                            tipoRegistro:
                                registro.tipoRegistro,
                            familiaId:
                                ESTADO.familiaId
                        }
                    }
                )
            );
        } finally {
            ESTADO.salvando = false;
            definirCarregando(false);
        }
    }

    // ========================================================
    // IMPORTAÇÃO PDF
    // ========================================================

    function abrirImportadorPdf() {
        if (!ESTADO.liberado) {
            return;
        }

        const importador =
            window.ListaLarConferenciaNota ||
            window.ImportadorNotaPDF;

        if (
            !importador ||
            typeof importador.abrir !== "function"
        ) {
            mostrarAviso(
                "O importador de PDF não está disponível.",
                "erro"
            );
            return;
        }

        try {
            importador.abrir();
        } catch (erro) {
            console.error(
                "ListaLar Gastos: erro ao abrir PDF:",
                erro
            );

            mostrarAviso(
                "Não foi possível abrir o PDF da nota.",
                "erro"
            );
        }
    }

    function extrairNotaDoEvento(evento) {
        const detalhe = evento?.detail;

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
            nota === ESTADO.ultimaNotaReferencia &&
            agora - ESTADO.ultimaNotaRecebidaEm < 1800
        ) {
            return true;
        }

        ESTADO.ultimaNotaReferencia = nota;
        ESTADO.ultimaNotaRecebidaEm = agora;
        return false;
    }

    async function receberNotaImportada(evento) {
        if (!ESTADO.liberado) {
            return;
        }

        const nota = extrairNotaDoEvento(evento);

        if (
            !nota ||
            typeof nota !== "object" ||
            notaJaRecebida(nota)
        ) {
            return;
        }

        try {
            const registro = normalizarNota(nota);

            if (!registro.itens.length) {
                throw new Error("NOTA_SEM_ITENS");
            }

            if (registro.valorTotal <= 0) {
                throw new Error("NOTA_SEM_VALOR");
            }

            await salvarRegistroComItens(
                registro,
                registro.itens
            );

            abrirTela();
        } catch (erro) {
            console.error(
                "ListaLar Gastos: erro ao salvar nota:",
                erro
            );

            mostrarAviso(
                erro?.message === "NOTA_SEM_ITENS"
                    ? "A nota não possui itens válidos."
                    : "A nota foi lida, mas não pôde ser salva.",
                "erro"
            );
        }
    }

    // ========================================================
    // COMPRA MANUAL
    // ========================================================

    function obterItensManuaisAtuais(
        produtoIdsPermitidos = null
    ) {
        try {
            if (
                !window.ListaLarPrecos ||
                typeof window.ListaLarPrecos
                    .obterItens !== "function"
            ) {
                return [];
            }

            const idsPermitidos =
                Array.isArray(produtoIdsPermitidos)
                    ? new Set(
                        produtoIdsPermitidos
                            .map((id) => String(id || ""))
                            .filter(Boolean)
                    )
                    : null;

            return window.ListaLarPrecos
                .obterItens()
                .filter((item) => {
                    const produtoId = String(
                        item.produtoId || ""
                    );

                    if (
                        idsPermitidos &&
                        !idsPermitidos.has(produtoId)
                    ) {
                        return false;
                    }

                    return (
                        numeroSeguro(
                            item.quantidade,
                            0
                        ) > 0 &&
                        numeroSeguro(
                            item.precoUnitario,
                            0
                        ) > 0
                    );
                })
                .map(
                    (item, indice) => ({
                        ordem: indice + 1,
                        produtoId:
                            String(
                                item.produtoId || ""
                            ),
                        codigoItem: "",
                        gtin: "",
                        descricaoOriginal:
                            normalizarTexto(
                                item.nome
                            ) ||
                            `Produto ${indice + 1}`,
                        descricao:
                            normalizarTexto(
                                item.nome
                            ) ||
                            `Produto ${indice + 1}`,
                        quantidade:
                            numeroSeguro(
                                item.quantidade,
                                0
                            ),
                        unidade: "",
                        precoUnitario:
                            arredondarMoeda(
                                item.precoUnitario
                            ),
                        valorTotal:
                            arredondarMoeda(
                                item.subtotal
                            ),
                        identificadorFiscal: ""
                    })
                );
        } catch (erro) {
            console.error(
                "ListaLar Gastos: erro ao ler preços manuais:",
                erro
            );

            return [];
        }
    }

    function resolverFluxoCompraManual(resultado) {
        const resolver =
            ESTADO.resolverCompraManual;

        ESTADO.resolverCompraManual = null;
        ESTADO.contextoCompraManual = null;

        if (typeof resolver === "function") {
            resolver(resultado);
        }
    }

    function abrirModalManual({
        produtoIds = null,
        origem = "tela_gastos"
    } = {}) {
        if (ESTADO.resolverCompraManual) {
            return Promise.resolve({
                necessario: true,
                salvo: false,
                cancelado: true,
                motivo: "FLUXO_JA_ABERTO"
            });
        }

        const itens =
            obterItensManuaisAtuais(produtoIds);

        if (!itens.length) {
            return Promise.resolve({
                necessario: false,
                salvo: false,
                cancelado: false
            });
        }

        const total = arredondarMoeda(
            itens.reduce(
                (soma, item) =>
                    soma + item.valorTotal,
                0
            )
        );

        elemento(IDS.manualData).value =
            dataHojeISO();

        elemento(IDS.manualResumo).textContent =
            `${itens.length} ${
                itens.length === 1
                    ? "item"
                    : "itens"
            } · ${formatarMoeda(total)}`;

        const modal = elemento(IDS.modalManual);
        modal.dataset.itens = JSON.stringify(itens);
        modal.classList.add("aberto");
        modal.setAttribute("aria-hidden", "false");

        ESTADO.contextoCompraManual = {
            origem,
            total,
            quantidadeItens: itens.length
        };

        window.setTimeout(
            () =>
                elemento(
                    IDS.manualEstabelecimento
                )?.focus(),
            0
        );

        return new Promise((resolve) => {
            ESTADO.resolverCompraManual = resolve;
        });
    }

    function fecharModalManual({
        resolver = true,
        resultado = {
            necessario: true,
            salvo: false,
            cancelado: true
        }
    } = {}) {
        const modal = elemento(IDS.modalManual);

        if (modal) {
            modal.classList.remove("aberto");
            modal.setAttribute(
                "aria-hidden",
                "true"
            );
            delete modal.dataset.itens;
        }

        if (resolver) {
            resolverFluxoCompraManual(resultado);
        }
    }

    async function confirmarCompraManual() {
        if (ESTADO.salvando) {
            return;
        }

        const modal = elemento(IDS.modalManual);
        const estabelecimentoNome =
            normalizarTexto(
                elemento(
                    IDS.manualEstabelecimento
                )?.value
            );

        const dataCompraValor =
            elemento(IDS.manualData)?.value ||
            dataHojeISO();

        let itens = [];

        try {
            itens = JSON.parse(
                modal?.dataset?.itens || "[]"
            );
        } catch {
            itens = [];
        }

        if (!estabelecimentoNome) {
            mostrarAviso(
                "Informe o estabelecimento.",
                "erro"
            );
            elemento(
                IDS.manualEstabelecimento
            )?.focus();
            return;
        }

        if (!itens.length) {
            fecharModalManual({
                resultado: {
                    necessario: false,
                    salvo: false,
                    cancelado: true,
                    motivo: "SEM_ITENS_COM_PRECO"
                }
            });
            mostrarAviso(
                "Nenhum item com preço foi encontrado.",
                "erro"
            );
            return;
        }

        const dataCompra =
            converterParaData(dataCompraValor);

        const valorTotal = arredondarMoeda(
            itens.reduce(
                (soma, item) =>
                    soma +
                    numeroSeguro(
                        item.valorTotal,
                        0
                    ),
                0
            )
        );

        const assinatura = [
            ESTADO.familiaId,
            dataParaISO(dataCompra),
            normalizarTexto(
                estabelecimentoNome
            ).toLowerCase(),
            valorTotal.toFixed(2),
            itens.map(
                (item) =>
                    `${item.produtoId}:${item.valorTotal}`
            ).join("|")
        ].join("::");

        const registro = {
            id: `manual_${hashTexto(assinatura)}`,
            tipoRegistro: "compra_manual",
            origem: "MANUAL",
            estabelecimentoNome,
            estabelecimentoCnpj: "",
            dataCompra: dataParaISO(dataCompra),
            dataCompraMs: dataCompra.getTime(),
            competencia: competenciaDaData(dataCompra),
            valorTotal,
            quantidadeItens: itens.length,
            chaveAcesso: ""
        };

        const botao = elemento(IDS.manualConfirmar);
        botao.disabled = true;

        try {
            await salvarRegistroComItens(
                registro,
                itens
            );

            elemento(
                IDS.manualEstabelecimento
            ).value = "";

            fecharModalManual({
                resultado: {
                    necessario: true,
                    salvo: true,
                    cancelado: false,
                    gastoId: registro.id,
                    valorTotal,
                    quantidadeItens: itens.length,
                    dataCompra: registro.dataCompra,
                    estabelecimentoNome
                }
            });
        } catch (erro) {
            console.error(
                "ListaLar Gastos: erro ao salvar compra manual:",
                erro
            );

            mostrarAviso(
                "Não foi possível salvar a compra. A lista não será finalizada.",
                "erro"
            );
        } finally {
            botao.disabled = false;
        }
    }


    function obterResumoCompraManualAoFinalizar({
        produtoIds = []
    } = {}) {
        const itens = obterItensManuaisAtuais(produtoIds);

        if (!itens.length) {
            return {
                necessario: false,
                quantidadeItens: 0,
                valorTotal: 0
            };
        }

        return {
            necessario: true,
            quantidadeItens: itens.length,
            valorTotal: arredondarMoeda(
                itens.reduce(
                    (soma, item) =>
                        soma + numeroSeguro(item.valorTotal, 0),
                    0
                )
            )
        };
    }

    async function salvarCompraManualAoFinalizar({
        produtoIds = [],
        estabelecimentoNome = "",
        dataCompra = ""
    } = {}) {
        if (ESTADO.salvando) {
            throw new Error("SALVAMENTO_EM_ANDAMENTO");
        }

        const itens = obterItensManuaisAtuais(produtoIds);

        if (!itens.length) {
            return {
                necessario: false,
                salvo: false,
                cancelado: false
            };
        }

        const nome = normalizarTexto(estabelecimentoNome);

        if (!nome) {
            throw new Error("ESTABELECIMENTO_OBRIGATORIO");
        }

        const dataCompraConvertida = converterParaData(
            dataCompra || dataHojeISO()
        );

        const valorTotal = arredondarMoeda(
            itens.reduce(
                (soma, item) =>
                    soma + numeroSeguro(item.valorTotal, 0),
                0
            )
        );

        const assinatura = [
            ESTADO.familiaId,
            dataParaISO(dataCompraConvertida),
            nome.toLowerCase(),
            valorTotal.toFixed(2),
            itens.map(
                (item) => `${item.produtoId}:${item.valorTotal}`
            ).join("|")
        ].join("::");

        const registro = {
            id: `manual_${hashTexto(assinatura)}`,
            tipoRegistro: "compra_manual",
            origem: "MANUAL",
            estabelecimentoNome: nome,
            estabelecimentoCnpj: "",
            dataCompra: dataParaISO(dataCompraConvertida),
            dataCompraMs: dataCompraConvertida.getTime(),
            competencia: competenciaDaData(dataCompraConvertida),
            valorTotal,
            quantidadeItens: itens.length,
            chaveAcesso: ""
        };

        await salvarRegistroComItens(registro, itens);

        return {
            necessario: true,
            salvo: true,
            cancelado: false,
            gastoId: registro.id,
            valorTotal,
            quantidadeItens: itens.length,
            dataCompra: registro.dataCompra,
            estabelecimentoNome: nome
        };
    }

    // ========================================================
    // EDIÇÃO E EXCLUSÃO DE NOTAS FISCAIS
    // ========================================================

    function localizarRegistroPorId(registroId) {
        return ESTADO.registros.find((registro) => registro.id === registroId) || null;
    }

    function fecharModalDetalhes() {
        const modal = elemento(IDS.modalDetalhes);
        modal?.classList.remove("aberto");
        modal?.setAttribute("aria-hidden", "true");
        ESTADO.registroEmDetalhes = null;
        ESTADO.carregandoDetalhes = false;
    }

    function valorItem(item, nomes, padrao = "") {
        for (const nome of nomes) {
            const valor = item?.[nome];
            if (valor !== undefined && valor !== null && valor !== "") {
                return valor;
            }
        }
        return padrao;
    }

    function renderizarItensDetalhes(itens) {
        const container = elemento(IDS.detalhesItens);

        if (!container) {
            return;
        }

        if (!itens.length) {
            container.innerHTML = `
                <div class="listalar-gastos-detalhes-vazio">
                    Nenhum item foi encontrado nesta compra.
                </div>
            `;
            return;
        }

        container.innerHTML = itens.map((item, indice) => {
            const descricao = normalizarTexto(
                valorItem(
                    item,
                    [
                        "descricao",
                        "descricaoEditada",
                        "descricaoOriginal",
                        "produtoNome",
                        "nome"
                    ],
                    `Item ${indice + 1}`
                )
            ) || `Item ${indice + 1}`;

            const quantidade = numeroSeguro(
                valorItem(item, ["quantidade", "qtd", "quantidadeComprada"], 0),
                0
            );

            const unidade = normalizarTexto(
                valorItem(item, ["unidade", "un", "siglaUnidade"], "")
            );

            const precoUnitario = numeroSeguro(
                valorItem(
                    item,
                    ["precoUnitario", "valorUnitario", "precoCompra", "preco"],
                    0
                ),
                0
            );

            const valorTotal = numeroSeguro(
                valorItem(item, ["valorTotal", "total", "subtotal"], quantidade * precoUnitario),
                quantidade * precoUnitario
            );

            const codigo = normalizarTexto(
                valorItem(item, ["codigoItem", "codigo", "codigoProduto"], "")
            );

            const gtin = somenteDigitos(
                valorItem(item, ["gtin", "ean", "codigoBarras"], "")
            );

            const identificacao = [
                codigo ? `Código: ${escaparHTML(codigo)}` : "",
                gtin ? `GTIN: ${escaparHTML(gtin)}` : ""
            ].filter(Boolean).join(" · ");

            return `
                <article class="listalar-gastos-detalhe-item">
                    <div class="listalar-gastos-detalhe-item-nome">
                        ${escaparHTML(descricao)}
                    </div>

                    <div class="listalar-gastos-detalhe-item-total">
                        ${formatarMoeda(valorTotal)}
                    </div>

                    <div class="listalar-gastos-detalhe-item-info">
                        ${formatarQuantidade(quantidade)}
                        ${escaparHTML(unidade)}
                        × ${formatarMoeda(precoUnitario)}
                        ${identificacao ? ` · ${identificacao}` : ""}
                    </div>
                </article>
            `;
        }).join("");
    }

    async function abrirModalDetalhes(registroId) {
        if (ESTADO.carregandoDetalhes) {
            return;
        }

        const registro = localizarRegistroPorId(registroId);

        if (!registro) {
            mostrarAviso("Compra não encontrada.", "erro");
            return;
        }

        ESTADO.registroEmDetalhes = registro;

        const titulo = elemento(IDS.detalhesTitulo);
        const resumo = elemento(IDS.detalhesResumo);
        const itensContainer = elemento(IDS.detalhesItens);
        const modal = elemento(IDS.modalDetalhes);

        const estabelecimento =
            registro.estabelecimentoNome ||
            (
                registro.tipoRegistro === "compra_manual"
                    ? "Compra manual"
                    : "Estabelecimento não identificado"
            );

        if (titulo) {
            titulo.textContent = estabelecimento;
        }

        if (resumo) {
            resumo.innerHTML = `
                <div class="listalar-gastos-detalhes-resumo-item">
                    <span>Data</span>
                    <strong>${escaparHTML(formatarData(registro.dataCompra || registro.dataCompraMs))}</strong>
                </div>
                <div class="listalar-gastos-detalhes-resumo-item">
                    <span>Total</span>
                    <strong>${formatarMoeda(registro.valorTotal)}</strong>
                </div>
                <div class="listalar-gastos-detalhes-resumo-item">
                    <span>Origem</span>
                    <strong>${
                        registro.tipoRegistro === "compra_manual"
                            ? "Compra manual"
                            : "Nota fiscal em PDF"
                    }</strong>
                </div>
                <div class="listalar-gastos-detalhes-resumo-item">
                    <span>Itens</span>
                    <strong>${Number(registro.quantidadeItens || 0)}</strong>
                </div>
            `;
        }

        if (itensContainer) {
            itensContainer.innerHTML = `
                <div class="listalar-gastos-detalhes-vazio">
                    Carregando itens...
                </div>
            `;
        }

        modal?.classList.add("aberto");
        modal?.setAttribute("aria-hidden", "false");

        ESTADO.carregandoDetalhes = true;

        try {
            const referencia = ESTADO.firebase.doc(
                colecaoGastos(),
                registro.id
            );

            const snapshot = await ESTADO.firebase.getDocs(
                ESTADO.firebase.collection(
                    referencia,
                    "itens"
                )
            );

            const itens = snapshot.docs
                .map((documento) => ({
                    id: documento.id,
                    ...documento.data()
                }))
                .sort((a, b) => {
                    const indiceA = numeroSeguro(a.indice, Number.MAX_SAFE_INTEGER);
                    const indiceB = numeroSeguro(b.indice, Number.MAX_SAFE_INTEGER);

                    if (indiceA !== indiceB) {
                        return indiceA - indiceB;
                    }

                    return String(a.id).localeCompare(
                        String(b.id),
                        "pt-BR",
                        { numeric: true }
                    );
                });

            if (
                ESTADO.registroEmDetalhes?.id ===
                registro.id
            ) {
                renderizarItensDetalhes(itens);
            }
        } catch (erro) {
            console.error(
                "ListaLar Gastos: erro ao carregar itens:",
                erro
            );

            if (itensContainer) {
                itensContainer.innerHTML = `
                    <div class="listalar-gastos-detalhes-vazio">
                        Não foi possível carregar os itens desta compra.
                    </div>
                `;
            }

            mostrarAviso(
                "Não foi possível carregar os itens.",
                "erro"
            );
        } finally {
            ESTADO.carregandoDetalhes = false;
        }
    }

    function fecharModalEditar() {
        const modal = elemento(IDS.modalEditar);
        modal?.classList.remove("aberto");
        modal?.setAttribute("aria-hidden", "true");
        ESTADO.registroEmEdicao = null;
    }

    function abrirModalEditar(registroId) {
        const registro = localizarRegistroPorId(registroId);
        if (!registro || registro.tipoRegistro !== "nota_fiscal") {
            mostrarAviso("Nota fiscal não encontrada.", "erro");
            return;
        }
        ESTADO.registroEmEdicao = registro;
        elemento(IDS.editarEstabelecimento).value = registro.estabelecimentoNome || "";
        elemento(IDS.editarData).value = dataParaISO(converterParaData(registro.dataCompra || registro.dataCompraMs));
        const quantidade = Number(registro.quantidadeItens || 0);
        elemento(IDS.editarResumo).textContent = `${quantidade} ${quantidade === 1 ? "item" : "itens"} · ${formatarMoeda(registro.valorTotal)}`;
        const modal = elemento(IDS.modalEditar);
        modal?.classList.add("aberto");
        modal?.setAttribute("aria-hidden", "false");
        setTimeout(() => elemento(IDS.editarEstabelecimento)?.focus(), 80);
    }

    async function salvarEdicaoNotaFiscal() {
        const registro = ESTADO.registroEmEdicao;
        if (!registro || ESTADO.salvando) return;
        const estabelecimentoNome = String(elemento(IDS.editarEstabelecimento)?.value || "").trim();
        const dataTexto = elemento(IDS.editarData)?.value || "";
        if (!estabelecimentoNome) {
            mostrarAviso("Informe o estabelecimento.", "erro");
            elemento(IDS.editarEstabelecimento)?.focus();
            return;
        }
        const dataCompra = converterParaData(dataTexto);
        if (!dataCompra || Number.isNaN(dataCompra.getTime())) {
            mostrarAviso("Informe uma data válida.", "erro");
            return;
        }
        ESTADO.salvando = true;
        definirCarregando(true, "Salvando alterações...");
        try {
            const referencia = ESTADO.firebase.doc(colecaoGastos(), registro.id);
            await ESTADO.firebase.setDoc(referencia, {
                estabelecimentoNome,
                dataCompra: dataParaISO(dataCompra),
                dataCompraMs: dataCompra.getTime(),
                competencia: competenciaDaData(dataCompra),
                atualizadoEm: ESTADO.firebase.serverTimestamp(),
                editadoPor: ESTADO.usuario?.uid || ""
            }, { merge: true });
            fecharModalEditar();
            mostrarAviso("Nota fiscal atualizada com sucesso.", "sucesso");
        } catch (erro) {
            console.error("ListaLar Gastos: erro ao editar nota fiscal:", erro);
            mostrarAviso("Não foi possível atualizar a nota fiscal.", "erro");
        } finally {
            ESTADO.salvando = false;
            definirCarregando(false);
        }
    }

    async function confirmarExclusaoNota(registro) {
        const estabelecimento =
            registro.estabelecimentoNome ||
            "estabelecimento não identificado";

        const texto =
            `Excluir a nota de ${estabelecimento} no valor de ` +
            `${formatarMoeda(registro.valorTotal)}?\n\n` +
            "A nota e todos os itens serão apagados definitivamente.";

        // O modal global do index usa z-index menor que a tela de Gastos
        // e pode abrir escondido atrás dela. O confirm nativo permanece
        // visível acima da aplicação e devolve um booleano confiável.
        return window.confirm(texto);
    }

    async function excluirNotaFiscal(registroId) {
        if (ESTADO.excluindoRegistro) return;
        const registro = localizarRegistroPorId(registroId);
        if (!registro || registro.tipoRegistro !== "nota_fiscal") {
            mostrarAviso("Nota fiscal não encontrada.", "erro");
            return;
        }
        if (!(await confirmarExclusaoNota(registro))) return;
        ESTADO.excluindoRegistro = true;
        definirCarregando(true, "Excluindo nota fiscal...");
        try {
            const referencia = ESTADO.firebase.doc(colecaoGastos(), registro.id);
            await apagarItensExistentes(referencia);
            await ESTADO.firebase.deleteDoc(referencia);
            mostrarAviso("Nota fiscal excluída com sucesso.", "sucesso");
        } catch (erro) {
            console.error("ListaLar Gastos: erro ao excluir nota fiscal:", erro);
            mostrarAviso("Não foi possível excluir a nota fiscal.", "erro");
        } finally {
            ESTADO.excluindoRegistro = false;
            definirCarregando(false);
        }
    }

    // ========================================================
    // HISTÓRICO E DASHBOARD
    // ========================================================

    function pararHistorico() {
        if (ESTADO.unsubscribeGastos) {
            ESTADO.unsubscribeGastos();
            ESTADO.unsubscribeGastos = null;
        }

        ESTADO.registros = [];
        renderizarPainel();
    }

    function iniciarHistorico() {
        pararHistorico();

        const gastos = colecaoGastos();

        if (!gastos) {
            return;
        }

        definirCarregando(
            true,
            "Carregando histórico..."
        );

        const firebase = ESTADO.firebase;
        const consulta = firebase.query(
            gastos,
            firebase.orderBy(
                "dataCompraMs",
                "desc"
            ),
            firebase.limit(
                LIMITE_HISTORICO
            )
        );

        ESTADO.unsubscribeGastos =
            firebase.onSnapshot(
                consulta,
                (snapshot) => {
                    ESTADO.registros =
                        snapshot.docs.map(
                            (documento) => ({
                                id: documento.id,
                                ...documento.data()
                            })
                        );

                    definirCarregando(false);
                    renderizarPainel();
                },
                (erro) => {
                    console.error(
                        "ListaLar Gastos: erro ao carregar histórico:",
                        erro
                    );

                    definirCarregando(false);
                    mostrarAviso(
                        "Não foi possível carregar o histórico.",
                        "erro"
                    );
                }
            );
    }

    function inicioDoPeriodo(periodo) {
        const agora = new Date();
        agora.setHours(0, 0, 0, 0);

        if (periodo === "mes_atual") {
            return new Date(
                agora.getFullYear(),
                agora.getMonth(),
                1
            ).getTime();
        }

        if (periodo === "ultimos_3_meses") {
            return new Date(
                agora.getFullYear(),
                agora.getMonth() - 2,
                1
            ).getTime();
        }

        if (periodo === "ano_atual") {
            return new Date(
                agora.getFullYear(),
                0,
                1
            ).getTime();
        }

        return 0;
    }

    function registrosFiltrados() {
        const inicio = inicioDoPeriodo(
            ESTADO.periodo
        );

        return ESTADO.registros.filter(
            (registro) =>
                numeroSeguro(
                    registro.dataCompraMs,
                    0
                ) >= inicio
        );
    }

    function atualizarIndicadores(registros) {
        const total = arredondarMoeda(
            registros.reduce(
                (soma, registro) =>
                    soma +
                    numeroSeguro(
                        registro.valorTotal,
                        0
                    ),
                0
            )
        );

        const notas = arredondarMoeda(
            registros
                .filter(
                    (registro) =>
                        registro.tipoRegistro ===
                        "nota_fiscal"
                )
                .reduce(
                    (soma, registro) =>
                        soma +
                        numeroSeguro(
                            registro.valorTotal,
                            0
                        ),
                    0
                )
        );

        const manuais = arredondarMoeda(
            registros
                .filter(
                    (registro) =>
                        registro.tipoRegistro ===
                        "compra_manual"
                )
                .reduce(
                    (soma, registro) =>
                        soma +
                        numeroSeguro(
                            registro.valorTotal,
                            0
                        ),
                    0
                )
        );

        const ticket = registros.length
            ? arredondarMoeda(
                total / registros.length
            )
            : 0;

        elemento(IDS.totalPeriodo).textContent =
            formatarMoeda(total);
        elemento(IDS.totalCompras).textContent =
            String(registros.length);
        elemento(IDS.totalNotas).textContent =
            formatarMoeda(notas);
        elemento(IDS.totalManuais).textContent =
            formatarMoeda(manuais);
        elemento(IDS.ticketMedio).textContent =
            formatarMoeda(ticket);
    }

    function ultimosSeisMeses() {
        const agora = new Date();
        const meses = [];

        for (let deslocamento = 5; deslocamento >= 0; deslocamento -= 1) {
            const data = new Date(
                agora.getFullYear(),
                agora.getMonth() - deslocamento,
                1
            );

            meses.push({
                competencia:
                    competenciaDaData(data),
                rotulo:
                    data.toLocaleDateString(
                        "pt-BR",
                        {
                            month: "short"
                        }
                    ).replace(".", "")
            });
        }

        return meses;
    }

    function renderizarGraficoMensal() {
        const container =
            elemento(IDS.graficoMensal);

        if (!container) {
            return;
        }

        const meses = ultimosSeisMeses();
        const totais = meses.map(
            (mes) =>
                ESTADO.registros
                    .filter(
                        (registro) =>
                            registro.competencia ===
                            mes.competencia
                    )
                    .reduce(
                        (soma, registro) =>
                            soma +
                            numeroSeguro(
                                registro.valorTotal,
                                0
                            ),
                        0
                    )
        );

        const maior = Math.max(...totais, 0);

        container.innerHTML = meses.map(
            (mes, indice) => {
                const total = totais[indice];
                const altura = maior > 0
                    ? Math.max(
                        4,
                        Math.round(
                            (total / maior) * 112
                        )
                    )
                    : 4;

                return `
                    <div class="listalar-gastos-barra-coluna">
                        <div class="listalar-gastos-barra-area">
                            <div
                                class="listalar-gastos-barra"
                                style="height: ${altura}px"
                                title="${escaparHTML(
                                    formatarMoeda(total)
                                )}"
                            ></div>
                        </div>

                        <strong>
                            ${escaparHTML(
                                total > 0
                                    ? formatarMoeda(total)
                                        .replace("R$", "")
                                        .trim()
                                    : "0"
                            )}
                        </strong>

                        <small>
                            ${escaparHTML(mes.rotulo)}
                        </small>
                    </div>
                `;
            }
        ).join("");
    }

    function renderizarGraficoOrigem(registros) {
        const container =
            elemento(IDS.graficoOrigem);

        if (!container) {
            return;
        }

        const totalPdf = registros
            .filter(
                (registro) =>
                    registro.tipoRegistro ===
                    "nota_fiscal"
            )
            .reduce(
                (soma, registro) =>
                    soma +
                    numeroSeguro(
                        registro.valorTotal,
                        0
                    ),
                0
            );

        const totalManual = registros
            .filter(
                (registro) =>
                    registro.tipoRegistro ===
                    "compra_manual"
            )
            .reduce(
                (soma, registro) =>
                    soma +
                    numeroSeguro(
                        registro.valorTotal,
                        0
                    ),
                0
            );

        const totalGeral =
            totalPdf + totalManual;

        const percentualPdf = totalGeral > 0
            ? (totalPdf / totalGeral) * 100
            : 0;

        const percentualManual = totalGeral > 0
            ? (totalManual / totalGeral) * 100
            : 0;

        container.innerHTML = `
            <div class="listalar-gastos-origem-linha">
                <div class="listalar-gastos-origem-cabecalho">
                    <span>Nota fiscal em PDF</span>
                    <strong>${formatarMoeda(totalPdf)}</strong>
                </div>

                <div class="listalar-gastos-origem-trilho">
                    <div
                        class="listalar-gastos-origem-preenchimento"
                        style="width: ${percentualPdf}%"
                    ></div>
                </div>
            </div>

            <div class="listalar-gastos-origem-linha">
                <div class="listalar-gastos-origem-cabecalho">
                    <span>Compra manual</span>
                    <strong>${formatarMoeda(totalManual)}</strong>
                </div>

                <div class="listalar-gastos-origem-trilho">
                    <div
                        class="listalar-gastos-origem-preenchimento manual"
                        style="width: ${percentualManual}%"
                    ></div>
                </div>
            </div>
        `;
    }

    function renderizarHistorico(registros) {
        const container = elemento(IDS.historico);

        if (!container) {
            return;
        }

        if (!registros.length) {
            container.innerHTML = `
                <div class="listalar-gastos-vazio">
                    Nenhuma compra salva neste período.
                </div>
            `;
            return;
        }

        container.innerHTML = registros.map(
            (registro) => {
                const manual =
                    registro.tipoRegistro ===
                    "compra_manual";

                const estabelecimento =
                    registro.estabelecimentoNome ||
                    (
                        manual
                            ? "Compra manual"
                            : "Estabelecimento não identificado"
                    );

                const quantidade =
                    Number(
                        registro.quantidadeItens || 0
                    );

                return `
                    <article
                        class="listalar-gastos-registro ${
                            manual ? "manual" : ""
                        }"
                        data-acao="abrir-detalhes"
                        data-registro-id="${escaparHTML(registro.id)}"
                        role="button"
                        tabindex="0"
                        aria-label="Abrir itens da compra de ${escaparHTML(estabelecimento)}"
                    >
                        <div
                            class="listalar-gastos-registro-icone"
                            aria-hidden="true"
                        >
                            ${manual ? "💵" : "🧾"}
                        </div>

                        <div
                            class="listalar-gastos-registro-conteudo"
                        >
                            <strong>
                                ${escaparHTML(estabelecimento)}
                            </strong>

                            <small>
                                ${manual
                                    ? "Compra manual"
                                    : "Nota fiscal em PDF"
                                }
                                · ${escaparHTML(
                                    formatarData(
                                        registro.dataCompra ||
                                        registro.dataCompraMs
                                    )
                                )}
                                · ${quantidade}
                                ${quantidade === 1
                                    ? "item"
                                    : "itens"
                                }
                            </small>

                            <span class="listalar-gastos-registro-dica">
                                Toque para ver os itens
                            </span>
                        </div>

                        <div class="listalar-gastos-registro-lateral">
                            <div class="listalar-gastos-registro-valor">
                                ${formatarMoeda(registro.valorTotal)}
                            </div>
                            ${manual ? "" : `
                                <div class="listalar-gastos-registro-acoes">
                                    <button class="listalar-gastos-registro-acao editar" type="button" data-acao="editar-nota" data-registro-id="${escaparHTML(registro.id)}" title="Editar nota fiscal" aria-label="Editar nota fiscal">✏️</button>
                                    <button class="listalar-gastos-registro-acao excluir" type="button" data-acao="excluir-nota" data-registro-id="${escaparHTML(registro.id)}" title="Excluir nota fiscal" aria-label="Excluir nota fiscal">🗑️</button>
                                </div>
                            `}
                        </div>
                    </article>
                `;
            }
        ).join("");
    }

    function renderizarPainel() {
        if (!ESTADO.interfaceInicializada) {
            return;
        }

        const registros = registrosFiltrados();

        atualizarIndicadores(registros);
        renderizarGraficoMensal();
        renderizarGraficoOrigem(registros);
        renderizarHistorico(registros);
    }

    // ========================================================
    // EVENTOS E API
    // ========================================================

    function configurarEventos() {
        elemento(IDS.botaoMenu)?.addEventListener(
            "click",
            abrirTela
        );

        elemento(IDS.botaoFechar)?.addEventListener(
            "click",
            fecharTela
        );

        elemento(IDS.botaoImportarPdf)?.addEventListener(
            "click",
            abrirImportadorPdf
        );

        elemento(IDS.manualCancelar)?.addEventListener(
            "click",
            () => fecharModalManual()
        );

        elemento(IDS.manualConfirmar)?.addEventListener(
            "click",
            confirmarCompraManual
        );

        elemento(IDS.seletorPeriodo)?.addEventListener(
            "change",
            (evento) => {
                ESTADO.periodo =
                    evento.target.value;
                renderizarPainel();
            }
        );

        elemento(IDS.historico)?.addEventListener("click", (evento) => {
            const alvo = evento.target.closest("[data-acao][data-registro-id]");

            if (!alvo) {
                return;
            }

            evento.stopPropagation();

            const registroId = alvo.dataset.registroId;
            const acao = alvo.dataset.acao;

            if (acao === "editar-nota") {
                abrirModalEditar(registroId);
                return;
            }

            if (acao === "excluir-nota") {
                excluirNotaFiscal(registroId);
                return;
            }

            if (acao === "abrir-detalhes") {
                abrirModalDetalhes(registroId);
            }
        });

        elemento(IDS.historico)?.addEventListener("keydown", (evento) => {
            if (
                evento.key !== "Enter" &&
                evento.key !== " "
            ) {
                return;
            }

            const registro = evento.target.closest(
                '[data-acao="abrir-detalhes"][data-registro-id]'
            );

            if (!registro) {
                return;
            }

            evento.preventDefault();
            abrirModalDetalhes(registro.dataset.registroId);
        });

        elemento(IDS.detalhesFechar)?.addEventListener(
            "click",
            fecharModalDetalhes
        );

        elemento(IDS.modalDetalhes)?.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target ===
                    elemento(IDS.modalDetalhes)
                ) {
                    fecharModalDetalhes();
                }
            }
        );

        elemento(IDS.editarCancelar)?.addEventListener("click", fecharModalEditar);
        elemento(IDS.editarConfirmar)?.addEventListener("click", salvarEdicaoNotaFiscal);
        elemento(IDS.modalEditar)?.addEventListener("click", (evento) => {
            if (evento.target === elemento(IDS.modalEditar)) fecharModalEditar();
        });

        elemento(IDS.modalManual)?.addEventListener(
            "click",
            (evento) => {
                if (
                    evento.target ===
                    elemento(IDS.modalManual)
                ) {
                    fecharModalManual();
                }
            }
        );

        document.addEventListener(
            "keydown",
            (evento) => {
                if (evento.key !== "Escape") {
                    return;
                }

                if (elemento(IDS.modalDetalhes)?.classList.contains("aberto")) {
                    fecharModalDetalhes();
                    return;
                }

                if (elemento(IDS.modalEditar)?.classList.contains("aberto")) {
                    fecharModalEditar();
                    return;
                }

                if (
                    elemento(IDS.modalManual)
                        ?.classList
                        .contains("aberto")
                ) {
                    fecharModalManual();
                    return;
                }

                fecharTela();
            }
        );

        window.addEventListener(
            "listalar:nota-importada",
            receberNotaImportada
        );

        window.addEventListener(
            "listalar:nota-pdf-importada",
            receberNotaImportada
        );
    }

    window.ListaLarGastos = Object.freeze({
        versao: VERSAO,
        abrir: abrirTela,
        fechar: fecharTela,
        importarCompra: abrirImportadorPdf,
        importarNF: abrirImportadorPdf,
        abrirImportadorPdf,
        salvarCompraManual: abrirModalManual,
        obterResumoCompraManualAoFinalizar,
        salvarCompraManualAoFinalizar,
        editarNotaFiscal: abrirModalEditar,
        excluirNotaFiscal,
        abrirDetalhes: abrirModalDetalhes,
        obterFamiliaId() {
            return ESTADO.familiaId;
        },
        estaLiberado() {
            return ESTADO.liberado;
        },
        obterRegistros() {
            return [...ESTADO.registros];
        }
    });

    function iniciar() {
        criarEstilos();
        iniciarControleAcesso();

        console.log(
            `✅ Módulo Gastos carregado — versão ${VERSAO}`
        );
    }

    window.addEventListener(
        "beforeunload",
        pararHistorico
    );

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            iniciar,
            { once: true }
        );
    } else {
        iniciar();
    }
})();
