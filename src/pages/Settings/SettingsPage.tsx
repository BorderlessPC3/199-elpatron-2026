import {
  faChartBar,
  faCog,
  faCreditCard,
  faDatabase,
  faDownload,
  faInfoCircle,
  faMoon,
  faPalette,
  faSave,
  faSun,
  faSync,
  faTimes,
  faUpload,
  faUser,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Footer } from "borderless";
import { doc, getDoc, getDocs, query, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { db } from "../../services/firebase.config";
import {
  clientDocument,
  clientsItemsCollection,
  loanDocument,
  loansItemsCollection,
  tenantAppSettingsDocument,
  userProfileDocument,
} from "../../services/firestorePaths";
import LoadingPage from "../LoadingPage/LoadingPage";
import "./SettingsPage.css";

interface UserData {
  email?: string;
  name?: string;
  companyName?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  [key: string]: any;
}

function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    companyName: "El Patrón",
    email: "contato@elpatron.com",
    phone: "(11) 99999-9999",
    address: "Rua das Empresas, 123",
    city: "São Paulo",
    state: "SP",
    zipCode: "01234-567",
    backup: {
      autoBackup: true,
      frequency: "daily",
      keepDays: 30,
      preferredTime: "02:00",
      timezone: "America/Sao_Paulo",
      includeClients: true,
      includePayments: true,
      includeSettings: true,
      includeReports: true,
      encryption: true,
      integrityCheck: true,
      compression: true,
      retentionDaily: 7,
      retentionWeekly: 4,
      retentionMonthly: 12,
      notifySuccess: true,
      notifyFailure: true,
      weeklyReport: false,
    },
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportProgress, setExportProgress] = useState("");
  const [importPreview, setImportPreview] = useState<any>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const { user } = useAuth();
  const { theme, mode, setTheme, setMode } = useTheme();

  // Carregar configurações do Firestore ao iniciar
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      setLoading(true);
      setError("");
      try {
        // Carregar configurações
        const settingsRef = tenantAppSettingsDocument(user.uid);
        const settingsSnap = await getDoc(settingsRef);

        // Carregar dados do usuário
        const userProfileRef = userProfileDocument(user.uid);
        const userSnap = await getDoc(userProfileRef);

        let userData: UserData = {};
        if (userSnap.exists()) {
          userData = userSnap.data() as UserData;
        }

        // Combinar dados do usuário com configurações existentes
        if (settingsSnap.exists()) {
          const settingsData = settingsSnap.data();
          setSettings((prev) => ({
            ...prev,
            ...settingsData,
            // Sobrescrever com dados do usuário se disponíveis
            email: userData.email || user.email || prev.email,
            companyName: userData.companyName || userData.name || "El Patrón",
            phone: userData.phone || prev.phone,
            address: userData.address || prev.address,
            city: userData.city || prev.city,
            state: userData.state || prev.state,
            zipCode: userData.zipCode || prev.zipCode,
          }));
        } else {
          // Se não há configurações salvas, usar dados do usuário
          setSettings((prev) => ({
            ...prev,
            email: userData.email || user.email || prev.email,
            companyName: userData.companyName || userData.name || "El Patrón",
            phone: userData.phone || prev.phone,
            address: userData.address || prev.address,
            city: userData.city || prev.city,
            state: userData.state || prev.state,
            zipCode: userData.zipCode || prev.zipCode,
          }));
        }
      } catch (err: any) {
        setError("Erro ao carregar configurações: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user]);

  // Mostrar loading enquanto carrega as configurações
  if (loading) {
    return <LoadingPage message="Carregando configurações" />;
  }

  const handleInputChange = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBackupChange = (
    field: string,
    value: string | boolean | number
  ) => {
    setSettings((prev) => ({
      ...prev,
      backup: {
        ...prev.backup,
        [field]: value,
      },
    }));
  };

  const handleSaveSettings = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      await setDoc(tenantAppSettingsDocument(user.uid), settings, { merge: true });
      alert("Configurações salvas com sucesso!");
    } catch (err: any) {
      setError("Erro ao salvar configurações: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;

    setLoading(true);
    setError("");
    setExportProgress("Iniciando exportação...");

    try {
      // Objeto para armazenar todos os dados
      const exportData: any = {
        exportDate: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email,
        collections: {},
      };

      // Função para converter Timestamp para string
      const convertTimestamps = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === "object") {
          if (obj.toDate && typeof obj.toDate === "function") {
            return obj.toDate().toISOString();
          }
          if (Array.isArray(obj)) {
            return obj.map(convertTimestamps);
          }
          const converted: any = {};
          for (const key in obj) {
            converted[key] = convertTimestamps(obj[key]);
          }
          return converted;
        }
        return obj;
      };

      // Exportar clientes
      try {
        setExportProgress("Exportando clientes...");
        const clientsRef = clientsItemsCollection(user.uid);
        const clientsQuery = query(clientsRef);
        const clientsSnapshot = await getDocs(clientsQuery);
        const clientsData: any[] = [];

        clientsSnapshot.forEach((doc) => {
          const data = doc.data();
          clientsData.push({
            id: doc.id,
            ...convertTimestamps(data),
          });
        });

        exportData.collections.clients = clientsData;
        setExportProgress(
          `Clientes exportados: ${clientsData.length} registros`
        );
      } catch (err: any) {
        console.error("Erro ao exportar clientes:", err);
        exportData.collections.clients = { error: err.message };
      }

      // Exportar pagamentos
      try {
        setExportProgress("Exportando pagamentos...");
        const paymentsRef = loansItemsCollection(user.uid);
        const paymentsQuery = query(paymentsRef);
        const paymentsSnapshot = await getDocs(paymentsQuery);
        const paymentsData: any[] = [];

        paymentsSnapshot.forEach((doc) => {
          const data = doc.data();
          paymentsData.push({
            id: doc.id,
            ...convertTimestamps(data),
          });
        });

        exportData.collections.payments = paymentsData;
        setExportProgress(
          `Pagamentos exportados: ${paymentsData.length} registros`
        );
      } catch (err: any) {
        console.error("Erro ao exportar pagamentos:", err);
        exportData.collections.payments = { error: err.message };
      }

      // Exportar configurações do usuário
      try {
        setExportProgress("Exportando configurações...");
        const settingsExportRef = tenantAppSettingsDocument(user.uid);
        const settingsExportSnap = await getDoc(settingsExportRef);

        if (settingsExportSnap.exists()) {
          exportData.collections.settings = {
            id: settingsExportSnap.id,
            ...convertTimestamps(settingsExportSnap.data()),
          };
        } else {
          exportData.collections.settings = null;
        }
        setExportProgress("Configurações exportadas");
      } catch (err: any) {
        console.error("Erro ao exportar configurações:", err);
        exportData.collections.settings = { error: err.message };
      }

      // Exportar dados do usuário
      try {
        setExportProgress("Exportando dados do usuário...");
        const userExportRef = userProfileDocument(user.uid);
        const userExportSnap = await getDoc(userExportRef);

        if (userExportSnap.exists()) {
          exportData.collections.user = {
            id: userExportSnap.id,
            ...convertTimestamps(userExportSnap.data()),
          };
        } else {
          exportData.collections.user = null;
        }
        setExportProgress("Dados do usuário exportados");
      } catch (err: any) {
        console.error("Erro ao exportar dados do usuário:", err);
        exportData.collections.user = { error: err.message };
      }

      // Criar arquivo JSON para download
      setExportProgress("Gerando arquivo de download...");
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Criar link de download
      const link = document.createElement("a");
      link.href = url;
      link.download = `elpatron-backup-${user.uid}-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Limpar URL
      URL.revokeObjectURL(url);

      setExportProgress(
        "Exportação concluída! Arquivo baixado automaticamente."
      );
      setTimeout(() => setExportProgress(""), 3000);

      alert(
        "Dados exportados com sucesso! O arquivo foi baixado automaticamente."
      );
    } catch (err: any) {
      console.error("Erro ao exportar dados:", err);
      setError("Erro ao exportar dados: " + err.message);
    } finally {
      setLoading(false);
      setExportProgress("");
    }
  };

  const handleBackupNow = async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // Criar backup com timestamp
      const backupData = {
        backupDate: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email,
        settings: settings,
        message: "Backup manual realizado pelo usuário",
      };

      // Salvar backup no Firestore
      const backupRef = doc(db, "backups", `${user.uid}_${Date.now()}`);
      await setDoc(backupRef, backupData);

      // Também exportar dados automaticamente
      await handleExportData();

      alert(
        "Backup realizado com sucesso! Os dados foram salvos e exportados."
      );
    } catch (err: any) {
      console.error("Erro ao fazer backup:", err);
      setError("Erro ao fazer backup: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportData = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        try {
          setLoading(true);
          setError("");

          // Ler o arquivo JSON
          const text = await file.text();
          const data = JSON.parse(text);

          // Validar estrutura do arquivo
          if (!data.collections || typeof data.collections !== "object") {
            throw new Error(
              "Arquivo inválido: estrutura de dados não reconhecida"
            );
          }

          // Preparar preview da importação
          const preview = {
            fileName: file.name,
            fileSize: (file.size / 1024).toFixed(2) + " KB",
            exportDate: data.exportDate || "Data não disponível",
            userId: data.userId,
            userEmail: data.userEmail,
            collections: {
              clients: {
                count: data.collections.clients?.length || 0,
                hasError: data.collections.clients?.error ? true : false,
                error: data.collections.clients?.error,
              },
              payments: {
                count: data.collections.payments?.length || 0,
                hasError: data.collections.payments?.error ? true : false,
                error: data.collections.payments?.error,
              },
              settings: {
                exists:
                  data.collections.settings !== null &&
                  !data.collections.settings?.error,
                hasError: data.collections.settings?.error ? true : false,
                error: data.collections.settings?.error,
              },
              user: {
                exists:
                  data.collections.user !== null &&
                  !data.collections.user?.error,
                hasError: data.collections.user?.error ? true : false,
                error: data.collections.user?.error,
              },
            },
            rawData: data,
          };

          setImportPreview(preview);
          setShowImportModal(true);
        } catch (err: any) {
          console.error("Erro ao ler arquivo:", err);
          setError("Erro ao ler arquivo: " + err.message);
        } finally {
          setLoading(false);
        }
      }
    };
    input.click();
  };

  const handleConfirmImport = async () => {
    if (!user || !importPreview) return;

    setLoading(true);
    setError("");
    setShowImportModal(false);

    try {
      const data = importPreview.rawData;
      let importedCount = 0;
      const errors: string[] = [];

      // Importar clientes
      if (
        data.collections.clients &&
        Array.isArray(data.collections.clients) &&
        data.collections.clients.length > 0
      ) {
        try {
          for (const client of data.collections.clients) {
            if (client.id && client.name) {
              // Remover campos que não devem ser importados
              const { id, userId, createdAt, updatedAt, ...clientData } =
                client;

              // Adicionar dados do usuário atual
              const clientToImport = {
                ...clientData,
                userId: user.uid,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              await setDoc(clientDocument(user.uid, id), clientToImport);
              importedCount++;
            }
          }
        } catch (err: any) {
          errors.push(`Erro ao importar clientes: ${err.message}`);
        }
      }

      // Importar pagamentos
      if (
        data.collections.payments &&
        Array.isArray(data.collections.payments) &&
        data.collections.payments.length > 0
      ) {
        try {
          for (const payment of data.collections.payments) {
            if (payment.id && payment.clientName) {
              // Remover campos que não devem ser importados
              const { id, userId, createdAt, updatedAt, ...paymentData } =
                payment;

              // Adicionar dados do usuário atual
              const paymentToImport = {
                ...paymentData,
                userId: user.uid,
                createdAt: new Date(),
                updatedAt: new Date(),
              };

              await setDoc(loanDocument(user.uid, id), paymentToImport);
              importedCount++;
            }
          }
        } catch (err: any) {
          errors.push(`Erro ao importar pagamentos: ${err.message}`);
        }
      }

      // Importar configurações
      if (data.collections.settings && !data.collections.settings.error) {
        try {
          const { id, ...settingsData } = data.collections.settings;
          await setDoc(tenantAppSettingsDocument(user.uid), settingsData, {
            merge: true,
          });
          importedCount++;
        } catch (err: any) {
          errors.push(`Erro ao importar configurações: ${err.message}`);
        }
      }

      // Importar dados do usuário
      if (data.collections.user && !data.collections.user.error) {
        try {
          const { id, ...userData } = data.collections.user;
          await setDoc(userProfileDocument(user.uid), userData, { merge: true });
          importedCount++;
        } catch (err: any) {
          errors.push(`Erro ao importar dados do usuário: ${err.message}`);
        }
      }

      // Mostrar resultado
      if (errors.length > 0) {
        setError(`Importação concluída com erros: ${errors.join(", ")}`);
      } else {
        alert(
          `Importação concluída com sucesso! ${importedCount} itens importados.`
        );
      }

      // Limpar preview
      setImportPreview(null);
    } catch (err: any) {
      console.error("Erro na importação:", err);
      setError("Erro na importação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelImport = () => {
    setShowImportModal(false);
    setImportPreview(null);
  };

  // Abas de configuração
  const tabs = [
    { id: "general", label: "Geral", icon: faCog },
    { id: "theme", label: "Tema", icon: faPalette },
    { id: "backup", label: "Backup", icon: faDatabase },
    { id: "data", label: "Dados", icon: faChartBar },
  ];

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Configurações & Backup</h1>
        <p>Gerencie as configurações do sistema e backup dos dados</p>
      </div>

      {error && (
        <div
          className="error-message"
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {exportProgress && (
        <div
          className="progress-message"
          style={{
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            color: "#0369a1",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <div
            className="loading-spinner"
            style={{
              width: "16px",
              height: "16px",
              border: "2px solid #bae6fd",
              borderTop: "2px solid #0369a1",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          {exportProgress}
        </div>
      )}

      <div className="settings-container">
        <div className="settings-sidebar">
          <nav className="settings-nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                disabled={loading}
              >
                <span className="tab-icon">
                  <FontAwesomeIcon icon={tab.icon} />
                </span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="settings-content">
          {/* Aba Geral */}
          {activeTab === "general" && (
            <div className="settings-section">
              <h2>Informações Gerais</h2>
              <p>Configure as informações básicas da empresa</p>

              <div className="form-grid">
                <div className="form-group">
                  <label>Nome da Empresa</label>
                  <input
                    type="text"
                    value={settings.companyName}
                    onChange={(e) =>
                      handleInputChange("companyName", e.target.value)
                    }
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label>Telefone</label>
                  <input
                    type="text"
                    value={settings.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Endereço</label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) =>
                      handleInputChange("address", e.target.value)
                    }
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Cidade</label>
                  <input
                    type="text"
                    value={settings.city}
                    onChange={(e) => handleInputChange("city", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Estado</label>
                  <input
                    type="text"
                    value={settings.state}
                    onChange={(e) => handleInputChange("state", e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>CEP</label>
                  <input
                    type="text"
                    value={settings.zipCode}
                    onChange={(e) =>
                      handleInputChange("zipCode", e.target.value)
                    }
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Aba Tema */}
          {activeTab === "theme" && (
            <div className="settings-section">
              <h2>Configuração de Tema</h2>
              <p>Personalize a aparência do sistema</p>

              {/* Switch de Modo Escuro/Claro */}
              <div className="mode-switch-container">
                <div className="mode-switch-info">
                  <h3>Modo de Exibição</h3>
                  <p>
                    Escolha entre os modos claro, escuro ou meia noite para a
                    interface
                  </p>
                </div>
                <div className="mode-switch">
                  <button
                    className={`mode-btn ${mode === "light" ? "active" : ""}`}
                    onClick={() => setMode("light")}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faSun} />
                    <span>Claro</span>
                  </button>
                  <button
                    className={`mode-btn ${mode === "dark" ? "active" : ""}`}
                    onClick={() => setMode("dark")}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faMoon} />
                    <span>Escuro</span>
                  </button>
                  <button
                    className={`mode-btn ${
                      mode === "midnight" ? "active" : ""
                    }`}
                    onClick={() => setMode("midnight")}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faMoon} />
                    <span>Meia Noite</span>
                  </button>
                </div>
              </div>

              <div className="theme-options">
                <div className="theme-card">
                  <div className="theme-preview purple-theme">
                    <div className="theme-header">
                      <div className="theme-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className="theme-content">
                      <div className="theme-sidebar"></div>
                      <div className="theme-main">
                        <div className="theme-card-preview"></div>
                        <div className="theme-card-preview"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <h3>Tema Roxo</h3>
                    <p>Paleta de cores em tons de roxo, elegante e moderna</p>
                    <button
                      className={`theme-btn ${
                        theme === "purple" ? "active" : ""
                      }`}
                      onClick={() => setTheme("purple")}
                      disabled={loading}
                    >
                      {theme === "purple" ? "Ativo" : "Ativar"}
                    </button>
                  </div>
                </div>

                <div className="theme-card">
                  <div className="theme-preview blue-theme">
                    <div className="theme-header">
                      <div className="theme-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className="theme-content">
                      <div className="theme-sidebar"></div>
                      <div className="theme-main">
                        <div className="theme-card-preview"></div>
                        <div className="theme-card-preview"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <h3>Tema Azul</h3>
                    <p>
                      Paleta de cores em tons de azul, profissional e confiável
                    </p>
                    <button
                      className={`theme-btn ${
                        theme === "blue" ? "active" : ""
                      }`}
                      onClick={() => setTheme("blue")}
                      disabled={loading}
                    >
                      {theme === "blue" ? "Ativo" : "Ativar"}
                    </button>
                  </div>
                </div>

                <div className="theme-card">
                  <div className="theme-preview orange-theme">
                    <div className="theme-header">
                      <div className="theme-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className="theme-content">
                      <div className="theme-sidebar"></div>
                      <div className="theme-main">
                        <div className="theme-card-preview"></div>
                        <div className="theme-card-preview"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <h3>Tema Laranja</h3>
                    <p>
                      Paleta de cores em tons de laranja, energética e criativa
                    </p>
                    <button
                      className={`theme-btn ${
                        theme === "orange" ? "active" : ""
                      }`}
                      onClick={() => setTheme("orange")}
                      disabled={loading}
                    >
                      {theme === "orange" ? "Ativo" : "Ativar"}
                    </button>
                  </div>
                </div>

                <div className="theme-card">
                  <div className="theme-preview green-theme">
                    <div className="theme-header">
                      <div className="theme-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className="theme-content">
                      <div className="theme-sidebar"></div>
                      <div className="theme-main">
                        <div className="theme-card-preview"></div>
                        <div className="theme-card-preview"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <h3>Tema Verde</h3>
                    <p>
                      Paleta de cores em tons de verde, natural e sustentável
                    </p>
                    <button
                      className={`theme-btn ${
                        theme === "green" ? "active" : ""
                      }`}
                      onClick={() => setTheme("green")}
                      disabled={loading}
                    >
                      {theme === "green" ? "Ativo" : "Ativar"}
                    </button>
                  </div>
                </div>

                <div className="theme-card">
                  <div className="theme-preview red-theme">
                    <div className="theme-header">
                      <div className="theme-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className="theme-content">
                      <div className="theme-sidebar"></div>
                      <div className="theme-main">
                        <div className="theme-card-preview"></div>
                        <div className="theme-card-preview"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <h3>Tema Vermelho</h3>
                    <p>
                      Paleta de cores em tons de vermelho, intensa e apaixonada
                    </p>
                    <button
                      className={`theme-btn ${theme === "red" ? "active" : ""}`}
                      onClick={() => setTheme("red")}
                      disabled={loading}
                    >
                      {theme === "red" ? "Ativo" : "Ativar"}
                    </button>
                  </div>
                </div>

                <div className="theme-card">
                  <div className="theme-preview pink-theme">
                    <div className="theme-header">
                      <div className="theme-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                    <div className="theme-content">
                      <div className="theme-sidebar"></div>
                      <div className="theme-main">
                        <div className="theme-card-preview"></div>
                        <div className="theme-card-preview"></div>
                      </div>
                    </div>
                  </div>
                  <div className="theme-info">
                    <h3>Tema Rosa</h3>
                    <p>Paleta de cores em tons de rosa, suave e romântica</p>
                    <button
                      className={`theme-btn ${
                        theme === "pink" ? "active" : ""
                      }`}
                      onClick={() => setTheme("pink")}
                      disabled={loading}
                    >
                      {theme === "pink" ? "Ativo" : "Ativar"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="theme-info-section">
                <h3>
                  <FontAwesomeIcon
                    icon={faInfoCircle}
                    style={{ color: "var(--color-primary)" }}
                  />{" "}
                  Informações do Tema
                </h3>
                <ul>
                  <li>As mudanças de tema são aplicadas instantaneamente</li>
                  <li>O tema escolhido é salvo automaticamente</li>
                  <li>Você pode alternar entre os temas a qualquer momento</li>
                  <li>Todos os elementos da interface são atualizados</li>
                </ul>
              </div>
            </div>
          )}

          {/* Aba Backup */}
          {activeTab === "backup" && (
            <div className="settings-section">
              <h2>Configurações de Backup</h2>
              <p>Configure como seus dados serão protegidos e armazenados</p>

              {/* Status do Último Backup */}
              <div className="backup-status">
                <h4>
                  <FontAwesomeIcon
                    icon={faInfoCircle}
                    style={{ color: "var(--color-primary)" }}
                  />
                  Status do Backup
                </h4>
                <div className="status-grid">
                  <div className="status-item">
                    <div className="status-value">Hoje</div>
                    <div className="status-label">Último Backup</div>
                  </div>
                  <div className="status-item">
                    <div className="status-value">2.4 MB</div>
                    <div className="status-label">Tamanho Total</div>
                  </div>
                  <div className="status-item">
                    <div className="status-value">15</div>
                    <div className="status-label">Backups Salvos</div>
                  </div>
                  <div className="status-item">
                    <div className="status-value">100%</div>
                    <div className="status-label">Integridade</div>
                  </div>
                </div>
              </div>

              <div className="backup-options">
                <div className="backup-item">
                  <div className="backup-info">
                    <h3>
                      <FontAwesomeIcon
                        icon={faSync}
                        style={{ color: "#7c3aed" }}
                      />
                      Backup Automático
                    </h3>
                    <p>
                      Realize backups automaticamente em horários programados
                    </p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.backup.autoBackup}
                      onChange={(e) =>
                        handleBackupChange("autoBackup", e.target.checked)
                      }
                      disabled={loading}
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Frequência do Backup</label>
                  <select
                    value={settings.backup.frequency}
                    onChange={(e) =>
                      handleBackupChange("frequency", e.target.value)
                    }
                    disabled={loading}
                  >
                    <option value="hourly">A cada hora</option>
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Manter Backups (dias)</label>
                  <input
                    type="number"
                    value={settings.backup.keepDays}
                    onChange={(e) =>
                      handleBackupChange(
                        "keepDays",
                        Number.parseInt(e.target.value)
                      )
                    }
                    min="1"
                    max="365"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Configurações Avançadas */}
              <div className="backup-advanced-section">
                <h3>
                  <FontAwesomeIcon
                    icon={faCog}
                    style={{ color: "var(--color-primary)" }}
                  />
                  Configurações Avançadas
                </h3>

                {/* Configurações de Horário */}
                <div className="backup-schedule">
                  <h4>Horário do Backup Automático</h4>
                  <div className="schedule-options">
                    <div className="time-input-group">
                      <label>Horário Preferido</label>
                      <input
                        type="time"
                        value={settings.backup.preferredTime || "02:00"}
                        onChange={(e) =>
                          handleBackupChange("preferredTime", e.target.value)
                        }
                        disabled={loading}
                      />
                    </div>
                    <div className="time-input-group">
                      <label>Fuso Horário</label>
                      <select
                        value={settings.backup.timezone || "America/Sao_Paulo"}
                        onChange={(e) =>
                          handleBackupChange("timezone", e.target.value)
                        }
                        disabled={loading}
                      >
                        <option value="America/Sao_Paulo">
                          Brasília (GMT-3)
                        </option>
                        <option value="America/New_York">
                          Nova York (GMT-5)
                        </option>
                        <option value="Europe/London">Londres (GMT+0)</option>
                        <option value="Asia/Tokyo">Tóquio (GMT+9)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Tipos de Dados para Backup */}
                <div className="backup-data-types">
                  <h4>Dados para Incluir no Backup</h4>
                  <div className="data-type-options">
                    <div className="data-type-item">
                      <input
                        type="checkbox"
                        id="backup-clients"
                        checked={settings.backup.includeClients !== false}
                        onChange={(e) =>
                          handleBackupChange("includeClients", e.target.checked)
                        }
                        disabled={loading}
                      />
                      <label htmlFor="backup-clients">Dados dos Clientes</label>
                    </div>
                    <div className="data-type-item">
                      <input
                        type="checkbox"
                        id="backup-payments"
                        checked={settings.backup.includePayments !== false}
                        onChange={(e) =>
                          handleBackupChange(
                            "includePayments",
                            e.target.checked
                          )
                        }
                        disabled={loading}
                      />
                      <label htmlFor="backup-payments">
                        Histórico de Pagamentos
                      </label>
                    </div>
                    <div className="data-type-item">
                      <input
                        type="checkbox"
                        id="backup-settings"
                        checked={settings.backup.includeSettings !== false}
                        onChange={(e) =>
                          handleBackupChange(
                            "includeSettings",
                            e.target.checked
                          )
                        }
                        disabled={loading}
                      />
                      <label htmlFor="backup-settings">
                        Configurações do Sistema
                      </label>
                    </div>
                    <div className="data-type-item">
                      <input
                        type="checkbox"
                        id="backup-reports"
                        checked={settings.backup.includeReports !== false}
                        onChange={(e) =>
                          handleBackupChange("includeReports", e.target.checked)
                        }
                        disabled={loading}
                      />
                      <label htmlFor="backup-reports">Relatórios Gerados</label>
                    </div>
                  </div>
                </div>

                {/* Configurações de Segurança */}
                <div className="backup-security">
                  <h4>Segurança do Backup</h4>
                  <div className="security-options">
                    <div className="security-item">
                      <div className="security-info">
                        <h5>Criptografia de Dados</h5>
                        <p>
                          Protege os dados do backup com criptografia AES-256
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.backup.encryption !== false}
                          onChange={(e) =>
                            handleBackupChange("encryption", e.target.checked)
                          }
                          disabled={loading}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <div className="security-item">
                      <div className="security-info">
                        <h5>Verificação de Integridade</h5>
                        <p>
                          Verifica se os dados não foram corrompidos após o
                          backup
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.backup.integrityCheck !== false}
                          onChange={(e) =>
                            handleBackupChange(
                              "integrityCheck",
                              e.target.checked
                            )
                          }
                          disabled={loading}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <div className="security-item">
                      <div className="security-info">
                        <h5>Compressão de Arquivos</h5>
                        <p>Reduz o tamanho dos arquivos de backup</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.backup.compression !== false}
                          onChange={(e) =>
                            handleBackupChange("compression", e.target.checked)
                          }
                          disabled={loading}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Configurações de Retenção */}
                <div className="backup-retention">
                  <h4>Política de Retenção</h4>
                  <div className="retention-rules">
                    <div className="retention-rule">
                      <label>Backups Diários</label>
                      <input
                        type="number"
                        value={settings.backup.retentionDaily || 7}
                        onChange={(e) =>
                          handleBackupChange(
                            "retentionDaily",
                            Number.parseInt(e.target.value)
                          )
                        }
                        min="1"
                        max="30"
                        disabled={loading}
                      />
                      <select value="days" disabled>
                        <option value="days">dias</option>
                      </select>
                    </div>
                    <div className="retention-rule">
                      <label>Backups Semanais</label>
                      <input
                        type="number"
                        value={settings.backup.retentionWeekly || 4}
                        onChange={(e) =>
                          handleBackupChange(
                            "retentionWeekly",
                            Number.parseInt(e.target.value)
                          )
                        }
                        min="1"
                        max="12"
                        disabled={loading}
                      />
                      <select value="weeks" disabled>
                        <option value="weeks">semanas</option>
                      </select>
                    </div>
                    <div className="retention-rule">
                      <label>Backups Mensais</label>
                      <input
                        type="number"
                        value={settings.backup.retentionMonthly || 12}
                        onChange={(e) =>
                          handleBackupChange(
                            "retentionMonthly",
                            Number.parseInt(e.target.value)
                          )
                        }
                        min="1"
                        max="60"
                        disabled={loading}
                      />
                      <select value="months" disabled>
                        <option value="months">meses</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Configurações de Notificação */}
                <div className="backup-notifications">
                  <h4>Notificações de Backup</h4>
                  <div className="security-options">
                    <div className="security-item">
                      <div className="security-info">
                        <h5>Notificar Backup Bem-sucedido</h5>
                        <p>
                          Receba uma notificação quando o backup for concluído
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.backup.notifySuccess !== false}
                          onChange={(e) =>
                            handleBackupChange(
                              "notifySuccess",
                              e.target.checked
                            )
                          }
                          disabled={loading}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <div className="security-item">
                      <div className="security-info">
                        <h5>Notificar Falhas no Backup</h5>
                        <p>Receba alertas quando houver problemas no backup</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.backup.notifyFailure !== false}
                          onChange={(e) =>
                            handleBackupChange(
                              "notifyFailure",
                              e.target.checked
                            )
                          }
                          disabled={loading}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <div className="security-item">
                      <div className="security-info">
                        <h5>Relatório Semanal de Backup</h5>
                        <p>Receba um resumo semanal do status dos backups</p>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={settings.backup.weeklyReport || false}
                          onChange={(e) =>
                            handleBackupChange("weeklyReport", e.target.checked)
                          }
                          disabled={loading}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Ações de Backup */}
                <div className="backup-actions-advanced">
                  <button
                    className="backup-btn primary"
                    onClick={handleBackupNow}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faSave} />
                    Backup Completo Agora
                  </button>
                  <button
                    className="backup-btn secondary"
                    onClick={() => alert("Funcionalidade em desenvolvimento")}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faSync} />
                    Backup Incremental
                  </button>
                  <button
                    className="backup-btn secondary"
                    onClick={() => alert("Funcionalidade em desenvolvimento")}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    Restaurar Backup
                  </button>
                  <button
                    className="backup-btn secondary"
                    onClick={() => alert("Funcionalidade em desenvolvimento")}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faChartBar} />
                    Histórico de Backups
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Aba Dados */}
          {activeTab === "data" && (
            <div className="settings-section">
              <h2>Gerenciamento de Dados</h2>
              <p>Importe e exporte seus dados</p>

              <div className="data-actions">
                <div className="action-card">
                  <div className="action-icon">
                    <FontAwesomeIcon icon={faDownload} />
                  </div>
                  <div className="action-content">
                    <h3>Exportar Dados</h3>
                    <p>Baixe todos os seus dados em formato JSON</p>
                    <div
                      style={{
                        marginBottom: "16px",
                        fontSize: "14px",
                        color: "#64748b",
                      }}
                    >
                      <strong>Dados incluídos:</strong>
                      <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                        <li>Clientes e suas informações</li>
                        <li>Histórico de pagamentos</li>
                        <li>Configurações da empresa</li>
                        <li>Dados do usuário</li>
                      </ul>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={handleExportData}
                      disabled={loading}
                    >
                      {loading ? "Exportando..." : "Exportar Dados"}
                    </button>
                  </div>
                </div>

                <div className="action-card">
                  <div className="action-icon">
                    <FontAwesomeIcon icon={faUpload} />
                  </div>
                  <div className="action-content">
                    <h3>Importar Dados</h3>
                    <p>Restaure seus dados de um arquivo de backup</p>
                    <div
                      style={{
                        marginBottom: "16px",
                        fontSize: "14px",
                        color: "#64748b",
                      }}
                    >
                      <strong>Processo de importação:</strong>
                      <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                        <li>Selecione o arquivo JSON de backup</li>
                        <li>Visualize o preview dos dados</li>
                        <li>Confirme a importação</li>
                      </ul>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={handleImportData}
                      disabled={loading}
                    >
                      {loading ? "Processando..." : "Selecionar Arquivo"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="data-info">
                <h3>
                  <FontAwesomeIcon
                    icon={faInfoCircle}
                    style={{ color: "#7c3aed" }}
                  />{" "}
                  Informações Importantes
                </h3>
                <ul>
                  <li>Os dados são exportados em formato JSON</li>
                  <li>A importação substituirá os dados existentes</li>
                  <li>Sempre faça backup antes de importar novos dados</li>
                  <li>O sistema mostra um preview antes da importação</li>
                  <li>Dados de usuário são adaptados para sua conta atual</li>
                </ul>
              </div>
            </div>
          )}

          <div className="settings-footer">
            <button
              className="btn-primary"
              onClick={handleSaveSettings}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faSave} />
              Salvar Configurações
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Preview da Importação */}
      {showImportModal && importPreview && (
        <div className="modal-overlay" onClick={handleCancelImport}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Preview da Importação</h2>
              <button
                className="modal-close"
                onClick={handleCancelImport}
                disabled={loading}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <div className="import-preview">
              <div className="file-info">
                <h3>Informações do Arquivo</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <strong>Arquivo:</strong> {importPreview.fileName}
                  </div>
                  <div className="info-item">
                    <strong>Tamanho:</strong> {importPreview.fileSize}
                  </div>
                  <div className="info-item">
                    <strong>Data de Exportação:</strong>{" "}
                    {new Date(importPreview.exportDate).toLocaleString("pt-BR")}
                  </div>
                  <div className="info-item">
                    <strong>Usuário Original:</strong> {importPreview.userEmail}
                  </div>
                </div>
              </div>

              <div className="collections-preview">
                <h3>Dados que serão Importados</h3>

                <div className="collection-item">
                  <div className="collection-header">
                    <FontAwesomeIcon
                      icon={faUsers}
                      style={{ color: "#7c3aed" }}
                    />
                    <span>Clientes</span>
                  </div>
                  <div className="collection-status">
                    {importPreview.collections.clients.hasError ? (
                      <span className="error-status">
                        Erro: {importPreview.collections.clients.error}
                      </span>
                    ) : (
                      <span className="success-status">
                        {importPreview.collections.clients.count} clientes
                      </span>
                    )}
                  </div>
                </div>

                <div className="collection-item">
                  <div className="collection-header">
                    <FontAwesomeIcon
                      icon={faCreditCard}
                      style={{ color: "#7c3aed" }}
                    />
                    <span>Pagamentos</span>
                  </div>
                  <div className="collection-status">
                    {importPreview.collections.payments.hasError ? (
                      <span className="error-status">
                        Erro: {importPreview.collections.payments.error}
                      </span>
                    ) : (
                      <span className="success-status">
                        {importPreview.collections.payments.count} pagamentos
                      </span>
                    )}
                  </div>
                </div>

                <div className="collection-item">
                  <div className="collection-header">
                    <FontAwesomeIcon
                      icon={faCog}
                      style={{ color: "#7c3aed" }}
                    />
                    <span>Configurações</span>
                  </div>
                  <div className="collection-status">
                    {importPreview.collections.settings.hasError ? (
                      <span className="error-status">
                        Erro: {importPreview.collections.settings.error}
                      </span>
                    ) : importPreview.collections.settings.exists ? (
                      <span className="success-status">
                        Configurações disponíveis
                      </span>
                    ) : (
                      <span className="warning-status">
                        Nenhuma configuração encontrada
                      </span>
                    )}
                  </div>
                </div>

                <div className="collection-item">
                  <div className="collection-header">
                    <FontAwesomeIcon
                      icon={faUser}
                      style={{ color: "#7c3aed" }}
                    />
                    <span>Dados do Usuário</span>
                  </div>
                  <div className="collection-status">
                    {importPreview.collections.user.hasError ? (
                      <span className="error-status">
                        Erro: {importPreview.collections.user.error}
                      </span>
                    ) : importPreview.collections.user.exists ? (
                      <span className="success-status">
                        Dados do usuário disponíveis
                      </span>
                    ) : (
                      <span className="warning-status">
                        Nenhum dado de usuário encontrado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="import-warning">
                <h3>
                  <FontAwesomeIcon
                    icon={faInfoCircle}
                    style={{ color: "#f59e0b" }}
                  />{" "}
                  Aviso Importante
                </h3>
                <p>
                  A importação irá substituir os dados existentes. Certifique-se
                  de que você tem um backup atual antes de prosseguir.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelImport}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmImport}
                disabled={loading}
                style={{
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Importando..." : "Confirmar Importação"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}

export default SettingsPage;
