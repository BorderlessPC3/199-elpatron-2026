import { getDocs, orderBy, query } from "firebase/firestore";
import { clientsItemsCollection, loansItemsCollection } from "./firestorePaths";
import type { Client } from "../types/client";
import type { Payment } from "../types/payment";
import { normalizePayment } from "../utils/paymentNormalizer";
import { requireAuthPathUid } from "./requireAuthPathUid";

export async function fetchUserClientsPayments(
  userId: string,
): Promise<{ clients: Client[]; payments: Payment[] }> {
  requireAuthPathUid(userId);
  const clientsRef = clientsItemsCollection(userId);
  const clientsQuery = query(
    clientsRef,
    orderBy("createdAt", "desc"),
  );
  const clientsSnapshot = await getDocs(clientsQuery);
  const clients: Client[] = [];
  clientsSnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    clients.push({
      id: docSnap.id,
      name: String(data.name ?? ""),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      company: String(data.company ?? ""),
      status: (data.status as Client["status"]) || "pending",
      lastContact: String(data.lastContact ?? ""),
      totalRevenue: Number(data.totalRevenue ?? 0),
      userId: String(data.userId ?? ""),
      createdAt: data.createdAt?.toDate?.() ?? new Date(),
      updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
    });
  });

  const paymentsRef = loansItemsCollection(userId);
  const paymentsQuery = query(
    paymentsRef,
    orderBy("createdAt", "desc"),
  );
  const paymentsSnapshot = await getDocs(paymentsQuery);
  const payments: Payment[] = [];
  paymentsSnapshot.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    payments.push(normalizePayment({ id: docSnap.id, ...data }));
  });

  return { clients, payments };
}
