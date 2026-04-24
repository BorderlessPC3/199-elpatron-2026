import { useToast } from "../../contexts";
import Toast from "./Toast";
import "./Toast.css";

const MAX_VISIBLE_TOASTS = 5;

function ToastContainer() {
  const { toasts, removeToast, clearAllToasts } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  const visibleToasts = toasts.slice(-MAX_VISIBLE_TOASTS);
  const hiddenCount = toasts.length - visibleToasts.length;

  return (
    <div className="toast-container">
      {hiddenCount > 0 && (
        <button
          type="button"
          className="toast-overflow-indicator"
          onClick={clearAllToasts}
        >
          +{hiddenCount} notificação{hiddenCount > 1 ? "ões" : ""} oculta
          {hiddenCount > 1 ? "s" : ""}
          <br />
          <small>Clique para limpar todas</small>
        </button>
      )}

      {visibleToasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
}

export default ToastContainer;
