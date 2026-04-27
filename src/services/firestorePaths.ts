import {
  type CollectionReference,
  type DocumentReference,
  collection,
  doc,
} from "firebase/firestore";
import { db } from "./firebase.config";

/** clients/{userId}/items */
export function clientsItemsCollection(userId: string): CollectionReference {
  return collection(db, "clients", userId, "items");
}

/** loans/{userId}/items (empréstimos) */
export function loansItemsCollection(userId: string): CollectionReference {
  return collection(db, "loans", userId, "items");
}

export function clientDocument(
  userId: string,
  clientId: string,
): DocumentReference {
  return doc(db, "clients", userId, "items", clientId);
}

export function loanDocument(
  userId: string,
  loanId: string,
): DocumentReference {
  return doc(db, "loans", userId, "items", loanId);
}

/** agenda/{userId}/items */
export function agendaItemsCollection(userId: string): CollectionReference {
  return collection(db, "agenda", userId, "items");
}

/** users/{userId}/settings/preferences */
export function userSettingsDocument(userId: string): DocumentReference {
  return doc(db, "users", userId, "settings", "preferences");
}

export function userProfileDocument(userId: string): DocumentReference {
  return doc(db, "users", userId);
}

/** settings/{userId} — configurações gerais (empresa, backup) */
export function tenantAppSettingsDocument(userId: string): DocumentReference {
  return doc(db, "settings", userId);
}
