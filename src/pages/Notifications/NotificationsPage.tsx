import {
  faCheckCircle,
  faExclamationTriangle,
  faInfoCircle,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { fetchUserClientsPayments } from "../../services/fetchUserClientsPayments";
import {
  buildDashboardNotifications,
  type DashboardNotification,
} from "../../utils/buildDashboardNotifications";
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
  const [notifications, setNotifications] = useState<DashboardNotification[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  if (loading && notifications.length === 0 && !error) {
    return <LoadingPage message="Carregando notificações" />;
  }

  return (
    <div className="notifications-page">
      <header className="notifications-page-header">
        <h1>Notificações</h1>
        <p className="notifications-page-subtitle">
          Alertas de empréstimos com parcelas em atraso.
        </p>
      </header>

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
