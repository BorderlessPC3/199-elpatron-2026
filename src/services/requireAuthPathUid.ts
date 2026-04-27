import { auth } from "./firebase.config";

/**
 * Garante que operações no Firestore só usem o UID da sessão atual.
 * Não confie em userId vindo só da UI sem esta checagem.
 */
export function requireAuthPathUid(pathUid: string): void {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Faça login para continuar.");
  }
  if (uid !== pathUid) {
    throw new Error("Operação bloqueada: a sessão não corresponde ao recurso solicitado.");
  }
}
