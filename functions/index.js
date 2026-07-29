// ============================================================================
// LISTALAR - CLOUD FUNCTIONS
// ARQUIVO: functions/index.js
//
// ETAPA 1:
// Exclusão administrativa de usuário.
//
// SEGURANÇA:
// - Exige usuário autenticado.
// - Exige usuarios/{uid}.adminSistema == true.
// - Impede o administrador de excluir a própria conta.
// - Impede excluir outro administrador do sistema.
// - Impede excluir o proprietário da família.
// - Toda exclusão ocorre no servidor com Firebase Admin SDK.
// ============================================================================

const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const logger = require("firebase-functions/logger");

const {
  initializeApp
} = require("firebase-admin/app");

const {
  getFirestore,
  FieldValue
} = require("firebase-admin/firestore");

const {
  getAuth
} = require("firebase-admin/auth");

// Inicializa o Firebase Admin apenas uma vez.
initializeApp();

const db = getFirestore();
const authAdmin = getAuth();

// A função ficará na região de São Paulo.
// O mesmo nome de região será usado no admin-exclusoes.js.
const REGIAO_FUNCOES = "southamerica-east1";

// Limite seguro para operações em lote.
// O Firestore permite até 500 operações por batch.
// Utilizamos 400 para manter margem de segurança.
const LIMITE_OPERACOES_BATCH = 400;

/**
 * Valida o UID recebido.
 *
 * @param {unknown} valor
 * @returns {string}
 */
function validarUid(valor) {
  const uid = String(valor || "").trim();

  if (!uid) {
    throw new HttpsError(
      "invalid-argument",
      "O UID do usuário não foi informado."
    );
  }

  if (uid.length > 128) {
    throw new HttpsError(
      "invalid-argument",
      "O UID informado é inválido."
    );
  }

  if (uid.includes("/")) {
    throw new HttpsError(
      "invalid-argument",
      "O UID informado contém caracteres inválidos."
    );
  }

  return uid;
}

/**
 * Confere se quem chamou a função é administrador do sistema.
 *
 * A validação é realizada no servidor.
 *
 * @param {string} uidAdministrador
 * @returns {Promise<Object>}
 */
async function validarAdministradorSistema(uidAdministrador) {
  const administradorRef = db
    .collection("usuarios")
    .doc(uidAdministrador);

  const administradorSnap = await administradorRef.get();

  if (!administradorSnap.exists) {
    throw new HttpsError(
      "permission-denied",
      "O cadastro administrativo não foi localizado."
    );
  }

  const dadosAdministrador = administradorSnap.data() || {};

  if (dadosAdministrador.adminSistema !== true) {
    throw new HttpsError(
      "permission-denied",
      "Somente o administrador do sistema pode executar esta ação."
    );
  }

  return dadosAdministrador;
}

/**
 * Divide uma lista em blocos menores.
 *
 * @param {Array} lista
 * @param {number} tamanho
 * @returns {Array<Array>}
 */
function dividirEmBlocos(lista, tamanho) {
  const blocos = [];

  for (
    let indice = 0;
    indice < lista.length;
    indice += tamanho
  ) {
    blocos.push(
      lista.slice(indice, indice + tamanho)
    );
  }

  return blocos;
}

/**
 * Remove documentos usando batches do Firestore.
 *
 * A exclusão de um documento inexistente não causa problema.
 *
 * @param {Array<FirebaseFirestore.DocumentReference>} referencias
 */
async function excluirReferenciasEmLotes(referencias) {
  const referenciasUnicas = new Map();

  referencias.forEach((referencia) => {
    if (!referencia || !referencia.path) {
      return;
    }

    referenciasUnicas.set(
      referencia.path,
      referencia
    );
  });

  const listaFinal = Array.from(
    referenciasUnicas.values()
  );

  const blocos = dividirEmBlocos(
    listaFinal,
    LIMITE_OPERACOES_BATCH
  );

  for (const bloco of blocos) {
    const batch = db.batch();

    bloco.forEach((referencia) => {
      batch.delete(referencia);
    });

    await batch.commit();
  }
}

/**
 * Remove todas as ocorrências do usuário nas subcoleções membros.
 *
 * Isso também limpa registros antigos deixados caso o usuário tenha
 * participado de outra família anteriormente.
 *
 * @param {string} uidAlvo
 * @param {string} familiaIdAtual
 * @returns {Promise<Array<FirebaseFirestore.DocumentReference>>}
 */
async function localizarMembrosDoUsuario(
  uidAlvo,
  familiaIdAtual
) {
  const referencias = [];

  // Garante a inclusão do vínculo principal conhecido.
  if (familiaIdAtual) {
    referencias.push(
      db
        .collection("familias")
        .doc(familiaIdAtual)
        .collection("membros")
        .doc(uidAlvo)
    );
  }

  // Procura possíveis vínculos antigos em outras famílias.
  const membrosSnap = await db
    .collectionGroup("membros")
    .where("uid", "==", uidAlvo)
    .get();

  membrosSnap.forEach((documento) => {
    referencias.push(documento.ref);
  });

  return referencias;
}

