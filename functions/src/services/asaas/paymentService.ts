import { Timestamp, getFirestore } from "firebase-admin/firestore";
import {
  createCustomer,
  createPayment,
  findCustomerByExternalReference,
  getPayment,
} from "./asaasClient";

interface LoanInstallment {
  id: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
}

interface LoanDoc {
  clientName?: string;
  clientEmail?: string;
  userId?: string;
  loanAmount?: number;
  installments?: LoanInstallment[];
  description?: string;
  externalPaymentProvider?: "asaas";
}

export interface CreatePixChargeInput {
  userId: string;
  loanId: string;
}

export interface CreatePixChargeResult {
  asaasPaymentId: string;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  paymentStatus: "pending";
}

function resolveChargeValue(loan: LoanDoc): number {
  const firstPending = (loan.installments ?? []).find((inst) => !inst.paid);
  if (firstPending) return firstPending.amount;
  if (typeof loan.loanAmount === "number" && loan.loanAmount > 0) return loan.loanAmount;
  throw new Error("Loan sem valor válido para cobrança PIX.");
}

function resolveChargeDueDate(loan: LoanDoc): string {
  const firstPending = (loan.installments ?? []).find((inst) => !inst.paid);
  if (firstPending?.dueDate) return firstPending.dueDate;
  throw new Error("Loan sem dueDate válido para cobrança PIX.");
}

function resolveInstallmentToMarkPaid(loan: LoanDoc): LoanInstallment | undefined {
  return (loan.installments ?? [])
    .filter((inst) => !inst.paid)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}

export async function createPixCharge(
  input: CreatePixChargeInput,
): Promise<CreatePixChargeResult> {
  const db = getFirestore();
  const loanRef = db.doc(`loans/${input.userId}/items/${input.loanId}`);
  const loanSnap = await loanRef.get();
  if (!loanSnap.exists) {
    throw new Error("Empréstimo não encontrado.");
  }

  const loan = loanSnap.data() as LoanDoc;
  const clientName = loan.clientName?.trim();
  const clientEmail = loan.clientEmail?.trim().toLowerCase();
  if (!clientName || !clientEmail) {
    throw new Error("Loan sem dados mínimos do cliente para cobrança Asaas.");
  }

  const externalReference = `${input.userId}:${clientEmail}`;
  const existingCustomer = await findCustomerByExternalReference(externalReference);
  const customer =
    existingCustomer ??
    (await createCustomer({
      name: clientName,
      email: clientEmail,
      externalReference,
    }));

  const payment = await createPayment({
    customer: customer.id,
    billingType: "PIX",
    value: resolveChargeValue(loan),
    dueDate: resolveChargeDueDate(loan),
    description: loan.description || `Emprestimo ${input.loanId}`,
    externalReference: `${input.userId}:${input.loanId}`,
  });

  const freshPayment = await getPayment(payment.id);
  const pixQrCode = freshPayment.pixTransaction?.qrCode?.encodedImage ?? null;
  const pixCopyPaste = freshPayment.pixTransaction?.qrCode?.payload ?? null;

  await loanRef.set(
    {
      asaasPaymentId: payment.id,
      pixQrCode,
      pixCopyPaste,
      paymentStatus: "pending",
      externalPaymentProvider: "asaas",
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  await db.doc(`asaasPayments/${payment.id}`).set(
    {
      userId: input.userId,
      loanId: input.loanId,
      status: "pending",
      externalPaymentProvider: "asaas",
      updatedAt: Timestamp.now(),
      createdAt: Timestamp.now(),
    },
    { merge: true },
  );

  return {
    asaasPaymentId: payment.id,
    pixQrCode,
    pixCopyPaste,
    paymentStatus: "pending",
  };
}

export async function markLoanAsPaidByAsaasPayment(
  userId: string,
  loanId: string,
  asaasPaymentId?: string,
): Promise<void> {
  const db = getFirestore();
  const loanRef = db.doc(`loans/${userId}/items/${loanId}`);
  const snap = await loanRef.get();
  if (!snap.exists) return;
  const loan = snap.data() as LoanDoc;
  const installment = resolveInstallmentToMarkPaid(loan);
  const paidAt = new Date().toISOString();

  const updatedInstallments = (loan.installments ?? []).map((inst) =>
    installment && inst.id === installment.id ? { ...inst, paid: true, paidAt } : inst,
  );
  const allPaid = updatedInstallments.length > 0 && updatedInstallments.every((x) => x.paid);

  await loanRef.set(
    {
      installments: updatedInstallments,
      paymentStatus: "paid",
      status: allPaid ? "paid" : "pending",
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  if (asaasPaymentId) {
    await db.doc(`asaasPayments/${asaasPaymentId}`).set(
      { status: "paid", updatedAt: Timestamp.now() },
      { merge: true },
    );
  }
}

export async function markLoanAsOverdueByAsaasPayment(
  userId: string,
  loanId: string,
  asaasPaymentId?: string,
): Promise<void> {
  const db = getFirestore();
  const loanRef = db.doc(`loans/${userId}/items/${loanId}`);
  await loanRef.set(
    {
      paymentStatus: "overdue",
      status: "late",
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  );

  if (asaasPaymentId) {
    await db.doc(`asaasPayments/${asaasPaymentId}`).set(
      { status: "overdue", updatedAt: Timestamp.now() },
      { merge: true },
    );
  }
}
