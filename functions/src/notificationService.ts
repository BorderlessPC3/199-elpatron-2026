/**
 * Camada de integração com provedores externos (Twilio, Z-API, etc.).
 * Inicialmente mock: apenas registra no log e no Firestore.
 */

import * as admin from "firebase-admin";

export type NotificationChannel = "whatsapp" | "sms";

const db = () => admin.firestore();

export interface OutboundMessage {
  userId: string;
  loanId: string;
  toPhone: string;
  body: string;
  channel: NotificationChannel;
  type: "reminder" | "overdue" | "confirmation";
}

export async function logOutbound(
  data: OutboundMessage,
  mockSend = true,
): Promise<string> {
  const ref = await db().collection("notificationLogs").add({
    ...data,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    mock: mockSend,
  });

  if (mockSend) {
    // eslint-disable-next-line no-console
    console.log(
      `[MOCK ${data.channel.toUpperCase()}] -> ${data.toPhone}: ${data.body.slice(0, 120)}...`,
    );
  }

  return ref.id;
}

/**
 * Ponto de extensão: substitua por Twilio / Z-API.
 */
export async function sendWhatsapp(phone: string, body: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[WhatsApp API placeholder] to=${phone}`);
  await new Promise((r) => setTimeout(r, 10));
  void body;
}

export async function sendSms(phone: string, body: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[SMS API placeholder] to=${phone}`);
  await new Promise((r) => setTimeout(r, 10));
  void body;
}

export async function dispatchMessage(
  data: OutboundMessage,
  preferSms = false,
): Promise<void> {
  await logOutbound(data);
  if (preferSms) {
    await sendSms(data.toPhone, data.body);
  } else {
    await sendWhatsapp(data.toPhone, data.body);
  }
}
