import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes as RouterRoutes,
  useNavigate,
} from "react-router-dom";
import { useEffect } from "react";
import { Layout } from "../components";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../contexts/AuthContext";
import {
  AgendaPage,
  ClientsPage,
  DashboardPage,
  LoadingPage,
  LoginPage,
  NotificationsPage,
  PaymentsPage,
  ReportsPage,
  SettingsPage,
} from "../pages";

function AppRoutes() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleNavigateEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ type?: string; to?: string }>;
      if (customEvent.detail?.type === "navigate" && customEvent.detail.to) {
        navigate(customEvent.detail.to);
      }
    };

    window.addEventListener("app:navigate", handleNavigateEvent);
    return () => {
      window.removeEventListener("app:navigate", handleNavigateEvent);
    };
  }, [navigate]);

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <RouterRoutes>
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route path="/loading" element={<LoadingPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout>
              <Outlet />
            </Layout>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/agenda" element={<AgendaPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </RouterRoutes>
  );
}

function Routes() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default Routes;
