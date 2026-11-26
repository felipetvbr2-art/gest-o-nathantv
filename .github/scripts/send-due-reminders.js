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

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Configure o segredo FIREBASE_SERVICE_ACCOUNT_JSON no GitHub.");
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  const db = admin.firestore();
  const messaging = admin.messaging();
  const dueDate = tomorrowInSaoPaulo();
  const users = await db.collection("usuarios").get();
  let sent = 0;
  let skipped = 0;

  for (const userDoc of users.docs) {
    const profileRef = userDoc.ref.collection("perfil").doc("principal");
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) { skipped++; continue; }

    const profile = profileSnap.data() || {};
    const token = profile.fcmToken;
    if (!token || profile.notificationsEnabled !== true || profile.lastDueReminderDate === dueDate) {
      skipped++;
      continue;
    }

    const clientsSnap = await userDoc.ref.collection("clientes").get();
    const dueClients = clientsSnap.docs.filter(doc => {
      const client = doc.data() || {};
      return typeof client.dueDate === "string" && client.dueDate === dueDate;
    });

    if (dueClients.length === 0) { skipped++; continue; }

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
      console.log(`Notificação enviada para usuário ${userDoc.id}: ${count} vencimento(s) em ${dueDate}.`);
    } catch (error) {
      console.error(`Falha ao enviar para usuário ${userDoc.id}:`, error.message);
      if (error.code === "messaging/registration-token-not-registered" ||
          error.code === "messaging/invalid-registration-token") {
        await profileRef.set({
          fcmToken: admin.firestore.FieldValue.delete(),
          notificationsEnabled: false
        }, { merge: true });
      }
    }
  }

  console.log(`Lembretes de ${dueDate} concluídos. Enviados: ${sent}. Ignorados: ${skipped}.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
