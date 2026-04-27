import { FirebaseError } from "firebase/app";

export const getErrorMessage = (
  error: unknown,
  fallback = "Ocorreu um erro inesperado",
): string => {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return "Permissão negada. Você só pode acessar os dados da sua própria conta.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
};