/**
 * Localiza convites criados pelo usuário.
 *
 * @param {string} uidAlvo
 * @returns {Promise<Array<FirebaseFirestore.QueryDocumentSnapshot>>}
 */
async function localizarConvitesCriados(uidAlvo) {
  const convitesSnap = await db
    .collection("convites")
    .where("criadoPorUid", "==", uidAlvo)
    .get();

  return convitesSnap.docs;
}

/**
 * Limpa o campo conviteTokenAtivo das famílias quando o convite
 * ativo tiver sido criado pelo usuário que será excluído.
 *
 * @param {Array<FirebaseFirestore.QueryDocumentSnapshot>} convites
 */
async function limparConvitesAtivosDasFamilias(
  convites
) {
  const familiasParaVerificar = new Map();

  convites.forEach((conviteSnap) => {
    const convite = conviteSnap.data() || {};

    const familiaId = String(
      convite.familiaId || ""
    ).trim();

    if (!familiaId) {
      return;
    }

    if (!familiasParaVerificar.has(familiaId)) {
      familiasParaVerificar.set(
        familiaId,
        {
          familiaRef: db
            .collection("familias")
            .doc(familiaId),

          tokensExcluidos: new Set()
        }
      );
    }

    familiasParaVerificar
      .get(familiaId)
      .tokensExcluidos
      .add(conviteSnap.id);
  });

  for (
    const {
      familiaRef,
      tokensExcluidos
    } of familiasParaVerificar.values()
  ) {
    const familiaSnap = await familiaRef.get();

    if (!familiaSnap.exists) {
      continue;
    }

    const familia = familiaSnap.data() || {};

    const tokenAtivo = String(
      familia.conviteTokenAtivo || ""
    ).trim();

    if (
      tokenAtivo &&
      tokensExcluidos.has(tokenAtivo)
    ) {
      await familiaRef.update({
        conviteTokenAtivo:
          FieldValue.delete(),

        conviteAtualizadoEm:
          FieldValue.delete(),

        atualizadaEm:
          FieldValue.serverTimestamp()
      });
    }
  }
}

/**
 * Exclui a conta do Firebase Authentication.
 *
 * Caso a conta já não exista no Authentication, a limpeza é
 * considerada concluída.
 *
 * @param {string} uidAlvo
 * @returns {Promise<boolean>}
 */
async function excluirContaAuthentication(uidAlvo) {
  try {
    await authAdmin.deleteUser(uidAlvo);

    return true;
  } catch (erro) {
    if (erro?.code === "auth/user-not-found") {
      logger.warn(
        "Conta não encontrada no Authentication.",
        {
          uidAlvo
        }
      );

      return false;
    }

    throw erro;
  }
}

// ============================================================================
// FUNÇÃO CALLABLE: EXCLUIR USUÁRIO
// ============================================================================

