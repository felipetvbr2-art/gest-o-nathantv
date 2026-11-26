const admin = require("firebase-admin");

function saoPauloDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== "literal").map(p => [p.type, p.value]));
}

function tomorrowInSaoPaulo() {
  const p = saoPauloDateParts();
  const tomorrow = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + 1));
  return tomorrow.toISOString().slice(0, 10);
}

async function listAllAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Configure o segredo FIREBASE_SERVICE_ACCOUNT_JSON no GitHub.");
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log(`Projeto Firebase configurado: ${serviceAccount.project_id || "não informado"}`);

  const db = admin.firestore();
  const auth = admin.auth();
  const messaging = admin.messaging();
  const dueDate = tomorrowInSaoPaulo();

  // Os documentos do app ficam em usuarios/{uid}/dados/principal e
  // usuarios/{uid}/perfil/principal. A coleção usuarios na raiz não é
  // uma lista de contas; por isso buscamos os UIDs no Firebase Authentication.
  const users = await listAllAuthUsers(auth);
  console.log(`Contas encontradas no Firebase Authentication: ${users.length}`);
  console.log(`Verificando clientes com vencimento em ${dueDate} (horário de Brasília).`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const userRef = db.collection("usuarios").doc(user.uid);
    const profileRef = userRef.collection("perfil").doc("principal");

    try {
      const profileSnap = await profileRef.get();
      if (!profileSnap.exists) {
        console.log(`Ignorado ${user.uid}: perfil principal não encontrado.`);
        skipped++;
        continue;
      }

      const profile = profileSnap.data() || {};
      const token = profile.fcmToken;
      if (!token || profile.notificationsEnabled !== true || profile.lastDueReminderDate === dueDate) {
        console.log(`Ignorado ${user.uid}: token=${Boolean(token)}, notificaçõesAtivadas=${profile.notificationsEnabled === true}, jáEnviadoNestaData=${profile.lastDueReminderDate === dueDate}.`);
        skipped++;
        continue;
      }

      const clientsSnap = await userRef.collection("clientes").get();
      const dueClients = clientsSnap.docs.filter(clientDoc => {
        const client = clientDoc.data() || {};
        return typeof client.dueDate === "string" && client.dueDate === dueDate;
      });

      if (dueClients.length === 0) {
        console.log(`Nenhum cliente com vencimento ${dueDate} para ${user.uid}.`);
        skipped++;
        continue;
      }

      const count = dueClients.length;
      const body = count === 1
        ? "Você tem 1 cliente com vencimento amanhã. Abra o Gestão Nathan TV para conferir."
        : `Você tem ${count} clientes com vencimento amanhã. Abra o Gestão Nathan TV para conferir.`;

      try {
        await messaging.send({
          token,
          notification: {
            title: "Atenção! Vencimentos amanhã",
            body
          },
          data: {
            type: "due_reminder",
            dueDate,
            clientCount: String(count)
          },
          webpush: {
            notification: {
              icon: "./icons/app-logo.svg",
              badge: "./icons/app-logo.svg",
              tag: "gestao-vencimentos-" + dueDate,
              renotify: false
            }
          }
        });

        await profileRef.set({
          lastDueReminderDate: dueDate,
          lastDueReminderSentAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        sent++;
        console.log(`Notificação enviada para ${user.uid}: ${count} vencimento(s) em ${dueDate}.`);
      } catch (error) {
        failed++;
        console.error(`Falha ao enviar para ${user.uid}:`, error.message);
        if (error.code === "messaging/registration-token-not-registered" ||
            error.code === "messaging/invalid-registration-token") {
          await profileRef.set({
            fcmToken: admin.firestore.FieldValue.delete(),
            notificationsEnabled: false
          }, { merge: true });
        }
      }
    } catch (error) {
      failed++;
      console.error(`Falha ao verificar a conta ${user.uid}:`, error.message);
    }
  }

  console.log(`Lembretes de ${dueDate} concluídos. Enviados: ${sent}. Ignorados: ${skipped}. Falhas: ${failed}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
