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

export type PaymentSaveInput = Omit<
  Payment,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export async function fetchPaymentsByUser(userId: string): Promise<Payment[]> {
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
): Promise<void> {
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
    return;
  }

  await addDoc(loansItemsCollection(userId), {
    ...normalizedData,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function deletePayment(userId: string, id: string): Promise<void> {
  await deleteDoc(loanDocument(userId, id));
}

export async function updatePaymentInstallments(
  userId: string,
  id: string,
  installments: PaymentInstallment[],
  status: PaymentStatus,
): Promise<void> {
  await updateDoc(loanDocument(userId, id), {
    installments,
    status,
    updatedAt: new Date(),
  });
  /* Confirmação de pagamento: Cloud Function onUpdate em loans detecta parcela paga. */
}

export async function ensureClientExistsForPayment(
  userId: string,
  paymentData: PaymentSaveInput,
  clients: Client[],
): Promise<void> {
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
