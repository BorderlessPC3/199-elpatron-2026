import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.config";

export type WhatsappTemplatePayload = {
  toPhone: string;
  clientName?: string;
  amount?: number;
  dueDate?: string;
};

type OkResponse = { ok: boolean };

const sendReminder = httpsCallable<WhatsappTemplatePayload, OkResponse>(
  functions,
  "sendWhatsappReminder",
);
const sendOverdue = httpsCallable<WhatsappTemplatePayload, OkResponse>(
  functions,
  "sendWhatsappOverdue",
);
const sendConfirmation = httpsCallable<WhatsappTemplatePayload, OkResponse>(
  functions,
  "sendWhatsappConfirmation",
);

export async function sendWhatsappReminderMessage(
  payload: WhatsappTemplatePayload,
): Promise<void> {
  await sendReminder(payload);
}

export async function sendWhatsappOverdueMessage(
  payload: WhatsappTemplatePayload,
): Promise<void> {
  await sendOverdue(payload);
}

export async function sendWhatsappConfirmationMessage(
  payload: WhatsappTemplatePayload,
): Promise<void> {
  await sendConfirmation(payload);
}
