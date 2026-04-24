import {
  faCheckCircle,
  faExclamationCircle,
  faExclamationTriangle,
  faInfoCircle,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState } from "react";
import type { Toast as ToastType } from "../../types/toast";
import "./Toast.css";

interface ToastProps {
  toast: ToastType;
  onRemove: (id: string) => void;
}

function Toast({ toast, onRemove }: ToastProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return faCheckCircle;
      case "error":
        return faExclamationCircle;
      case "warning":
        return faExclamationTriangle;
      case "info":
      default:
        return faInfoCircle;
    }
  };

  const handleRemove = () => {
    setIsRemoving(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const handleActionClick = () => {
    if (toast.action) {
      toast.action.onClick();
      handleRemove();
    }
  };

  const isPaymentReminder =
    toast.title.toLowerCase().includes("cobrança") ||
    toast.title.toLowerCase().includes("pagamento") ||
    toast.message.toLowerCase().includes("vencimento");

  const toastClasses = [
    "toast",
    toast.type,
    isRemoving ? "removing" : "",
    toast.duration !== undefined ? "has-duration" : "",
    isPaymentReminder ? "payment-reminder" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const animationDuration = toast.duration ? `${toast.duration}ms` : undefined;

  return (
    <div
      className={toastClasses}
      style={
        {
          "--progress-duration": animationDuration,
        } as React.CSSProperties
      }
    >
      {toast.duration !== undefined && (
        <div className="toast-progress" style={{ animationDuration }} />
      )}

      <div className="toast-icon">
        <FontAwesomeIcon icon={getIcon()} />
      </div>

      <div className="toast-content">
        <h4 className="toast-title">{toast.title}</h4>
        <p className="toast-message">{toast.message}</p>

        {toast.action && (
          <div className="toast-action">
            <button className="toast-action-button" onClick={handleActionClick}>
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      <button
        className="toast-close"
        onClick={handleRemove}
        aria-label="Fechar notificação"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </div>
  );
}

export default Toast;
