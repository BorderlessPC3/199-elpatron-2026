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

function isWhatsappConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_SEND_URL?.trim());
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
 * Envia via HTTP quando `WHATSAPP_SEND_URL` está definido (ex.: webhook Z-API / Evolution).
 * Body JSON inclui `to`, `message` e aliases comuns; ajuste o proxy se o teu provedor exigir outro formato.
 */
export async function sendWhatsapp(phone: string, body: string): Promise<void> {
  const url = process.env.WHATSAPP_SEND_URL?.trim();
  if (!url) {
    // eslint-disable-next-line no-console
    console.log(`[WhatsApp mock] to=${phone}`);
    await new Promise((r) => setTimeout(r, 10));
    return;
  }

  const token = process.env.WHATSAPP_SEND_TOKEN?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }

  const payload = {
    to: phone,
    phone,
    message: body,
    text: body,
    body,
  };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`WhatsApp HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
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
  if (preferSms) {
    await logOutbound(data, true);
    await sendSms(data.toPhone, data.body);
    return;
  }
  await logOutbound(data, !isWhatsappConfigured());
  await sendWhatsapp(data.toPhone, data.body);
}
