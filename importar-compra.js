/**
 * ListaLar — Seletor de Importação de Compra
 * Arquivo: importar-compra.js
 * Versão: 1.0.0
 *
 * Escolhe entre QR Code e PDF e encaminha para o módulo correto.
 * Não acessa Firebase, não lê QR Code e não interpreta PDF.
 */

(() => {
    "use strict";

    const VERSAO = "1.0.0";

    const IDS = {
        estilo: "listalar-importar-compra-estilo",
        overlay: "listalar-importar-compra-overlay",
        fechar: "listalar-importar-compra-fechar",
        qr: "listalar-importar-compra-qr",
        pdf: "listalar-importar-compra-pdf",
        aviso: "listalar-importar-compra-aviso"
    };

    const estado = {
        familiaId: "",
        modoImportacao: "nota_fiscal"
    };

    function criarEstilos() {
        if (document.getElementById(IDS.estilo)) {
            return;
        }

        const style = document.createElement("style");

        style.id = IDS.estilo;

        style.textContent = `
            body.listalar-importar-compra-aberto {
                overflow: hidden !important;
            }

            .ll-importar-overlay {
                position: fixed;
                inset: 0;
                z-index: 13000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(15, 23, 42, 0.64);
                backdrop-filter: blur(4px);
            }

            .ll-importar-modal {
                width: min(100%, 500px);
                max-height: calc(100vh - 36px);
                overflow: auto;
                border-radius: 22px;
                background: #ffffff;
                box-shadow:
                    0 24px 70px
                    rgba(15, 23, 42, 0.34);
            }

            .ll-importar-header {
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

            .ll-importar-titulo {
                display: flex;
                align-items: center;
                gap: 11px;
                min-width: 0;
            }

            .ll-importar-titulo-icone {
                display: grid;
                place-items: center;
                width: 42px;
                height: 42px;
                border-radius: 13px;
                background:
                    rgba(255, 255, 255, 0.17);
                font-size: 22px;
            }

            .ll-importar-header h2 {
                margin: 0;
                font-size: 20px;
            }

            .ll-importar-header p {
                margin: 3px 0 0;
                font-size: 12px;
                opacity: 0.87;
            }

            .ll-importar-fechar {
                display: grid;
                place-items: center;
                width: 40px;
                height: 40px;
                border: 0;
                border-radius: 50%;
                color: #ffffff;
                background:
                    rgba(255, 255, 255, 0.16);
                font: inherit;
                font-size: 24px;
                cursor: pointer;
            }

            .ll-importar-conteudo {
                padding: 18px;
            }

            .ll-importar-descricao {
                margin: 0 0 16px;
                color: #64748b;
                font-size: 14px;
                line-height: 1.5;
                text-align: center;
            }

            .ll-importar-opcoes {
                display: grid;
                gap: 11px;
            }

            .ll-importar-opcao {
                width: 100%;
                min-height: 76px;
                padding: 14px;
                border: 1px solid #dbe4f0;
                border-radius: 16px;
                color: #172033;
                background: #f8fafc;
                font: inherit;
                text-align: left;
                cursor: pointer;
                transition: 0.2s;
            }

            .ll-importar-opcao:hover {
                border-color: #2563eb;
                background: #eff6ff;
            }

            .ll-importar-opcao:active {
                transform: scale(0.985);
            }

            .ll-importar-opcao.destaque {
                border-color: #2563eb;
                color: #ffffff;
                background: #2563eb;
            }

            .ll-importar-opcao.destaque:hover {
                background: #1d4ed8;
            }

            .ll-importar-opcao-conteudo {
                display: flex;
                align-items: center;
                gap: 13px;
            }

            .ll-importar-opcao-icone {
                display: grid;
                place-items: center;
                flex: 0 0 auto;
                width: 46px;
                height: 46px;
                border-radius: 14px;
                background: #dbeafe;
                font-size: 23px;
            }

            .ll-importar-opcao.destaque
            .ll-importar-opcao-icone {
                background:
                    rgba(255, 255, 255, 0.18);
            }

            .ll-importar-opcao strong,
            .ll-importar-opcao small {
                display: block;
            }

            .ll-importar-opcao strong {
                font-size: 15px;
            }

            .ll-importar-opcao small {
                margin-top: 4px;
                color: #64748b;
                font-size: 12px;
                font-weight: 600;
                line-height: 1.35;
            }

            .ll-importar-opcao.destaque small {
                color:
                    rgba(255, 255, 255, 0.84);
            }

            .ll-importar-aviso {
                display: none;
                margin-top: 13px;
                padding: 12px;
                border-radius: 13px;
                color: #991b1b;
                background: #fee2e2;
                font-size: 13px;
                font-weight: 700;
                text-align: center;
            }

            .ll-importar-aviso.visivel {
                display: block;
            }

            @media (max-width: 600px) {
                .ll-importar-overlay {
                    align-items: flex-end;
                    padding: 0;
                }

                .ll-importar-modal {
                    width: 100%;
                    max-height: 94vh;
                    border-radius:
                        22px 22px 0 0;
                }
            }
        `;

        document.head.appendChild(style);
    }

    function obterImportadorQr() {
        return (
            window.ListaLarImportadorNfce ||
            window.ImportadorNFCe ||
            window.ImportadorNfceQR ||
            null
        );
    }

    function obterImportadorPdf() {
        return (
            window.ListaLarConferenciaNota ||
            window.ImportadorNotaPDF ||
            null
        );
    }

    function mostrarAviso(mensagem) {
        const aviso = document.getElementById(
            IDS.aviso
        );

        if (!aviso) {
            return;
        }

        aviso.textContent = mensagem;
        aviso.classList.add("visivel");
    }

    function fechar() {
        document
            .getElementById(IDS.overlay)
            ?.remove();

        document.body.classList.remove(
            "listalar-importar-compra-aberto"
        );
    }

    function emitirOrigem(origem) {
        window.dispatchEvent(
            new CustomEvent(
                "listalar:importacao-compra-origem-escolhida",
                {
                    detail: {
                        origem,
                        familiaId:
                            estado.familiaId,
                        modoImportacao:
                            estado.modoImportacao
                    }
                }
            )
        );
    }

    function reabrirComErro(mensagem) {
        window.setTimeout(() => {
            abrir(estado);
            mostrarAviso(mensagem);
        }, 0);
    }

    function abrirQrCode() {
        const importador =
            obterImportadorQr();

        if (
            !importador ||
            typeof importador.abrir !==
                "function"
        ) {
            mostrarAviso(
                "O leitor de QR Code da NFC-e ainda não está carregado."
            );

            console.error(
                "❌ ListaLarImportadorNfce.abrir() não foi encontrado."
            );

            return;
        }

        emitirOrigem("qr_code");
        fechar();

        try {
            importador.abrir({
                familiaId:
                    estado.familiaId,

                modoImportacao:
                    estado.modoImportacao
            });
        } catch (erro) {
            console.error(
                "❌ Erro ao abrir o leitor de QR Code:",
                erro
            );

            reabrirComErro(
                "Não foi possível abrir a câmera para ler a NFC-e."
            );
        }
    }

    function abrirPdf() {
        const importador =
            obterImportadorPdf();

        if (
            !importador ||
            typeof importador.abrir !==
                "function"
        ) {
            mostrarAviso(
                "O importador de PDF ainda não está carregado."
            );

            console.error(
                "❌ ImportadorNotaPDF.abrir() não foi encontrado."
            );

            return;
        }

        emitirOrigem("pdf");
        fechar();

        try {
            importador.abrir();
        } catch (erro) {
            console.error(
                "❌ Erro ao abrir o importador de PDF:",
                erro
            );

            reabrirComErro(
                "Não foi possível abrir o importador de PDF."
            );
        }
    }

    function criarModal() {
        criarEstilos();
        fechar();

        const overlay =
            document.createElement("div");

        overlay.id = IDS.overlay;
        overlay.className =
            "ll-importar-overlay";

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
            "ll-importar-titulo"
        );

        overlay.innerHTML = `
            <section class="ll-importar-modal">
                <header class="ll-importar-header">
                    <div class="ll-importar-titulo">
                        <div
                            class="ll-importar-titulo-icone"
                            aria-hidden="true"
                        >
                            🧾
                        </div>

                        <div>
                            <h2 id="ll-importar-titulo">
                                Importar compra
                            </h2>

                            <p>
                                Escolha como deseja
                                ler a nota fiscal
                            </p>
                        </div>
                    </div>

                    <button
                        id="${IDS.fechar}"
                        class="ll-importar-fechar"
                        type="button"
                        aria-label="Fechar"
                    >
                        ×
                    </button>
                </header>

                <div class="ll-importar-conteudo">
                    <p class="ll-importar-descricao">
                        Leia o QR Code da NFC-e ou
                        selecione o PDF salvo pelo
                        navegador.
                    </p>

                    <div class="ll-importar-opcoes">
                        <button
                            id="${IDS.qr}"
                            class="ll-importar-opcao destaque"
                            type="button"
                        >
                            <span
                                class="ll-importar-opcao-conteudo"
                            >
                                <span
                                    class="ll-importar-opcao-icone"
                                    aria-hidden="true"
                                >
                                    📷
                                </span>

                                <span>
                                    <strong>
                                        Ler QR Code da NFC-e
                                    </strong>

                                    <small>
                                        Usa a câmera e consulta
                                        a nota automaticamente
                                    </small>
                                </span>
                            </span>
                        </button>

                        <button
                            id="${IDS.pdf}"
                            class="ll-importar-opcao"
                            type="button"
                        >
                            <span
                                class="ll-importar-opcao-conteudo"
                            >
                                <span
                                    class="ll-importar-opcao-icone"
                                    aria-hidden="true"
                                >
                                    📄
                                </span>

                                <span>
                                    <strong>
                                        Selecionar PDF
                                    </strong>

                                    <small>
                                        Usa o importador de PDF
                                        já existente
                                    </small>
                                </span>
                            </span>
                        </button>
                    </div>

                    <div
                        id="${IDS.aviso}"
                        class="ll-importar-aviso"
                        role="alert"
                    ></div>
                </div>
            </section>
        `;

        document.body.appendChild(
            overlay
        );

        document.body.classList.add(
            "listalar-importar-compra-aberto"
        );

        document
            .getElementById(IDS.fechar)
            ?.addEventListener(
                "click",
                fechar
            );

        document
            .getElementById(IDS.qr)
            ?.addEventListener(
                "click",
                abrirQrCode
            );

        document
            .getElementById(IDS.pdf)
            ?.addEventListener(
                "click",
                abrirPdf
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

        window.setTimeout(() => {
            document
                .getElementById(IDS.qr)
                ?.focus();
        }, 0);
    }

    function abrir(opcoes = {}) {
        estado.familiaId = String(
            opcoes.familiaId || ""
        ).trim();

        estado.modoImportacao = String(
            opcoes.modoImportacao ||
            "nota_fiscal"
        ).trim() || "nota_fiscal";

        criarModal();
    }

    function obterContexto() {
        return {
            ...estado
        };
    }

    window.ListaLarImportadorCompra = {
        versao: VERSAO,
        abrir,
        fechar,
        abrirQrCode,
        abrirPdf,
        obterContexto
    };

    window.addEventListener(
        "listalar:abrir-importador-compra",
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
                document.getElementById(
                    IDS.overlay
                )
            ) {
                fechar();
            }
        }
    );

    console.log(
        `✅ Seletor de importação de compra carregado — versão ${VERSAO}`
    );
})();
