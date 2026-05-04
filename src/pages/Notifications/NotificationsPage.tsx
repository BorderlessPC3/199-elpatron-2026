import {
  faCheckCircle,
  faExclamationTriangle,
  faInfoCircle,
  faPaperPlane,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useToastHelpers } from "../../contexts/ToastContext";
import { fetchUserClientsPayments } from "../../services/fetchUserClientsPayments";
import {
  sendWhatsappConfirmationMessage,
  sendWhatsappOverdueMessage,
  sendWhatsappReminderMessage,
} from "../../services/whatsappNotificationsService";
import {
  buildDashboardNotifications,
  type DashboardNotification,
} from "../../utils/buildDashboardNotifications";
import { getErrorMessage } from "../../utils/error";
import { useUserSettings } from "../../hooks/useUserSettings";
import LoadingPage from "../LoadingPage/LoadingPage";
import "./NotificationsPage.css";

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMinutes = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60),
  );

  if (diffInMinutes < 1) return "Agora mesmo";
  if (diffInMinutes < 60) return `${diffInMinutes} minutos atrás`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} horas atrás`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays} dias atrás`;

  return date.toLocaleDateString("pt-BR");
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "warning":
      return (
        <FontAwesomeIcon
          icon={faExclamationTriangle}
          style={{ color: "var(--color-warning)" }}
        />
      );
    case "success":
      return (
        <FontAwesomeIcon
          icon={faCheckCircle}
          style={{ color: "var(--color-success)" }}
        />
      );
    case "error":
      return (
        <FontAwesomeIcon
          icon={faTimes}
          style={{ color: "var(--color-error)" }}
        />
      );
    default:
      return (
        <FontAwesomeIcon
          icon={faInfoCircle}
          style={{ color: "var(--color-info)" }}
        />
      );
  }
}

