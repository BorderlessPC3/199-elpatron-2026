import type React from "react";

import {
  faChartBar,
  faClock,
  faCreditCard,
  faEdit,
  faExclamationTriangle,
  faFilePdf,
  faMoneyBill,
  faPlus,
  faSearch,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import { useSearchParams } from "react-router-dom";
import appLogo from "../../assets/logo-elpatron.png";
import { useAuth } from "../../contexts/AuthContext";
import { useToastHelpers } from "../../contexts/ToastContext";
import { usePayments } from "../../hooks";
import type {
  Payment,
  PaymentInstallment,
  PaymentStatus,
} from "../../types/payment";
import { getErrorMessage } from "../../utils/error";
import { formatInputDate, parseLocalDate } from "../../utils/paymentNormalizer";
import LoadingPage from "../LoadingPage/LoadingPage";
import PaymentModal from "./PaymentModal.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import "./PaymentsPage.css";

interface PaymentStatusInfo {
  key: "late" | "on_time";
  label: "Atrasado" | "Em dia";
  detail: string;
}

const loadImageAsDataUrl = async (imageUrl: string): Promise<string> => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Falha ao carregar logo para o PDF");
  }

  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Falha ao converter logo para PDF"));
    reader.readAsDataURL(blob);
  });
};

function PaymentsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] =
    useState<(() => Promise<void>) | null>(null);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [installmentsModalPayment, setInstallmentsModalPayment] =
    useState<Payment | null>(null);
  const [draftInstallments, setDraftInstallments] = useState<PaymentInstallment[]>([]);
  const [statusUpdatePayment, setStatusUpdatePayment] = useState<Payment | null>(null);
  const [paidNowCount, setPaidNowCount] = useState<number>(1);

  const { user } = useAuth();
  const { showSuccess, showError } = useToastHelpers();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    payments,
    clients,
    loading,
    error,
    setError,
    loadPayments,
    loadClients,
    savePaymentWithClient,
    removePayment,
    updatePaymentInstallments,
  } = usePayments();

  useEffect(() => {
    if (!user) return;
    loadPayments(user.uid);
    loadClients(user.uid);
  }, [user, loadPayments, loadClients]);

  useEffect(() => {
    const selectedClient = searchParams.get("client");
    if (!selectedClient) return;

    setSearchTerm(selectedClient);
    setClientFilter(selectedClient);
    setStatusFilter("all");
  }, [searchParams]);

  const uniqueClients = useMemo(
    () => [...new Set(payments.map((payment) => payment.clientName))].sort(),
    [payments],
  );

  const generateSuggestions = (term: string) => {
    if (!term.trim()) return [];
    return uniqueClients
      .filter((client) => client.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 5);
  };

  const paymentMetaById = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const map = new Map<
      string,
      {
        statusInfo: PaymentStatusInfo;
        nextReceiveDate: string | null;
        overdue: boolean;
        paidInstallmentsCount: number;
        unpaidInstallmentsCount: number;
      }
    >();

    payments.forEach((payment) => {
      let paidInstallmentsCount = 0;
      let overdueCount = 0;
      let nextDueTimestamp = Number.POSITIVE_INFINITY;
      let nextReceiveDate: string | null = null;

      payment.installments.forEach((installment) => {
        if (installment.paid) {
          paidInstallmentsCount += 1;
          return;
        }

        const dueTime = parseLocalDate(installment.dueDate).getTime();
        if (dueTime < todayTime) {
          overdueCount += 1;
        }
        if (dueTime < nextDueTimestamp) {
          nextDueTimestamp = dueTime;
          nextReceiveDate = installment.dueDate;
        }
      });

      const statusInfo: PaymentStatusInfo =
        overdueCount > 0
          ? {
              key: "late",
              label: "Atrasado",
              detail: overdueCount === 1 ? "1 parcela" : `${overdueCount} parcelas`,
            }
          : { key: "on_time", label: "Em dia", detail: "" };

      map.set(payment.id, {
        statusInfo,
        nextReceiveDate,
        overdue: overdueCount > 0,
        paidInstallmentsCount,
        unpaidInstallmentsCount: payment.installments.length - paidInstallmentsCount,
      });
    });

    return map;
  }, [payments]);

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) => {
      const matchesSearch = payment.clientName
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        paymentMetaById.get(payment.id)?.statusInfo.key === statusFilter;
      const matchesClient =
        clientFilter === "all" || payment.clientName === clientFilter;
      return matchesSearch && matchesStatus && matchesClient;
    });
  }, [payments, searchTerm, statusFilter, clientFilter, paymentMetaById]);

  const sortedPayments = useMemo(() => {
    const sorted = [...filteredPayments].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "name":
          aValue = a.clientName.toLowerCase();
          bValue = b.clientName.toLowerCase();
          break;
        case "status":
          aValue = paymentMetaById.get(a.id)?.statusInfo.key ?? "on_time";
          bValue = paymentMetaById.get(b.id)?.statusInfo.key ?? "on_time";
          break;
        case "amount":
          aValue = a.loanAmount;
          bValue = b.loanAmount;
          break;
        case "date":
          aValue = paymentMetaById.get(a.id)?.nextReceiveDate
            ? parseLocalDate(paymentMetaById.get(a.id)?.nextReceiveDate ?? "").getTime()
            : Number.MAX_SAFE_INTEGER;
          bValue = paymentMetaById.get(b.id)?.nextReceiveDate
            ? parseLocalDate(paymentMetaById.get(b.id)?.nextReceiveDate ?? "").getTime()
            : Number.MAX_SAFE_INTEGER;
          break;
        default:
          return 0;
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    return sorted;
  }, [filteredPayments, sortField, sortDirection, paymentMetaById]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, clientFilter, sortField, sortDirection]);

  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(sortedPayments.length / itemsPerPage),
    );
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [sortedPayments.length, itemsPerPage, currentPage]);

  const totalItems = sortedPayments.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const visiblePayments = sortedPayments.slice(startIndex, endIndex);

  const pageNumbers = useMemo(() => {
    const maxLen = 5;
    const pages: number[] = [];
    const start = Math.max(
      1,
      Math.min(currentPage - 2, totalPages - maxLen + 1),
    );
    const finish = Math.min(totalPages, start + maxLen - 1);
    for (let p = start; p <= finish; p++) pages.push(p);
    return pages;
  }, [currentPage, totalPages]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return parseLocalDate(date).toLocaleDateString("pt-BR");
  };

  const totalRevenue = payments.reduce(
    (sum, p) =>
      sum +
      p.installments
        .filter((installment) => installment.paid)
        .reduce((subtotal, installment) => subtotal + installment.amount, 0),
    0,
  );

  const pendingAmount = payments.reduce(
    (sum, p) =>
      sum +
      p.installments
        .filter((installment) => !installment.paid)
        .reduce((subtotal, installment) => subtotal + installment.amount, 0),
    0,
  );

  const handleNewPayment = () => {
    setEditingPayment(null);
    setIsModalOpen(true);
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setIsModalOpen(true);
  };

  const handleSavePayment = async (
    paymentData: Omit<Payment, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => {
    if (!user) return;

    try {
      await savePaymentWithClient(user.uid, paymentData, editingPayment?.id);
      if (editingPayment) {
        showSuccess(
          "Pagamento Atualizado",
          `Pagamento de ${paymentData.clientName} foi atualizado`,
        );
      } else {
        const statusMessage =
          paymentData.status === "paid" ? "recebido" : "registrado";
        showSuccess(
          "Pagamento Criado",
          `Pagamento de ${paymentData.clientName} foi ${statusMessage}`,
        );
      }

      await loadPayments(user.uid);
      await loadClients(user.uid);
      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorMessage = "Erro ao salvar pagamento: " + getErrorMessage(err);
      setError(errorMessage);
      showError("Erro ao Salvar", errorMessage);
    }
  };

  const handleDeletePayment = async (id: string) => {
    const paymentToDelete = payments.find((p) => p.id === id);
    setConfirmMessage(
      `Tem certeza que deseja excluir o pagamento de ${paymentToDelete?.clientName || "este cliente"}?`,
    );
    setConfirmAction(() => async () => {
      try {
        setConfirmLoading(true);
        setError("");
        if (!user) return;
        await removePayment(user.uid, id);

        showSuccess(
          "Pagamento Excluído",
          `Pagamento de ${paymentToDelete?.clientName || "cliente"} foi removido`,
        );

        if (user) await loadPayments(user.uid);
      } catch (err: unknown) {
        const errorMessage = "Erro ao excluir pagamento: " + getErrorMessage(err);
        setError(errorMessage);
        showError("Erro ao Excluir", errorMessage);
      } finally {
        setConfirmLoading(false);
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  const openStatusUpdateModal = (payment: Payment) => {
    setStatusUpdatePayment(payment);
    setPaidNowCount(1);
  };

  const applyPaidInstallmentsFromStatus = async () => {
    if (!statusUpdatePayment || !user) return;

    try {
      const unpaidInstallments = statusUpdatePayment.installments
        .filter((installment) => !installment.paid)
        .sort(
          (a, b) =>
            parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime(),
        );

      const maxPayable = unpaidInstallments.length;
      const safeCount = Math.max(0, Math.min(paidNowCount, maxPayable));
      if (safeCount === 0) {
        setStatusUpdatePayment(null);
        return;
      }

      const toMarkPaid = new Set(
        unpaidInstallments.slice(0, safeCount).map((installment) => installment.id),
      );

      const updatedInstallments = statusUpdatePayment.installments.map((installment) =>
        toMarkPaid.has(installment.id)
          ? { ...installment, paid: true, paidAt: formatInputDate(new Date()) }
          : installment,
      );

      const hasOverdueAfterUpdate = updatedInstallments.some((installment) => {
        if (installment.paid) return false;
        const dueDate = parseLocalDate(installment.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() < today.getTime();
      });
      const updatedStatus: PaymentStatus = hasOverdueAfterUpdate ? "late" : "paid";

      await updatePaymentInstallments(
        user.uid,
        statusUpdatePayment.id,
        updatedInstallments,
        updatedStatus,
      );

      showSuccess(
        "Status atualizado",
        `${safeCount} parcela(s) marcada(s) como paga(s).`,
      );
      setStatusUpdatePayment(null);
      await loadPayments(user.uid);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao atualizar status";
      setError(`Erro ao atualizar status: ${message}`);
      showError("Erro ao atualizar", `Erro ao atualizar status: ${message}`);
    }
  };

  const openInstallmentsModal = (payment: Payment) => {
    setInstallmentsModalPayment(payment);
    setDraftInstallments(payment.installments);
  };

  const toggleDraftInstallment = (installmentId: string, checked: boolean) => {
    setDraftInstallments((prev) =>
      prev.map((installment) =>
        installment.id === installmentId
          ? {
              ...installment,
              paid: checked,
              paidAt: checked ? formatInputDate(new Date()) : null,
            }
          : installment,
      ),
    );
  };

  const saveInstallmentsFromModal = async () => {
    if (!installmentsModalPayment || !user) return;
    try {
      const allPaid = draftInstallments.every((installment) => installment.paid);
      const updatedStatus: PaymentStatus = allPaid ? "paid" : "late";

      await updatePaymentInstallments(
        user.uid,
        installmentsModalPayment.id,
        draftInstallments,
        updatedStatus,
      );

      showSuccess("Parcelas atualizadas", "As parcelas foram atualizadas com sucesso");
      setInstallmentsModalPayment(null);
      setDraftInstallments([]);
      if (user) await loadPayments(user.uid);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Falha ao atualizar parcelas";
      setError(`Erro ao atualizar parcelas: ${message}`);
      showError("Erro ao atualizar", `Erro ao atualizar parcelas: ${message}`);
    }
  };

  const exportPaymentPDF = async (payment: Payment) => {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;
    let y = 18;

    const paidCount = payment.installments.filter((item) => item.paid).length;
    const pendingCount = payment.installments.length - paidCount;

    try {
      const logoDataUrl = await loadImageAsDataUrl(appLogo);
      doc.addImage(logoDataUrl, "PNG", pageWidth - 50, 10, 36, 20);
    } catch {
      // Se a logo falhar, o PDF continua sendo gerado normalmente.
    }

    doc.setFontSize(16);
    doc.text("Resumo de empréstimo", margin, y);
    y += 10;

    doc.setFontSize(11);
    const metadata = [
      `Cliente: ${payment.clientName}`,
      `Email: ${payment.clientEmail}`,
      `Valor emprestado: ${formatCurrency(payment.loanAmount)}`,
      `Primeiro recebimento: ${formatDate(payment.firstReceiveDate)}`,
      `Parcelas: ${payment.installments.length}`,
      `Pagas: ${paidCount} | Pendentes: ${pendingCount}`,
      `Data de emissao: ${new Date().toLocaleString("pt-BR")}`,
    ];

    metadata.forEach((line) => {
      doc.text(line, margin, y);
      y += 6;
    });

    y += 4;
    doc.setFontSize(12);
    doc.text("Parcelas (Data / Valor + Status)", margin, y);
    y += 8;

    const installmentsPerBlock = 3;
    const rowTopHeight = 9;
    const rowBottomHeight = 12;
    const blockHeight = rowTopHeight + rowBottomHeight + 6;

    for (let i = 0; i < payment.installments.length; i += installmentsPerBlock) {
      const block = payment.installments.slice(i, i + installmentsPerBlock);
      const cellWidth = contentWidth / block.length;

      if (y + blockHeight > pageHeight - 18) {
        doc.addPage();
        y = 18;
      }

      block.forEach((installment, index) => {
        const x = margin + index * cellWidth;
        const dateLabel = formatDate(installment.dueDate);
        const statusLabel = installment.paid ? "Pago" : "Pendente";
        const valueAndStatus = `${formatCurrency(installment.amount)} | ${statusLabel}`;

        doc.setDrawColor(200, 200, 200);
        doc.rect(x, y, cellWidth, rowTopHeight);
        doc.rect(x, y + rowTopHeight, cellWidth, rowBottomHeight);

        doc.setFontSize(9);
        doc.setTextColor(33, 37, 41);
        doc.text(dateLabel, x + cellWidth / 2, y + 6, { align: "center" });

        doc.setFontSize(9);
        if (installment.paid) {
          doc.setTextColor(22, 163, 74);
        } else {
          doc.setTextColor(217, 119, 6);
        }
        const wrapped = doc.splitTextToSize(valueAndStatus, cellWidth - 4);
        doc.text(wrapped.slice(0, 2), x + 2, y + rowTopHeight + 5);
      });

      doc.setTextColor(33, 37, 41);
      y += blockHeight;
    }

    const fileName = `pagamento-${payment.clientName.replace(/\s+/g, "-").toLowerCase()}-${
      new Date().toISOString().split("T")[0]
    }.pdf`;
    doc.save(fileName);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) return null;

    return sortDirection === "asc" ? "↑" : "↓";
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.trim()) {
      const newSuggestions = generateSuggestions(value);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (clientName: string) => {
    setSearchTerm(clientName);
    setClientFilter(clientName);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleClientFilterChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const value = e.target.value;
    setClientFilter(value);
    if (value === "all") {
      setSearchTerm("");
    } else {
      setSearchTerm(value);
    }
  };

  const handleClientClick = (clientName: string) => {
    setSearchTerm(clientName);
    setClientFilter(clientName);
    setStatusFilter("all");
    setSearchParams({ client: clientName });
  };

  if (loading && payments.length === 0) {
    return <LoadingPage message="Carregando empréstimos" />;
  }

  return (
    <div className="payments-page">
      <div className="payments-header">
        <div className="header-content">
          <h1>Empréstimos</h1>
          <p>Acompanhe o histórico de empréstimos e receitas</p>
        </div>
        <button
          className="btn-primary"
          onClick={handleNewPayment}
          disabled={loading}
        >
          <FontAwesomeIcon icon={faPlus} />
          Novo Empréstimo
        </button>
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

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-icon">
            <FontAwesomeIcon
              icon={faMoneyBill}
              style={{ color: "var(--color-primary)" }}
            />
          </div>
          <div className="card-content">
            <div className="card-label">Receita Total</div>
            <div className="card-value">{formatCurrency(totalRevenue)}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <FontAwesomeIcon
              icon={faClock}
              style={{ color: "var(--color-primary)" }}
            />
          </div>
          <div className="card-content">
            <div className="card-label">Pendente</div>
            <div className="card-value">{formatCurrency(pendingAmount)}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-icon">
            <FontAwesomeIcon
              icon={faChartBar}
              style={{ color: "var(--color-primary)" }}
            />
          </div>
          <div className="card-content">
            <div className="card-label">Total de Transações</div>
            <div className="card-value">{payments.length}</div>
          </div>
        </div>
      </div>

      <div className="payments-filters">
        <div className="search-box">
          <span className="search-icon">
            <FontAwesomeIcon icon={faSearch} />
          </span>
          <input
            type="text"
            placeholder="Buscar por nome do cliente..."
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => {
              if (searchTerm.trim() && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            disabled={loading}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="search-suggestions">
              {suggestions.map((client, index) => (
                <button
                  type="button"
                  key={index}
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(client)}
                >
                  {client}
                </button>
              ))}
            </div>
          )}
        </div>

        <select
          value={clientFilter}
          onChange={handleClientFilterChange}
          className="filter-select"
          disabled={loading}
        >
          <option value="all">Todos os Clientes</option>
          {uniqueClients.map((client) => (
            <option key={client} value={client}>
              {client}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
          disabled={loading}
        >
          <option value="all">Todos os Status</option>
          <option value="on_time">Em dia</option>
          <option value="late">Atrasados</option>
        </select>
      </div>

      <div className="payments-table-container">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}

        <table className="payments-table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort("name")}>
                Cliente {getSortIcon("name")}
              </th>
              <th>Descrição</th>
              <th className="sortable" onClick={() => handleSort("amount")}>
                Valor Emprestado {getSortIcon("amount")}
              </th>
              <th>Parcelas</th>
              <th className="sortable" onClick={() => handleSort("status")}>
                Status {getSortIcon("status")}
              </th>
              <th className="sortable" onClick={() => handleSort("date")}>
                Próx. Recebimento {getSortIcon("date")}
              </th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {visiblePayments.map((payment) => (
              <tr key={payment.id}>
                <td>
                  <div className="client-info">
                    <div className="client-avatar">
                      {payment.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <button
                        type="button"
                        className="client-name client-name-link"
                        onClick={() => handleClientClick(payment.clientName)}
                        title="Filtrar todos os pagamentos deste cliente"
                      >
                        {payment.clientName}
                      </button>
                      <div className="client-email">{payment.clientEmail}</div>
                    </div>
                  </div>
                </td>
                <td className="description">{payment.description}</td>
                <td
                  className={`amount ${
                    paymentMetaById.get(payment.id)?.statusInfo.key === "on_time"
                      ? "paid"
                      : ""
                  }`}
                >
                  {formatCurrency(payment.loanAmount)}
                </td>
                <td>
                  <div className="installment-summary">
                    <span>
                      {paymentMetaById.get(payment.id)?.paidInstallmentsCount ?? 0}/
                      {payment.installments.length} pagas
                    </span>
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => openInstallmentsModal(payment)}
                      disabled={loading}
                    >
                      Atualizar parcelas
                    </button>
                  </div>
                </td>
                <td>
                  {(() => {
                    const statusInfo = paymentMetaById.get(payment.id)?.statusInfo ?? {
                      key: "on_time" as const,
                      label: "Em dia" as const,
                      detail: "",
                    };
                    return (
                      <button
                        type="button"
                        className={`status-display-btn ${statusInfo.key}`}
                        onClick={() => openStatusUpdateModal(payment)}
                        disabled={loading}
                        title="Clique para informar parcelas pagas"
                      >
                        <span>{statusInfo.label}</span>
                        {statusInfo.key === "late" && (
                          <small>{statusInfo.detail} atrasada(s)</small>
                        )}
                      </button>
                    );
                  })()}
                </td>
                <td>
                  {(() => {
                    const paymentMeta = paymentMetaById.get(payment.id);
                    const nextReceiveDate = paymentMeta?.nextReceiveDate ?? null;
                    const overdue = paymentMeta?.overdue ?? false;

                    if (!nextReceiveDate) return "Sem pendência";

                    return (
                      <div className="next-receive-cell">
                        <span>{formatDate(nextReceiveDate)}</span>
                        {overdue && (
                          <span className="overdue-warning" title="Pagamento atrasado">
                            <FontAwesomeIcon icon={faExclamationTriangle} />
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td>
                  <div className="actions">
                    <button
                      className="btn-action pdf"
                      onClick={() => exportPaymentPDF(payment)}
                      title="Gerar PDF"
                      disabled={loading}
                    >
                      <FontAwesomeIcon icon={faFilePdf} />
                    </button>
                    <button
                      className="btn-action edit"
                      onClick={() => handleEditPayment(payment)}
                      title="Editar"
                      disabled={loading}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      className="btn-action delete"
                      onClick={() => handleDeletePayment(payment.id)}
                      title="Excluir"
                      disabled={loading}
                    >
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {confirmOpen && (
          <ConfirmModal
            title="Excluir Pagamento"
            message={confirmMessage}
            loading={confirmLoading}
            confirmLabel="Excluir"
            cancelLabel="Cancelar"
            onConfirm={() => {
              if (confirmAction) confirmAction();
            }}
            onCancel={() => setConfirmOpen(false)}
          />
        )}

        {filteredPayments.length === 0 && !loading && (
          <div className="empty-state">
            <span className="empty-icon">
              <FontAwesomeIcon
                icon={faCreditCard}
                style={{ color: "var(--color-primary)" }}
              />
            </span>
            <h3>Nenhum pagamento encontrado</h3>
            <p>Tente ajustar os filtros de busca</p>
          </div>
        )}

        {filteredPayments.length > 0 && (
          <div
            className="pagination-container"
            role="navigation"
            aria-label="Paginação de pagamentos"
          >
            <div className="items-per-page">
              <label htmlFor="payments-items-per-page">Itens por página</label>
              <select
                id="payments-items-per-page"
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="page-info">
              {`Mostrando ${
                totalItems === 0 ? 0 : startIndex + 1
              }–${endIndex} de ${totalItems}`}
            </div>

            <div className="pagination-controls">
              <button
                className="page-button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                aria-label="Primeira página"
                title="Primeira página"
              >
                {"«"}
              </button>
              <button
                className="page-button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Página anterior"
                title="Página anterior"
              >
                {"‹"}
              </button>

              {pageNumbers.map((p) => (
                <button
                  key={p}
                  className={`page-button ${p === currentPage ? "active" : ""}`}
                  onClick={() => setCurrentPage(p)}
                  aria-current={p === currentPage ? "page" : undefined}
                >
                  {p}
                </button>
              ))}

              <button
                className="page-button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                aria-label="Próxima página"
                title="Próxima página"
              >
                {"›"}
              </button>
              <button
                className="page-button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Última página"
                title="Última página"
              >
                {"»"}
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <PaymentModal
          payment={editingPayment}
          onSave={handleSavePayment}
          onClose={() => setIsModalOpen(false)}
          loading={loading}
          clients={clients}
        />
      )}

      {statusUpdatePayment && (
        <div
          className="modal-overlay"
          onClick={() => {
            setStatusUpdatePayment(null);
            setPaidNowCount(1);
          }}
        >
          <div className="installments-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Atualizar status - {statusUpdatePayment.clientName}</h3>
            <p className="status-update-help">
              Informe quantas parcelas foram pagas agora.
            </p>
            <div className="form-group">
              <label htmlFor="paid-now-count">Parcelas pagas</label>
              <input
                id="paid-now-count"
                type="number"
                min={0}
                max={
                  paymentMetaById.get(statusUpdatePayment.id)?.unpaidInstallmentsCount ??
                  statusUpdatePayment.installments.filter((installment) => !installment.paid)
                    .length
                }
                value={paidNowCount}
                onChange={(e) => setPaidNowCount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="installments-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setStatusUpdatePayment(null);
                  setPaidNowCount(1);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={applyPaidInstallmentsFromStatus}
                disabled={loading}
              >
                Confirmar atualização
              </button>
            </div>
          </div>
        </div>
      )}

      {installmentsModalPayment && (
        <div
          className="modal-overlay"
          onClick={() => {
            setInstallmentsModalPayment(null);
            setDraftInstallments([]);
          }}
        >
          <div className="installments-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Parcelas - {installmentsModalPayment.clientName}</h3>
            <div className="installments-modal-list">
              {draftInstallments.map((installment, index) => (
                <label key={installment.id} className="installment-modal-row">
                  <span className="installment-modal-index">{index + 1}a</span>
                  <span>{formatDate(installment.dueDate)}</span>
                  <span>{formatCurrency(installment.amount)}</span>
                  <input
                    type="checkbox"
                    checked={installment.paid}
                    onChange={(e) =>
                      toggleDraftInstallment(installment.id, e.target.checked)
                    }
                  />
                </label>
              ))}
            </div>
            <div className="installments-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setInstallmentsModalPayment(null);
                  setDraftInstallments([]);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={saveInstallmentsFromModal}
                disabled={loading}
              >
                Salvar parcelas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentsPage;
