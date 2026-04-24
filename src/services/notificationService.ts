/**
 * Lembretes in-app: ver `PaymentReminderService`.
 * Envio WhatsApp/SMS automático: Cloud Functions (pasta /functions) + `notificationLogs` no Firestore.
 *
 * Aqui: helpers só no cliente (não enviam e-mail / SMS).
 */

export function buildWhatsappUrl(phoneDigits: string, text: string): string {
  const n = phoneDigits.replace(/\D/g, "");
  const t = encodeURIComponent(text);
  return `https://wa.me/${n}?text=${t}`;
}
