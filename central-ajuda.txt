// ============================================================
// ListaLar - Central de Ajuda 3.0.0
// UI pesquisável carregada pela interrogação principal.
// ============================================================

import { AJUDA_CATEGORIAS } from './central-ajuda-conteudo.js?v=3.0.0';

const ESTADO = { aberta:false, categoria:null, overflow:'', foco:null };
const el = (id) => document.getElementById(id);

function normalizar(texto) {
  return String(texto || '').toLocaleLowerCase('pt-BR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
}

function criarEstilos() {
  if (el('centralAjudaCss')) return;
  const s = document.createElement('style');
  s.id = 'centralAjudaCss';
  s.textContent = `
    .central-ajuda-botao{position:fixed;right:16px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:9000;width:52px;height:52px;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:linear-gradient(135deg,#2563eb,#06b6d4);color:#fff;font-size:25px;font-weight:900;cursor:pointer;box-shadow:0 10px 25px rgba(37,99,235,.30)}
    .central-ajuda-botao:active,.central-ajuda-categoria:active{transform:scale(.97)}
    .central-ajuda-fundo{position:fixed;inset:0;z-index:10000;display:none;align-items:flex-end;justify-content:center;background:rgba(15,23,42,.62);backdrop-filter:blur(5px)}
    .central-ajuda-fundo.aberto{display:flex}
    .central-ajuda-painel{width:100%;max-width:720px;max-height:94dvh;display:flex;flex-direction:column;overflow:hidden;border-radius:25px 25px 0 0;background:#f8fafc;color:#172033;box-shadow:0 -20px 60px rgba(15,23,42,.30)}
    .central-ajuda-topo{padding:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#fff;background:linear-gradient(135deg,#2563eb,#06b6d4)}
    .central-ajuda-topo h2{margin:0;font-size:21px}.central-ajuda-topo p{margin:4px 0 0;font-size:12px;font-weight:700;opacity:.92}
    .central-ajuda-fechar{width:40px;height:40px;border:1px solid rgba(255,255,255,.45);border-radius:13px;background:rgba(255,255,255,.14);color:#fff;font-size:24px;font-weight:900;cursor:pointer}
    .central-ajuda-corpo{min-height:0;flex:1;padding:15px;overflow:auto;overscroll-behavior:contain}.central-ajuda-inicio.oculto,.central-ajuda-detalhe{display:none}.central-ajuda-detalhe.aberto{display:block}
    .central-ajuda-intro{margin-bottom:13px;padding:15px;border:1px solid #bfdbfe;border-radius:17px;background:#eff6ff}.central-ajuda-intro strong{color:#1d4ed8}.central-ajuda-intro p{margin:5px 0 0;color:#475569;font-size:13px;font-weight:700}
    .central-ajuda-busca{width:100%;min-height:48px;margin-bottom:13px;padding:0 14px;border:2px solid #dbeafe;border-radius:14px;outline:0;background:#fff;color:#172033;font-size:14px;font-weight:700}.central-ajuda-busca:focus{border-color:#2563eb}
    .central-ajuda-categorias{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.central-ajuda-categoria{min-width:0;padding:14px;display:flex;align-items:flex-start;gap:11px;border:1px solid #dbeafe;border-radius:17px;background:#fff;color:#172033;text-align:left;cursor:pointer;box-shadow:0 5px 14px rgba(15,23,42,.06)}
    .central-ajuda-categoria-icone{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;border-radius:14px;background:#eff6ff;font-size:22px}.central-ajuda-categoria-texto{min-width:0}.central-ajuda-categoria strong{display:block;font-size:13px;font-weight:900}.central-ajuda-categoria-texto span{display:block;margin-top:5px;color:#64748b;font-size:11px;font-weight:700;line-height:1.35}
    .central-ajuda-sem{grid-column:1/-1;padding:25px;border:1px dashed #bfdbfe;border-radius:16px;color:#64748b;text-align:center;font-weight:800}
    .central-ajuda-voltar{min-height:42px;margin-bottom:12px;padding:8px 13px;border:0;border-radius:12px;background:#e0e7ff;color:#3730a3;font-size:13px;font-weight:900;cursor:pointer}
    .central-ajuda-conteudo{padding:17px;border:1px solid #dbeafe;border-radius:18px;background:#fff;box-shadow:0 5px 14px rgba(15,23,42,.05)}
    .central-ajuda-conteudo h3{margin:0 0 15px;color:#1e3a8a;font-size:21px}.central-ajuda-conteudo h4{margin:17px 0 6px;font-size:15px}.central-ajuda-conteudo p{margin:0 0 10px;color:#475569;font-size:14px;font-weight:600;line-height:1.55}.central-ajuda-conteudo ol,.central-ajuda-conteudo ul{margin:8px 0 13px;padding-left:22px;color:#475569;font-size:14px;font-weight:600;line-height:1.55}.central-ajuda-conteudo li{margin-bottom:7px}
    .aj-escolhas{display:grid;gap:9px;margin:12px 0}.aj-escolhas>div{padding:12px;border:1px solid #dbeafe;border-radius:14px;background:#f8fafc}.aj-escolhas strong{color:#1d4ed8}.aj-escolhas p{margin:4px 0 0}.aj-exemplos{display:grid;gap:8px;margin:8px 0 14px}.aj-exemplos p{margin:0;padding:10px;border-left:4px solid #2563eb;background:#eff6ff;color:#1e3a8a;font-weight:800}.formula,aside{margin-top:13px;padding:12px;border-radius:13px;font-size:13px;font-weight:800;line-height:1.45}.formula{border:1px solid #bfdbfe;background:#eff6ff;color:#1e3a8a;text-align:center}aside{border:1px solid #fde68a;background:#fef3c7;color:#92400e}aside.ok{border-color:#86efac;background:#dcfce7;color:#166534}.faq{padding:11px 0;border-bottom:1px solid #dbeafe}.faq p{margin:4px 0 0}
    .central-ajuda-rodape{padding:12px 15px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid #dbeafe;background:#fff}.central-ajuda-whatsapp{min-height:48px;display:flex;align-items:center;justify-content:center;border-radius:15px;background:#16a34a;color:#fff;text-decoration:none;font-size:14px;font-weight:900}
    .central-ajuda-botao:focus-visible,.central-ajuda-fechar:focus-visible,.central-ajuda-voltar:focus-visible,.central-ajuda-categoria:focus-visible,.central-ajuda-whatsapp:focus-visible{outline:3px solid rgba(37,99,235,.35);outline-offset:3px}
    @media(min-width:700px){.central-ajuda-fundo{align-items:center;padding:18px}.central-ajuda-painel{max-height:min(820px,calc(100vh - 36px));border-radius:25px}.central-ajuda-botao{bottom:24px}}
    @media(max-width:430px){.central-ajuda-categorias{grid-template-columns:1fr}.central-ajuda-corpo{padding:12px}.central-ajuda-conteudo{padding:15px}}
  `;
  document.head.appendChild(s);
}

function renderizar(busca='') {
  const area = el('centralAjudaCategorias');
  if (!area) return;
  const termo = normalizar(busca);
  const lista = AJUDA_CATEGORIAS.filter(c => !termo || normalizar(`${c.titulo} ${c.descricao} ${c.conteudo}`).includes(termo));
  area.innerHTML = lista.length ? lista.map(c => `<button type="button" class="central-ajuda-categoria" data-ajuda="${c.id}"><span class="central-ajuda-categoria-icone">${c.icone}</span><span class="central-ajuda-categoria-texto"><strong>${c.titulo}</strong><span>${c.descricao}</span></span></button>`).join('') : '<div class="central-ajuda-sem">Nenhum assunto encontrado.</div>';
  area.querySelectorAll('[data-ajuda]').forEach(b => b.addEventListener('click',() => abrirCategoria(b.dataset.ajuda)));
}

function abrirCategoria(id) {
  const c = AJUDA_CATEGORIAS.find(x => x.id === id);
  if (!c) return;
  ESTADO.categoria = id;
  el('centralAjudaInicio')?.classList.add('oculto');
  el('centralAjudaDetalhe')?.classList.add('aberto');
  if (el('centralAjudaConteudo')) el('centralAjudaConteudo').innerHTML = c.conteudo;
  const corpo = el('centralAjudaDetalhe')?.closest('.central-ajuda-corpo');
  if (corpo) corpo.scrollTop = 0;
  el('centralAjudaVoltar')?.focus();
}

function inicio() {
  ESTADO.categoria = null;
  el('centralAjudaInicio')?.classList.remove('oculto');
  el('centralAjudaDetalhe')?.classList.remove('aberto');
  const busca = el('centralAjudaBusca');
  if (busca) busca.value = '';
  renderizar();
  if (ESTADO.aberta) busca?.focus();
}

function abrir(categoria=null) {
  const fundo = el('centralAjudaFundo');
  if (!fundo) return;
  if (!ESTADO.aberta) { ESTADO.overflow = document.body.style.overflow; ESTADO.foco = document.activeElement; }
  ESTADO.aberta = true;
  fundo.classList.add('aberto');
  fundo.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  categoria ? abrirCategoria(categoria) : inicio();
}

function fechar() {
  if (!ESTADO.aberta) return;
  ESTADO.aberta = false;
  el('centralAjudaFundo')?.classList.remove('aberto');
  el('centralAjudaFundo')?.setAttribute('aria-hidden','true');
  document.body.style.overflow = ESTADO.overflow;
  if (ESTADO.foco && typeof ESTADO.foco.focus === 'function') ESTADO.foco.focus();
}

function criarInterface() {
  if (el('centralAjudaFundo')) return;
  const botao = document.createElement('button');
  botao.id='centralAjudaBotao'; botao.type='button'; botao.className='central-ajuda-botao'; botao.textContent='?'; botao.title='Central de Ajuda'; botao.setAttribute('aria-label','Abrir Central de Ajuda'); botao.addEventListener('click',()=>abrir());
  document.body.appendChild(botao);

  const fundo = document.createElement('div');
  fundo.id='centralAjudaFundo'; fundo.className='central-ajuda-fundo'; fundo.setAttribute('aria-hidden','true');
  fundo.innerHTML=`<section class="central-ajuda-painel" role="dialog" aria-modal="true" aria-labelledby="centralAjudaTitulo"><header class="central-ajuda-topo"><div><h2 id="centralAjudaTitulo">❓ Central de Ajuda</h2><p>Manual atualizado dos recursos do ListaLar.</p></div><button id="centralAjudaFechar" class="central-ajuda-fechar" type="button" aria-label="Fechar">×</button></header><main class="central-ajuda-corpo"><div id="centralAjudaInicio" class="central-ajuda-inicio"><div class="central-ajuda-intro"><strong>Como podemos ajudar?</strong><p>Escolha uma função ou pesquise pelo recurso.</p></div><input id="centralAjudaBusca" class="central-ajuda-busca" type="search" placeholder="🔎 Buscar na ajuda" autocomplete="off"><div id="centralAjudaCategorias" class="central-ajuda-categorias"></div></div><div id="centralAjudaDetalhe" class="central-ajuda-detalhe"><button id="centralAjudaVoltar" class="central-ajuda-voltar" type="button">← Voltar para os assuntos</button><article id="centralAjudaConteudo" class="central-ajuda-conteudo"></article></div></main><footer class="central-ajuda-rodape"><a class="central-ajuda-whatsapp" href="https://wa.me/5531982967250?text=Olá!%20Preciso%20de%20ajuda%20com%20o%20ListaLar." target="_blank" rel="noopener noreferrer">💬 Falar com o suporte</a></footer></section>`;
  document.body.appendChild(fundo);

  el('centralAjudaFechar')?.addEventListener('click',fechar);
  el('centralAjudaVoltar')?.addEventListener('click',inicio);
  el('centralAjudaBusca')?.addEventListener('input',e=>renderizar(e.target.value));
  fundo.addEventListener('click',e=>{if(e.target===fundo)fechar();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ESTADO.aberta)fechar();});
  renderizar();
}

function instalar(){ criarEstilos(); criarInterface(); }
window.abrirCentralAjuda=(categoria=null)=>abrir(categoria);
window.fecharCentralAjuda=()=>fechar();
window.ListaLarAjuda=Object.freeze({versao:'3.0.0',abrir,fechar,abrirCategoria,instalar});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',instalar,{once:true});else instalar();
