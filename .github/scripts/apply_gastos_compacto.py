from pathlib import Path
import re

path = Path("gastos.js")
texto = path.read_text(encoding="utf-8")

if 'Versão: 3.2.2' in texto and 'const VERSAO = "3.2.2";' in texto:
    print("gastos.js já está na versão 3.2.2")
    raise SystemExit(0)

if 'Versão: 3.2.1' not in texto or 'const VERSAO = "3.2.1";' not in texto:
    raise SystemExit("Versão base inesperada. Alteração cancelada.")

texto = texto.replace("// Versão: 3.2.1", "// Versão: 3.2.2", 1)
texto = texto.replace('const VERSAO = "3.2.1";', 'const VERSAO = "3.2.2";', 1)

css_novo = r'''            .listalar-gastos-historico-lista {
                display: grid;
                gap: 10px;
            }

            .listalar-gastos-registro {
                display: grid;
                grid-template-columns: minmax(0, 1fr);
                gap: 7px;
                align-items: center;
                padding: 10px 12px;
                border: 1px solid #cfe0f5;
                border-left: 5px solid #7c3aed;
                border-radius: 14px;
                background: linear-gradient(135deg, #ffffff, #f5f3ff);
                box-shadow: 0 5px 14px rgba(15, 23, 42, .06);
            }

            .listalar-gastos-registro.manual {
                border-left-color: #16a34a;
                background: linear-gradient(135deg, #ffffff, #f0fdf4);
            }

            .listalar-gastos-registro-topo {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 9px;
                align-items: start;
                min-width: 0;
            }

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

            .listalar-gastos-registro-data {
                padding-top: 1px;
                color: #64748b;
                font-size: 11px;
                font-weight: 600;
                white-space: nowrap;
            }

            .listalar-gastos-registro-rodape {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
            }

            .listalar-gastos-registro-valor {
                flex: 0 0 auto;
                font-size: 14px;
                font-weight: 900;
                white-space: nowrap;
            }

            .listalar-gastos-registro-quantidade {
                flex: 0 1 auto;
                color: #64748b;
                font-size: 11px;
                white-space: nowrap;
            }

            .listalar-gastos-registro-acoes {
                display: flex;
                gap: 6px;
                margin-left: auto;
                flex: 0 0 auto;
            }

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

'''

padrao_css = re.compile(
    r'            \.listalar-gastos-historico-lista \{.*?(?=            \.listalar-gastos-detalhes-resumo \{)',
    re.S,
)
texto, qtd_css = padrao_css.subn(lambda _: css_novo, texto, count=1)
if qtd_css != 1:
    raise SystemExit(f"Bloco CSS esperado não encontrado ({qtd_css}). Alteração cancelada.")

funcao_nova = r'''    function renderizarHistorico(registros) {
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
                        <div class="listalar-gastos-registro-topo">
                            <div class="listalar-gastos-registro-conteudo">
                                <strong title="${escaparHTML(estabelecimento)}">
                                    ${escaparHTML(estabelecimento)}
                                </strong>
                            </div>

                            <time class="listalar-gastos-registro-data">
                                ${escaparHTML(
                                    formatarData(
                                        registro.dataCompra ||
                                        registro.dataCompraMs
                                    )
                                )}
                            </time>
                        </div>

                        <div class="listalar-gastos-registro-rodape">
                            <div class="listalar-gastos-registro-valor">
                                ${formatarMoeda(registro.valorTotal)}
                            </div>

                            <div class="listalar-gastos-registro-quantidade">
                                ${quantidade}
                                ${quantidade === 1 ? "item" : "itens"}
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

'''

padrao_funcao = re.compile(
    r'    function renderizarHistorico\(registros\) \{.*?(?=    function renderizarPainel\(\) \{)',
    re.S,
)
texto, qtd_funcao = padrao_funcao.subn(lambda _: funcao_nova, texto, count=1)
if qtd_funcao != 1:
    raise SystemExit(f"Função renderizarHistorico não encontrada ({qtd_funcao}). Alteração cancelada.")

if "listalar-gastos-registro-dica" in texto:
    raise SystemExit("Trecho antigo de dica ainda está presente. Alteração cancelada.")

path.write_text(texto, encoding="utf-8")
print("gastos.js atualizado para 3.2.2")
