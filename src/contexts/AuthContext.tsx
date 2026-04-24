import type { User } from "firebase/auth";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../services/firebase.config";
import { PaymentReminderService } from "../services/paymentReminderService";
import { getErrorMessage } from "../utils/error";
import { useToast } from "./ToastContext";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        setTimeout(async () => {
          try {
            await PaymentReminderService.checkAndShowReminders(
              user.uid,
              addToast,
              (intent) => ({
                label: "Ver Pagamentos",
                onClick: () => {
                  window.dispatchEvent(
                    new CustomEvent("app:navigate", { detail: intent }),
                  );
                },
              }),
            );

            addToast({
              type: "success",
              title: "Bem-vindo de volta!",
              message: "Sistema carregado com sucesso",
              duration: 3000,
            });
          } catch (error) {
            console.error("Erro ao verificar lembretes:", error);
          }
        }, 2000);
      }
    });

    return unsubscribe;
  }, [addToast]);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error, "Falha ao encerrar sessão"));
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
