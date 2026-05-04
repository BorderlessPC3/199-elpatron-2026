import { onCall, HttpsError } from "firebase-functions/v2/https";
import { dispatchMessage, type OutboundMessage } from "./notificationService";
import {
  buildConfirmationBody,
  buildOverdueBody,
  buildReminderBody,
} from "./whatsappTemplates";

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  return d.length ? d : "";
}

interface TemplatePayload {
  toPhone?: string;
  clientName?: string;
  amount?: number;
  dueDate?: string;
}

function parseTemplatePayload(data: unknown): TemplatePayload {
  if (!data || typeof data !== "object") return {};
  const o = data as Record<string, unknown>;
  return {
    toPhone: o.toPhone != null ? String(o.toPhone) : undefined,
    clientName: o.clientName != null ? String(o.clientName) : undefined,
    amount: typeof o.amount === "number" ? o.amount : undefined,
    dueDate: o.dueDate != null ? String(o.dueDate) : undefined,
  };
}

function requireAuthUid(request: { auth?: { uid: string } }): string {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }
  return request.auth.uid;
}

const loanShort = () => "manual";

export const sendWhatsappReminder = onCall(async (request) => {
  const userId = requireAuthUid(request);
  const p = parseTemplatePayload(request.data);
  const toPhone = normalizePhone(p.toPhone ?? "");
  if (!toPhone) {
    throw new HttpsError("invalid-argument", "Informe toPhone (WhatsApp com DDD).");
  }
  const clientName = (p.clientName ?? "Cliente").trim() || "Cliente";
  const amount = typeof p.amount === "number" && p.amount > 0 ? p.amount : 100;
  const dueDate = (p.dueDate ?? "2099-12-31").trim() || "2099-12-31";
  const body = buildReminderBody(clientName, amount, dueDate, loanShort());
  const msg: OutboundMessage = {
    userId,
    loanId: "manual-reminder",
    toPhone,
    body,
    channel: "whatsapp",
    type: "reminder",
  };
  await dispatchMessage(msg);
  return { ok: true };
});

export const sendWhatsappOverdue = onCall(async (request) => {
  const userId = requireAuthUid(request);
  const p = parseTemplatePayload(request.data);
  const toPhone = normalizePhone(p.toPhone ?? "");
  if (!toPhone) {
    throw new HttpsError("invalid-argument", "Informe toPhone (WhatsApp com DDD).");
  }
  const clientName = (p.clientName ?? "Cliente").trim() || "Cliente";
  const amount = typeof p.amount === "number" && p.amount > 0 ? p.amount : 100;
  const dueDate = (p.dueDate ?? "2099-01-01").trim() || "2099-01-01";
  const body = buildOverdueBody(clientName, amount, dueDate, loanShort());
  const msg: OutboundMessage = {
    userId,
    loanId: "manual-overdue",
    toPhone,
    body,
    channel: "whatsapp",
    type: "overdue",
  };
  await dispatchMessage(msg);
  return { ok: true };
});

export const sendWhatsappConfirmation = onCall(async (request) => {
  const userId = requireAuthUid(request);
  const p = parseTemplatePayload(request.data);
  const toPhone = normalizePhone(p.toPhone ?? "");
  if (!toPhone) {
    throw new HttpsError("invalid-argument", "Informe toPhone (WhatsApp com DDD).");
  }
  const clientName = (p.clientName ?? "Cliente").trim() || "Cliente";
  const amount = typeof p.amount === "number" && p.amount > 0 ? p.amount : 100;
  const dueDate = (p.dueDate ?? "2099-01-15").trim() || "2099-01-15";
  const body = buildConfirmationBody(clientName, amount, dueDate);
  const msg: OutboundMessage = {
    userId,
    loanId: "manual-confirmation",
    toPhone,
    body,
    channel: "whatsapp",
    type: "confirmation",
  };
  await dispatchMessage(msg);
  return { ok: true };
});
