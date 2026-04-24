import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useState } from "react";
import type { Toast, ToastContextType } from "../types/toast";

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toastData: Omit<Toast, "id" | "createdAt">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      ...toastData,
      id,
      createdAt: new Date(),
    };

    setToasts((prev) => [...prev, newToast]);

    if (toastData.duration !== undefined && toastData.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, toastData.duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
  };

  return (
    <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function useToastHelpers() {
  const { addToast } = useToast();

  const showSuccess = useCallback(
    (title: string, message: string, duration = 5000) => {
      addToast({
        type: "success",
        title,
        message,
        duration,
      });
    },
    [addToast]
  );

  const showError = useCallback(
    (title: string, message: string, duration = 7000) => {
      addToast({
        type: "error",
        title,
        message,
        duration,
      });
    },
    [addToast]
  );

  const showWarning = useCallback(
    (title: string, message: string, duration = 6000) => {
      addToast({
        type: "warning",
        title,
        message,
        duration,
      });
    },
    [addToast]
  );

  const showInfo = useCallback(
    (title: string, message: string, duration = 5000) => {
      addToast({
        type: "info",
        title,
        message,
        duration,
      });
    },
    [addToast]
  );

  const showPersistent = useCallback(
    (
      type: Toast["type"],
      title: string,
      message: string,
      action?: Toast["action"]
    ) => {
      addToast({
        type,
        title,
        message,
        action,
        duration: undefined,
      });
    },
    [addToast]
  );

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showPersistent,
  };
}
