const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

exports.deleteMyAccount = onCall(
  { region: "southamerica-east1", timeoutSeconds: 540, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Entre novamente na sua conta para continuar.");
    }

    // Exige autenticação recente para reduzir o risco de exclusão por sessão abandonada.
    const authTime = Number(request.auth.token.auth_time || 0);
    const ageSeconds = Math.floor(Date.now() / 1000) - authTime;
    if (!authTime || ageSeconds > 5 * 60) {
      throw new HttpsError(
        "failed-precondition",
        "Por segurança, saia e entre novamente na conta antes de excluí-la."
      );
    }

    // O UID vem exclusivamente do token validado pelo Firebase, nunca do cliente.
    const uid = request.auth.uid;
    const db = getFirestore();
    const accountRef = db.collection("usuarios").doc(uid);

    try {
      // recursiveDelete remove também subcoleções e documentos descendentes.
      await db.recursiveDelete(accountRef);
    } catch (error) {
      console.error("Falha ao apagar dados Firestore da conta", uid, error);
      throw new HttpsError(
        "internal",
        "Não foi possível apagar os dados da conta. Nenhuma confirmação de exclusão foi emitida."
      );
    }

    try {
      await getAuth().deleteUser(uid);
    } catch (error) {
      console.error("Dados apagados, mas falhou a exclusão do usuário Authentication", uid, error);
      throw new HttpsError(
        "internal",
        "Os dados foram apagados, mas não foi possível concluir a exclusão do login. Entre em contato com o suporte."
      );
    }

    return { success: true };
  }
);
