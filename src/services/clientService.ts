import { addDoc, deleteDoc, getDocs, orderBy, query, updateDoc } from "firebase/firestore";
import { clientsItemsCollection, clientDocument, loansItemsCollection } from "./firestorePaths";
import type { Client } from "../types/client";
import type { Payment } from "../types/payment";
import { normalizePayment } from "../utils/paymentNormalizer";
import { requireAuthPathUid } from "./requireAuthPathUid";

export type ClientSaveInput = Omit<Client, "id" | "userId" | "createdAt" | "updatedAt">;

export async function fetchClientsByUser(userId: string): Promise<Client[]> {
  requireAuthPathUid(userId);
  const clientsRef = clientsItemsCollection(userId);
  const q = query(clientsRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      id: docSnap.id,
      name: String(data.name ?? ""),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      company: String(data.company ?? ""),
      status: (data.status as Client["status"]) || "pending",
      lastContact: String(data.lastContact ?? ""),
      totalRevenue: Number(data.totalRevenue ?? 0),
      userId: String(data.userId ?? userId),
      createdAt: (data.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date(),
      updatedAt: (data.updatedAt as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date(),
    };
  });
}

export async function fetchPaymentsSummaryByUser(userId: string): Promise<Payment[]> {
  requireAuthPathUid(userId);
  const paymentsRef = loansItemsCollection(userId);
  const q = query(paymentsRef);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) =>
    normalizePayment({ id: docSnap.id, ...(docSnap.data() as Record<string, unknown>) }),
  );
}

export async function saveClient(
  userId: string,
  clientData: ClientSaveInput,
  editingClientId?: string,
): Promise<void> {
  requireAuthPathUid(userId);
  if (editingClientId) {
    await updateDoc(clientDocument(userId, editingClientId), {
      ...clientData,
      updatedAt: new Date(),
    });
    return;
  }

  await addDoc(clientsItemsCollection(userId), {
    ...clientData,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

export async function deleteClient(userId: string, id: string): Promise<void> {
  requireAuthPathUid(userId);
  await deleteDoc(clientDocument(userId, id));
}
