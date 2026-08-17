from pathlib import Path


def substituir_unico(texto, antigo, novo, descricao):
    if antigo in texto:
        return texto.replace(antigo, novo, 1)
    if novo in texto:
        return texto
    raise SystemExit(f"Trecho não encontrado: {descricao}")


gastos = Path("gastos.js")
texto = gastos.read_text(encoding="utf-8")

texto = substituir_unico(
    texto,
    "// Versão: 3.2.3",
    "// Versão: 3.3.0",
    "versão do cabeçalho",
)
texto = substituir_unico(
    texto,
    'const VERSAO = "3.2.3";',
    'const VERSAO = "3.3.0";',
    "constante de versão",
)

seletor_antigo = '''                    <select
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
                    </select>'''

seletor_novo = '''                    <select
                        id="${IDS.seletorPeriodo}"
                        class="listalar-gastos-select"
                        aria-label="Mês do painel"
                    >
                        <option value="mes_atual">
                            Mês atual
                        </option>
                        <option value="todos">
                            Todos os meses
                        </option>
                    </select>'''

texto = substituir_unico(
    texto,
    seletor_antigo,
    seletor_novo,
    "seletor financeiro",
)

inicio = texto.find("    function inicioDoPeriodo(periodo) {")
fim = texto.find("    function atualizarFiltroMercados() {", inicio)

bloco_novo = r'''    function competenciaAtual() {
        const agora = new Date();
        return `${agora.getFullYear()}-${String(
            agora.getMonth() + 1
        ).padStart(2, "0")}`;
    }

    function competenciaDoRegistro(registro) {
        const competencia =
            String(registro?.competencia || "").trim();

        if (/^\d{4}-\d{2}$/.test(competencia)) {
            return competencia;
        }

        const data = converterParaData(
            registro?.dataCompraMs ||
            registro?.dataCompra
        );

        return competenciaDaData(data);
    }

    function rotuloCompetencia(competencia) {
        const correspondencia =
            String(competencia || "").match(
                /^(\d{4})-(\d{2})$/
            );

        if (!correspondencia) {
            return competencia || "";
        }

        const ano = Number(correspondencia[1]);
        const mes = Number(correspondencia[2]) - 1;
        const data = new Date(ano, mes, 1);

        const rotulo = data.toLocaleDateString(
            "pt-BR",
            {
                month: "long",
                year: "numeric"
            }
        );

        return rotulo.charAt(0).toUpperCase() +
            rotulo.slice(1);
    }

    function listarCompetenciasDisponiveis() {
        const atual = competenciaAtual();
        const competencias = new Set([atual]);

        ESTADO.registros.forEach((registro) => {
            const competencia =
                competenciaDoRegistro(registro);

            if (/^\d{4}-\d{2}$/.test(competencia)) {
                competencias.add(competencia);
            }
        });

        return [...competencias].sort(
            (a, b) => b.localeCompare(a)
        );
    }

    function atualizarSeletorMeses() {
        const select =
            elemento(IDS.seletorPeriodo);

        if (!select) {
            return;
        }

        if (
            ESTADO.periodo === "mes_atual" ||
            ESTADO.periodo === "ultimos_3_meses" ||
            ESTADO.periodo === "ano_atual"
        ) {
            ESTADO.periodo = competenciaAtual();
        }

        const competencias =
            listarCompetenciasDisponiveis();

        if (
            ESTADO.periodo !== "todos" &&
            !competencias.includes(ESTADO.periodo)
        ) {
            ESTADO.periodo = competenciaAtual();
        }

        select.innerHTML =
            competencias
                .map(
                    (competencia) =>
                        `<option value="${competencia}">${escaparHTML(
                            rotuloCompetencia(competencia)
                        )}</option>`
                )
                .join("") +
            `<option value="todos">Todos os meses</option>`;

        select.value = ESTADO.periodo;
    }

    function registrosFiltrados() {
        const busca =
            normalizarTexto(ESTADO.busca)
                .toLowerCase();

        const inicioCustom =
            ESTADO.dataInicial
                ? converterParaData(
                    ESTADO.dataInicial
                ).getTime()
                : null;

        const fimCustom =
            ESTADO.dataFinal
                ? converterParaData(
                    ESTADO.dataFinal
                ).getTime() + 86399999
                : null;

        return ESTADO.registros.filter(
            (registro) => {
                const data = numeroSeguro(
                    registro.dataCompraMs,
                    converterParaData(
                        registro.dataCompra
                    ).getTime()
                );

                if (
                    ESTADO.periodo !== "todos" &&
                    competenciaDoRegistro(registro) !==
                        ESTADO.periodo
                ) {
                    return false;
                }

                if (inicioCustom && data < inicioCustom) {
                    return false;
                }

                if (fimCustom && data > fimCustom) {
                    return false;
                }

                if (
                    ESTADO.mercado &&
                    registro.estabelecimentoNome !==
                        ESTADO.mercado
                ) {
                    return false;
                }

                if (busca) {
                    const alvo = normalizarTexto(
                        `${registro.estabelecimentoNome || ""} ${registro.valorTotal || ""} ${registro.dataCompra || ""}`
                    ).toLowerCase();

                    if (!alvo.includes(busca)) {
                        return false;
                    }
                }

                return true;
            }
        );
    }

'''

