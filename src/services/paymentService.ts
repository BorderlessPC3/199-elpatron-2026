import {
  addDoc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { clientsItemsCollection, loanDocument, loansItemsCollection } from "./firestorePaths";
import type { Payment, PaymentInstallment, PaymentStatus } from "../types/payment";
import type { Client } from "../types/client";
import { normalizePayment, formatInputDate } from "../utils/paymentNormalizer";
import { requireAuthPathUid } from "./requireAuthPathUid";

export type PaymentSaveInput = Omit<
  Payment,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export async function fetchPaymentsByUser(userId: string): Promise<Payment[]> {
  requireAuthPathUid(userId);
  const paymentsRef = loansItemsCollection(userId);
  const q = query(paymentsRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) =>
    normalizePayment({ id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) }),
  );
}

export async function savePayment(
  userId: string,
  paymentData: PaymentSaveInput,
  editingPaymentId?: string,
): Promise<string> {
  requireAuthPathUid(userId);
  const normalizedData = {
    ...paymentData,
    date: paymentData.firstReceiveDate,
    amount: paymentData.installments.reduce(
      (sum, installment) => sum + installment.amount,
      0,
    ),
    installmentCount: paymentData.installments.length,
  };

  if (editingPaymentId) {
    const paymentRef = loanDocument(userId, editingPaymentId);
    await updateDoc(paymentRef, {
      ...normalizedData,
      updatedAt: new Date(),
    });
    return editingPaymentId;
  }

  const docRef = await addDoc(loansItemsCollection(userId), {
    ...normalizedData,
    paymentStatus: "pending",
    externalPaymentProvider: "asaas",
    asaasPaymentId: null,
    pixQrCode: null,
    pixCopyPaste: null,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return docRef.id;
}

export async function deletePayment(userId: string, id: string): Promise<void> {
  requireAuthPathUid(userId);
  await deleteDoc(loanDocument(userId, id));
}

export async function updatePaymentInstallments(
  userId: string,
  id: string,
  installments: PaymentInstallment[],
): Promise<void> {
  requireAuthPathUid(userId);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const allPaid = installments.length > 0 && installments.every((installment) => installment.paid);
  const hasOverdue = installments.some((installment) => {
    if (installment.paid) return false;
    return new Date(`${installment.dueDate}T00:00:00`).getTime() < todayTime;
  });

  const status: PaymentStatus = allPaid ? "paid" : hasOverdue ? "late" : "pending";
  const paymentStatus: "pending" | "paid" | "overdue" = allPaid
    ? "paid"
    : hasOverdue
      ? "overdue"
      : "pending";
  const amount = installments.reduce((sum, installment) => sum + installment.amount, 0);
  await updateDoc(loanDocument(userId, id), {
    installments,
    installmentCount: installments.length,
    amount,
    status,
    paymentStatus,
    updatedAt: new Date(),
  });
}

export async function ensureClientExistsForPayment(
  userId: string,
  paymentData: PaymentSaveInput,
  clients: Client[],
): Promise<void> {
  requireAuthPathUid(userId);
  const normalizedClientName = paymentData.clientName.trim().toLowerCase();
  const normalizedClientEmail = paymentData.clientEmail.trim().toLowerCase();
  const clientAlreadyExists = clients.some((client) => {
    const currentName = client.name.trim().toLowerCase();
    const currentEmail = client.email.trim().toLowerCase();
    return (
      (normalizedClientEmail && currentEmail === normalizedClientEmail) ||
      currentName === normalizedClientName
    );
  });

  if (clientAlreadyExists) return;

  await addDoc(clientsItemsCollection(userId), {
    name: paymentData.clientName.trim(),
    email: paymentData.clientEmail.trim(),
    phone: "",
    company: "",
    status: "pending",
    lastContact: formatInputDate(new Date()),
    totalRevenue: 0,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
