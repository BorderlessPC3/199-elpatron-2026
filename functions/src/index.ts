import * as admin from "firebase-admin";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { dispatchMessage, type OutboundMessage } from "./notificationService";
export {
  createPixChargeFunction as createPixCharge,
  handleAsaasWebhook,
} from "./asaasWebhook";

initializeApp();
const db = getFirestore();

interface Installment {
  id: string;
  dueDate: string;
  amount: number;
  paid: boolean;
}

interface LoanDoc {
  clientName?: string;
  userId?: string;
  installments?: Installment[];
  loanAmount?: number;
}

interface UserSettings {
  autoNotifications?: boolean;
  defaultWhatsappNumber?: string;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatBrl(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length ? d : "";
}

async function loadUserSettings(userId: string): Promise<UserSettings> {
  const snap = await db
    .doc(`users/${userId}/settings/preferences`)
    .get();
  return (snap.data() as UserSettings) ?? {};
}

async function resolvePhone(
  userId: string,
  clientName: string,
  settings: UserSettings,
): Promise<string | null> {
  const q = await db
    .collection("clients")
    .doc(userId)
    .collection("items")
    .where("name", "==", clientName)
    .limit(1)
    .get();
  if (!q.empty) {
    const phone = q.docs[0].get("phone");
    if (phone && String(phone).trim()) {
      const n = normalizePhone(String(phone));
      if (n) return n;
    }
  }
  const w = settings.defaultWhatsappNumber;
  if (w?.trim()) {
    const n = normalizePhone(w);
    if (n) return n;
  }
  return null;
}

/** 1 dia antes do vencimento (parcela não paga) */
export async function sendPaymentReminder(
  userId: string,
  loanId: string,
  data: LoanDoc,
  installment: Installment,
  phone: string,
): Promise<void> {
  const body = `Lembrete El Patrón: Olá ${data.clientName ?? "cliente"}, a parcela de ${formatBrl(
    installment.amount,
  )} vence amanhã (${installment.dueDate}). Emprestimo #${loanId.slice(0, 8)}.`;
  const msg: OutboundMessage = {
    userId,
    loanId,
    toPhone: phone,
    body,
    channel: "whatsapp",
    type: "reminder",
  };
  await dispatchMessage(msg);
}

/** Parcela em atraso — enviado no job diário */
export async function sendOverdueNotification(
  userId: string,
  loanId: string,
  data: LoanDoc,
  installment: Installment,
  phone: string,
): Promise<void> {
  const body = `Aviso El Patrón: ${data.clientName ?? "Cliente"}, parcela de ${formatBrl(
    installment.amount,
  )} com vencimento em ${installment.dueDate} está em atraso. Empréstimo #${loanId.slice(0, 8)}.`;
  const msg: OutboundMessage = {
    userId,
    loanId,
    toPhone: phone,
    body,
    channel: "whatsapp",
    type: "overdue",
  };
  await dispatchMessage(msg, false);
}

export async function sendPaymentConfirmation(
  userId: string,
  loanId: string,
  data: LoanDoc,
  installment: Installment,
  phone: string,
): Promise<void> {
  const body = `El Patrón: Pagamento confirmado! ${data.clientName ?? "Cliente"}, parcela de ${formatBrl(
    installment.amount,
  )} (${installment.dueDate}) recebida. Obrigado.`;
  const msg: OutboundMessage = {
    userId,
    loanId,
    toPhone: phone,
    body,
    channel: "whatsapp",
    type: "confirmation",
  };
  await dispatchMessage(msg, false);
}

async function processScheduledNotifications(): Promise<void> {
  const loansCol = await db.collection("loans").get();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yTomorrow = ymd(tomorrow);
  const tToday = today.getTime();

  for (const userDoc of loansCol.docs) {
    const userId = userDoc.id;
    const settings = await loadUserSettings(userId);
    if (settings.autoNotifications === false) continue;

    const items = await userDoc.ref.collection("items").get();
    for (const loanSnap of items.docs) {
      const loanId = loanSnap.id;
      const data = loanSnap.data() as LoanDoc;
      const installments = data.installments ?? [];
      if (!data.clientName) continue;
      const phone = await resolvePhone(userId, data.clientName, settings);
      if (!phone) continue;

      for (const inst of installments) {
        if (inst.paid) continue;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(inst.dueDate)) continue;
        const [yy, mm, dd] = inst.dueDate.split("-").map(Number);
        const due = new Date(yy, mm - 1, dd);
        due.setHours(0, 0, 0, 0);
        const dTime = due.getTime();

        if (yTomorrow === inst.dueDate) {
          await sendPaymentReminder(userId, loanId, data, inst, phone);
        }
        if (dTime < tToday) {
          await sendOverdueNotification(userId, loanId, data, inst, phone);
        }
      }
    }
  }
}

export const scheduledPaymentNotifications = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "America/Sao_Paulo",
    memory: "256MiB",
  },
  async () => {
    await processScheduledNotifications();
  },
);

export const onLoanItemUpdated = onDocumentUpdated(
  {
    document: "loans/{userId}/items/{loanId}",
    memory: "256MiB",
  },
  async (event) => {
    const before = event.data?.before.data() as LoanDoc;
    const after = event.data?.after.data() as LoanDoc;
    const userId = event.params.userId as string;
    const loanId = event.params.loanId as string;
    if (!before || !after) return;

    const settings = await loadUserSettings(userId);
    if (settings.autoNotifications === false) return;

    const bInst = before.installments ?? [];
    const aInst = after.installments ?? [];
    const phone = after.clientName
      ? await resolvePhone(userId, after.clientName, settings)
      : null;
    if (!phone) return;

    for (const ai of aInst) {
      const bi = bInst.find((x) => x.id === ai.id);
      if (!bi) continue;
      if (!bi.paid && ai.paid) {
        await sendPaymentConfirmation(userId, loanId, after, ai, phone);
      }
    }
  },
);