if inicio != -1 and fim != -1:
    texto = texto[:inicio] + bloco_novo + texto[fim:]
elif "function atualizarSeletorMeses()" not in texto:
    raise SystemExit("Bloco do filtro financeiro não encontrado.")

painel_antigo = '''        atualizarFiltroMercados();
        const registros = registrosFiltrados();'''
painel_novo = '''        atualizarSeletorMeses();
        atualizarFiltroMercados();
        const registros = registrosFiltrados();'''
texto = substituir_unico(
    texto,
    painel_antigo,
    painel_novo,
    "renderização do painel",
)

aviso_antigo = '''            const dataRegistro = converterParaData(registro.dataCompra || registro.dataCompraMs);
            const agora = new Date();
            const foraMesAtual = ESTADO.periodo === "mes_atual" &&
                (dataRegistro.getMonth() !== agora.getMonth() || dataRegistro.getFullYear() !== agora.getFullYear());
            mostrarAviso(
                foraMesAtual
                    ? "Compra salva, mas está fora do filtro deste mês."
                    : (registro.tipoRegistro === "nota_fiscal" ? "Nota fiscal salva com sucesso." : "Compra manual salva com sucesso."),
                foraMesAtual ? "info" : "sucesso"
            );'''

aviso_novo = '''            const competenciaRegistro =
                competenciaDoRegistro(registro);
            const foraMesSelecionado =
                ESTADO.periodo !== "todos" &&
                ESTADO.periodo !== "mes_atual" &&
                competenciaRegistro !== ESTADO.periodo;

            mostrarAviso(
                foraMesSelecionado
                    ? "Compra salva, mas está fora do mês selecionado."
                    : (
                        registro.tipoRegistro === "nota_fiscal"
                            ? "Nota fiscal salva com sucesso."
                            : "Compra manual salva com sucesso."
                    ),
                foraMesSelecionado ? "info" : "sucesso"
            );'''

if aviso_antigo in texto:
    texto = texto.replace(aviso_antigo, aviso_novo, 1)

gastos.write_text(texto, encoding="utf-8")

index = Path("index.html")
html = index.read_text(encoding="utf-8")
for antigo in (
    "./gastos.js?v=3.2.3",
    "./gastos.js?v=3.2.2",
    "./gastos.js?v=3.2.1",
):
    if antigo in html:
        html = html.replace(antigo, "./gastos.js?v=3.3.0", 1)
        break
else:
    if "./gastos.js?v=3.3.0" not in html:
        raise SystemExit("Referência de gastos.js não encontrada no index.")

index.write_text(html, encoding="utf-8")

Path("version.json").write_text(
    '''{
  "version": "1.0.28",
  "updatedAt": "2026-08-17",
  "notes": "Gastos agora abre no mês atual e permite selecionar meses anteriores"
}
''',
    encoding="utf-8",
)
