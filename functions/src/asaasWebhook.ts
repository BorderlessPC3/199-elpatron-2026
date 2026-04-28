import { getFirestore } from "firebase-admin/firestore";
import { onRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import {
  createPixCharge,
  markLoanAsOverdueByAsaasPayment,
  markLoanAsPaidByAsaasPayment,
} from "./services/asaas/paymentService";

interface AsaasWebhookPayload {
  event?: string;
  payment?: {
    id?: string;
    externalReference?: string;
  };
}

interface LoanByPaymentLookup {
  userId: string;
  loanId: string;
}

function isValidWebhookToken(headerToken: string | undefined): boolean {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  return Boolean(expected && headerToken && expected === headerToken);
}

function isAllowedWebhookSource(ipAddress: string | undefined): boolean {
  const allowList = process.env.ASAAS_WEBHOOK_ALLOWED_IPS;
  if (!allowList?.trim()) return true;
  if (!ipAddress) return false;
  const allowedIps = allowList
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return allowedIps.includes(ipAddress);
}

async function findLoanByAsaasPaymentId(
  asaasPaymentId: string,
): Promise<LoanByPaymentLookup | null> {
  const db = getFirestore();
  const indexSnap = await db.doc(`asaasPayments/${asaasPaymentId}`).get();
  if (indexSnap.exists) {
    const data = indexSnap.data() as { userId?: string; loanId?: string };
    if (data.userId && data.loanId) {
      return { userId: data.userId, loanId: data.loanId };
    }
  }
  return null;
}

export const createPixChargeFunction = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const userId = String(request.data?.userId ?? "");
  const loanId = String(request.data?.loanId ?? "");
  if (!userId || !loanId) {
    throw new HttpsError("invalid-argument", "userId e loanId são obrigatórios.");
  }
  if (request.auth.uid !== userId) {
    throw new HttpsError("permission-denied", "Usuário sem permissão para este loan.");
  }

  try {
    return await createPixCharge({ userId, loanId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar cobrança PIX.";
    throw new HttpsError("internal", message);
  }
});

export const handleAsaasWebhook = onRequest(async (request, response) => {
  if (request.path !== "/asaas/webhook") {
    response.status(404).json({ ok: false, error: "Not found" });
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const token = request.get("asaas-access-token") || request.get("x-webhook-token");
  if (!isValidWebhookToken(token)) {
    response.status(401).json({ ok: false, error: "Invalid webhook token" });
    return;
  }

  const sourceIp = request.ip || request.headers["x-forwarded-for"]?.toString();
  if (!isAllowedWebhookSource(sourceIp)) {
    response.status(403).json({ ok: false, error: "Source IP not allowed" });
    return;
  }

  const payload = request.body as AsaasWebhookPayload;
  const eventType = payload.event;
  const asaasPaymentId = payload.payment?.id;
  if (!eventType || !asaasPaymentId) {
    response.status(400).json({ ok: false, error: "Invalid payload" });
    return;
  }

  const loanLookup = await findLoanByAsaasPaymentId(asaasPaymentId);
  if (!loanLookup) {
    response.status(202).json({ ok: true, ignored: true });
    return;
  }

  if (eventType === "PAYMENT_RECEIVED" || eventType === "PAYMENT_CONFIRMED") {
    await markLoanAsPaidByAsaasPayment(
      loanLookup.userId,
      loanLookup.loanId,
      asaasPaymentId,
    );
  }

  if (eventType === "PAYMENT_OVERDUE") {
    await markLoanAsOverdueByAsaasPayment(
      loanLookup.userId,
      loanLookup.loanId,
      asaasPaymentId,
    );
  }

  response.status(200).json({ ok: true });
});
