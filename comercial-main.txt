// ListaLar Comercial 1.3.3 — inicialização, acesso e listeners
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  auth, ESTADO, $, refs, verificarAcesso, status, VERSAO
} from "./comercial-contexto.js?v=1.2.0";
import {
  renderProdutos, renderMovimentos, renderPeriodos
} from "./comercial-render.js?v=1.3.3";
import { configurarEventosOperacoes } from "./comercial-operacoes.js?v=1.2.0";

function iniciarListeners() {
  ESTADO.unsubscribeProdutos?.();
  ESTADO.unsubscribeMovimentos?.();

  const r = refs();

  ESTADO.unsubscribeProdutos = onSnapshot(
    query(r.produtos, orderBy("nome")),
    (snap) => {
      ESTADO.produtos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderProdutos();
      status("");
    },
    (erro) => {
      console.error(erro);
      status("Não foi possível carregar os produtos comerciais.", true);
    }
  );

  ESTADO.unsubscribeMovimentos = onSnapshot(
    query(r.movimentos, orderBy("criadoEm", "desc")),
    (snap) => {
      ESTADO.movimentos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderMovimentos();
      status("");
    },
    (erro) => {
      console.error(erro);
      status("Não foi possível carregar as movimentações comerciais.", true);
    }
  );
}

onAuthStateChanged(auth, async (usuario) => {
  if (!usuario) {
    window.location.href = "./index.html";
    return;
  }

  ESTADO.usuario = usuario;
  status("Validando acesso ao Comercial...");

  try {
    ESTADO.permitido = await verificarAcesso(usuario);

    if (!ESTADO.permitido) {
      $("appComercial").hidden = true;
      $("acessoNegado").hidden = false;
      return;
    }

    $("acessoNegado").hidden = true;
    $("appComercial").hidden = false;
    $("btnAdminComercial").hidden = !ESTADO.adminSistema;

    configurarEventosOperacoes();
    renderPeriodos();
    iniciarListeners();
  } catch (erro) {
    console.error(erro);
    $("appComercial").hidden = true;
    $("acessoNegado").hidden = false;
  }
});

window.addEventListener("beforeunload", () => {
  ESTADO.unsubscribeProdutos?.();
  ESTADO.unsubscribeMovimentos?.();
});

console.log(`✅ Comercial independente ${VERSAO}`);