exports.excluirUsuarioAdministrativo = onCall(
  {
    region: REGIAO_FUNCOES,
    timeoutSeconds: 120,
    memory: "256MiB",

    // Poderemos mudar para true depois que o App Check
    // estiver configurado no ListaLar.
    enforceAppCheck: false
  },

  async (request) => {
    const uidAdministrador =
      request.auth?.uid || "";

    if (!uidAdministrador) {
      throw new HttpsError(
        "unauthenticated",
        "É necessário estar autenticado."
      );
    }

    await validarAdministradorSistema(
      uidAdministrador
    );

    const uidAlvo = validarUid(
      request.data?.uid
    );

    if (uidAlvo === uidAdministrador) {
      throw new HttpsError(
        "failed-precondition",
        "Você não pode excluir sua própria conta administrativa."
      );
    }

    const usuarioAlvoRef = db
      .collection("usuarios")
      .doc(uidAlvo);

    const usuarioAlvoSnap =
      await usuarioAlvoRef.get();

    if (!usuarioAlvoSnap.exists) {
      throw new HttpsError(
        "not-found",
        "O usuário não foi encontrado no Firestore."
      );
    }

    const usuarioAlvo =
      usuarioAlvoSnap.data() || {};

    if (usuarioAlvo.adminSistema === true) {
      throw new HttpsError(
        "failed-precondition",
        "Uma conta administradora do sistema não pode ser excluída por esta função."
      );
    }

    const familiaId = String(
      usuarioAlvo.familiaId || ""
    ).trim();

    const papel = String(
      usuarioAlvo.papel || ""
    )
      .trim()
      .toLowerCase();

    let familia = null;

    if (familiaId) {
      const familiaRef = db
        .collection("familias")
        .doc(familiaId);

      const familiaSnap =
        await familiaRef.get();

      if (familiaSnap.exists) {
        familia =
          familiaSnap.data() || {};

        if (familia.donoId === uidAlvo) {
          throw new HttpsError(
            "failed-precondition",
            "O proprietário da família não pode ser excluído individualmente. Utilize a futura função Excluir Família."
          );
        }
      }
    }

    if (papel === "admin") {
      throw new HttpsError(
        "failed-precondition",
        "O administrador da família não pode ser excluído individualmente. Utilize a futura função Excluir Família."
      );
    }

    const nomeUsuario = String(
      usuarioAlvo.nome || ""
    ).trim();

    const emailUsuario = String(
      usuarioAlvo.email || ""
    ).trim();

    let limpezaFirestoreConcluida = false;

    try {
      logger.info(
        "Iniciando exclusão administrativa de usuário.",
        {
          uidAdministrador,
          uidAlvo,
          familiaId,
          emailUsuario
        }
      );

      // ----------------------------------------------------------------------
      // 1. Localiza todos os vínculos do usuário nas famílias.
      // ----------------------------------------------------------------------

      const referenciasMembros =
        await localizarMembrosDoUsuario(
          uidAlvo,
          familiaId
        );

      // ----------------------------------------------------------------------
      // 2. Localiza convites criados pelo usuário.
      // ----------------------------------------------------------------------

      const convitesCriados =
        await localizarConvitesCriados(
          uidAlvo
        );

      // ----------------------------------------------------------------------
      // 3. Limpa conviteTokenAtivo da família, quando necessário.
      // ----------------------------------------------------------------------

      await limparConvitesAtivosDasFamilias(
        convitesCriados
      );

      // ----------------------------------------------------------------------
      // 4. Exclui vínculos de membros e convites criados.
      // ----------------------------------------------------------------------

      const referenciasParaExcluir = [
        ...referenciasMembros,

        ...convitesCriados.map(
          (conviteSnap) =>
            conviteSnap.ref
        )
      ];

      await excluirReferenciasEmLotes(
        referenciasParaExcluir
      );

      // ----------------------------------------------------------------------
      // 5. Exclui usuarios/{uid} e possíveis subcoleções.
      // ----------------------------------------------------------------------

      await db.recursiveDelete(
        usuarioAlvoRef
      );

      limpezaFirestoreConcluida = true;

      // ----------------------------------------------------------------------
      // 6. Exclui a conta do Firebase Authentication.
      // ----------------------------------------------------------------------

      const contaAuthExistia =
        await excluirContaAuthentication(
          uidAlvo
        );

      logger.info(
        "Usuário excluído administrativamente.",
        {
          uidAdministrador,
          uidAlvo,
          familiaId,
          emailUsuario,

          membrosRemovidos:
            referenciasMembros.length,

          convitesRemovidos:
            convitesCriados.length,

          contaAuthExistia
        }
      );

      return {
        sucesso: true,
        uid: uidAlvo,
        nome: nomeUsuario,
        email: emailUsuario,
        familiaId,

        membrosRemovidos:
          referenciasMembros.length,

        convitesRemovidos:
          convitesCriados.length,

        contaAuthenticationRemovida:
          contaAuthExistia,

        mensagem:
          "Usuário excluído com sucesso."
      };
    } catch (erro) {
      logger.error(
        "Erro na exclusão administrativa de usuário.",
        {
          uidAdministrador,
          uidAlvo,
          familiaId,
          limpezaFirestoreConcluida,

          erro:
            erro?.message ||
            String(erro)
        }
      );

      if (erro instanceof HttpsError) {
        throw erro;
      }

      if (limpezaFirestoreConcluida) {
        throw new HttpsError(
          "internal",
          "Os dados do Firestore foram removidos, mas houve uma falha ao excluir a conta do Firebase Authentication.",
          {
            etapa: "authentication",
            uid: uidAlvo
          }
        );
      }

      throw new HttpsError(
        "internal",
        "Não foi possível concluir a exclusão do usuário.",
        {
          etapa: "firestore",
          uid: uidAlvo
        }
      );
    }
  }
);


// ============================================================================
// NFC-e
// ============================================================================

const {
  consultarNfce
} = require("./nfce");

exports.consultarNfce =
  consultarNfce;


// ============================================================================
// NOTIFICAÇÕES ADMINISTRATIVAS
// ============================================================================

const {
  registrarDispositivoAdmin,
  notificarNovaFamiliaAdmin,
} = require("./notificacoes-admin");

exports.registrarDispositivoAdmin =
  registrarDispositivoAdmin;

exports.notificarNovaFamiliaAdmin =
  notificarNovaFamiliaAdmin;
