from pathlib import Path

path = Path('gastos.js')
texto = path.read_text(encoding='utf-8')

antigo = '''                .listalar-gastos-registro {
                    grid-template-columns:
                        auto minmax(0, 1fr);
                }

                .listalar-gastos-registro-valor {
                    grid-column: 2;
                }
'''

novo = '''                .listalar-gastos-registro {
                    grid-template-columns:
                        minmax(0, 1fr);
                }

                .listalar-gastos-registro-topo {
                    grid-template-columns:
                        minmax(0, 1fr) auto;
                }

                .listalar-gastos-registro-rodape {
                    width: 100%;
                    min-width: 0;
                }

                .listalar-gastos-registro-valor {
                    grid-column: auto;
                }

                .listalar-gastos-registro-acoes {
                    margin-left: auto;
                }
'''

if antigo not in texto:
    raise SystemExit('Bloco mobile esperado não encontrado; nenhuma alteração aplicada.')

texto = texto.replace(antigo, novo, 1)
texto = texto.replace('// Versão: 3.2.2', '// Versão: 3.2.3', 1)
texto = texto.replace('const VERSAO = "3.2.2";', 'const VERSAO = "3.2.3";', 1)
path.write_text(texto, encoding='utf-8')

Path('version.json').write_text('''{
  "version": "1.0.26",
  "updatedAt": "2026-08-10",
  "notes": "Correção responsiva dos cards do histórico de gastos"
}\n''', encoding='utf-8')