function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToastHelpers();
  const { settings, save, loading: prefsLoading } = useUserSettings(user?.uid);
  const [notifications, setNotifications] = useState<DashboardNotification[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [demoClient, setDemoClient] = useState("Cliente");
  const [demoAmount, setDemoAmount] = useState("100");
  const [demoDueDate, setDemoDueDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0] ?? "";
  });
  const [sendingKind, setSendingKind] = useState<
    null | "reminder" | "overdue" | "confirmation"
  >(null);
  const [savingPhone, setSavingPhone] = useState(false);

  useEffect(() => {
    setWaPhone(settings.notificationsWhatsappNumber ?? "");
  }, [settings.notificationsWhatsappNumber]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError("");
      const { clients, payments } = await fetchUserClientsPayments(user.uid);
      setNotifications(buildDashboardNotifications(clients, payments));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Erro ao carregar notificações:", err);
      setError("Erro ao carregar: " + message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const templatePayload = () => {
    const amount = Number(String(demoAmount).replace(",", ".")) || 100;
    return {
      toPhone: waPhone.trim(),
      clientName: demoClient.trim() || "Cliente",
      amount,
      dueDate: demoDueDate.trim() || "2099-12-31",
    };
  };

  const handleSaveWhatsappNumber = async () => {
    if (!user) return;
    try {
      setSavingPhone(true);
      await save({ notificationsWhatsappNumber: waPhone.trim() });
      showSuccess("Número salvo", "Usado como destino padrão nos envios desta página.");
    } catch (e: unknown) {
      showError("Erro", getErrorMessage(e));
    } finally {
      setSavingPhone(false);
    }
  };

  const handleSend = async (kind: "reminder" | "overdue" | "confirmation") => {
    if (!user) return;
    if (!waPhone.trim()) {
      showError("WhatsApp", "Informe o número de destino.");
      return;
    }
    const payload = templatePayload();
    try {
      setSendingKind(kind);
      if (kind === "reminder") await sendWhatsappReminderMessage(payload);
      else if (kind === "overdue") await sendWhatsappOverdueMessage(payload);
      else await sendWhatsappConfirmationMessage(payload);
      showSuccess(
        "Mensagem processada",
        "O servidor registou o envio. Com WHATSAPP_SEND_URL nas Functions, dispara HTTP real; caso contrário, só log e notificationLogs.",
      );
    } catch (e: unknown) {
      showError("Falha ao enviar", getErrorMessage(e));
    } finally {
      setSendingKind(null);
    }
  };

  const initialBoot =
    Boolean(user) && (loading || prefsLoading) && notifications.length === 0 && !error;
  if (initialBoot) {
    return <LoadingPage message="Carregando notificações" />;
  }

  return (
    <div className="notifications-page">
      <header className="notifications-page-header">
        <h1>Notificações</h1>
        <p className="notifications-page-subtitle">
          Alertas de empréstimos e testes de mensagem por WhatsApp (via Cloud
          Functions).
        </p>
      </header>

      <section className="notifications-whatsapp-panel" aria-label="Envio WhatsApp">
        <h2 className="notifications-whatsapp-title">WhatsApp (teste)</h2>
        <p className="notifications-whatsapp-help">
          O número abaixo é o destino das três mensagens de modelo. Configure{" "}
          <code>WHATSAPP_SEND_URL</code> nas Firebase Functions para envio HTTP
          real.
        </p>
        <div className="notifications-whatsapp-grid">
          <label className="notifications-field">
            <span>Número (com DDD, só dígitos ou formatado)</span>
            <input
              type="text"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              placeholder="5511999998888"
              autoComplete="tel"
            />
          </label>
          <button
            type="button"
            className="notifications-btn-save"
            onClick={() => void handleSaveWhatsappNumber()}
            disabled={savingPhone || prefsLoading}
          >
            Salvar número
          </button>
        </div>
        <div className="notifications-whatsapp-grid notifications-whatsapp-demo">
          <label className="notifications-field">
            <span>Nome do cliente (texto da mensagem)</span>
            <input
              type="text"
              value={demoClient}
              onChange={(e) => setDemoClient(e.target.value)}
            />
          </label>
          <label className="notifications-field">
            <span>Valor (R$)</span>
            <input
              type="text"
              inputMode="decimal"
              value={demoAmount}
              onChange={(e) => setDemoAmount(e.target.value)}
            />
          </label>
          <label className="notifications-field">
            <span>Data (AAAA-MM-DD)</span>
            <input
              type="date"
              value={demoDueDate}
              onChange={(e) => setDemoDueDate(e.target.value)}
            />
          </label>
        </div>
        <div className="notifications-whatsapp-actions">
          <button
            type="button"
            className="notifications-btn-wa"
            onClick={() => void handleSend("reminder")}
            disabled={sendingKind !== null}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            {sendingKind === "reminder" ? "Enviando…" : "Lembrete de vencimento"}
          </button>
          <button
            type="button"
            className="notifications-btn-wa"
            onClick={() => void handleSend("overdue")}
            disabled={sendingKind !== null}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            {sendingKind === "overdue" ? "Enviando…" : "Aviso de atraso"}
          </button>
          <button
            type="button"
            className="notifications-btn-wa"
            onClick={() => void handleSend("confirmation")}
            disabled={sendingKind !== null}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
            {sendingKind === "confirmation"
              ? "Enviando…"
              : "Confirmação de pagamento"}
          </button>
        </div>
      </section>

      {error && (
        <div className="notifications-page-error" role="alert">
          {error}
        </div>
      )}

      <div className="notifications-list-page">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${
                notification.read ? "read" : "unread"
              }`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <h4>{notification.title}</h4>
                <p>{notification.message}</p>
                <span className="notification-time">
                  {formatTimeAgo(notification.timestamp)}
                </span>
              </div>
              {notification.action && (
                <button
                  type="button"
                  className="notification-action"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(notification.action!.path);
                  }}
                >
                  {notification.action.label}
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="no-notifications">
            <p>Nenhuma notificação no momento.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationsPage;
