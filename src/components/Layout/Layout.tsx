import {
  faBell,
  faCalendarAlt,
  faChartBar,
  faChevronLeft,
  faChevronRight,
  faCreditCard,
  faCog,
  faFileAlt,
  faPowerOff,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import type { IconProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { usePageTransition } from "../../hooks";
import { PageTransition } from "../PageTransition";
import "./Layout.css";

interface LayoutProps {
  children: ReactNode;
}

interface MenuItem {
  id: string;
  label: string;
  icon: IconProp;
  path: string;
}

const menuItems: MenuItem[] = [
  { id: "dashboard", label: "Dashboard", icon: faChartBar, path: "/dashboard" },
  {
    id: "notifications",
    label: "Notificações",
    icon: faBell,
    path: "/notifications",
  },
  { id: "clients", label: "Clientes", icon: faUsers, path: "/clients" },
  {
    id: "payments",
    label: "Empréstimos",
    icon: faCreditCard,
    path: "/payments",
  },
  { id: "agenda", label: "Agenda", icon: faCalendarAlt, path: "/agenda" },
  { id: "reports", label: "Relatórios", icon: faFileAlt, path: "/reports" },
  { id: "settings", label: "Configurações", icon: faCog, path: "/settings" },
];

function Layout({ children }: LayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [pageCache, setPageCache] = useState<Map<string, ReactNode>>(new Map());
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { isTransitioning, startTransition } = usePageTransition();

  // Cache da página atual
  const currentPage = useMemo(() => {
    const cached = pageCache.get(location.pathname);
    if (cached) {
      return cached;
    }

    // Cache da nova página
    setPageCache((prev) => new Map(prev).set(location.pathname, children));
    return children;
  }, [location.pathname, children, pageCache]);

  const handleMenuClick = (path: string) => {
    if (location.pathname === path) return; // Evitar navegação desnecessária

    startTransition();

    // Delay reduzido para transição mais fluida
    setTimeout(() => {
      navigate(path);
    }, 100);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className={`sidebar ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <div className="logo">
            {!isCollapsed && <span className="logo-wordmark">EL PATRON</span>}
          </div>
          <button
            type="button"
            className="collapse-btn"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            <FontAwesomeIcon icon={isCollapsed ? faChevronRight : faChevronLeft} />
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul className="nav-list">
            {menuItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`nav-item ${
                    location.pathname === item.path ? "active" : ""
                  }`}
                  onClick={() => handleMenuClick(item.path)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <span className="nav-icon">
                    <FontAwesomeIcon icon={item.icon} />
                  </span>
                  {!isCollapsed && (
                    <span className="nav-label">{item.label}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="logout-btn"
            onClick={handleLogout}
            title={isCollapsed ? "Sair da conta" : undefined}
            aria-label="Sair da conta"
          >
            <span className="nav-icon">
              <FontAwesomeIcon icon={faPowerOff} />
            </span>
            {!isCollapsed && <span className="nav-label">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <div className="content-wrapper">
          <PageTransition isTransitioning={isTransitioning}>
            {currentPage}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}

export default Layout;
