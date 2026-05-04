import type React from "react";

import {
  faChartBar,
  faCircleCheck,
  faCircleInfo,
  faClock,
  faCreditCard,
  faEdit,
  faExclamationTriangle,
  faFilePdf,
  faList,
  faMoneyBill,
  faPlus,
  faSearch,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSearchParams } from "react-router-dom";
import appLogo from "../../assets/logo-elpatron.png";
import { useAuth } from "../../contexts/AuthContext";
import { useToastHelpers } from "../../contexts/ToastContext";
import { usePayments } from "../../hooks";
import type {
  Payment,
} from "../../types/payment";
import { getErrorMessage } from "../../utils/error";
import { parseLocalDate } from "../../utils/paymentNormalizer";
import LoadingPage from "../LoadingPage/LoadingPage";
import PaymentModal from "./PaymentModal.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import "./PaymentsPage.css";

interface PaymentStatusInfo {
  key: "late" | "on_time";
  label: string;
  detail: string;
}

interface PendingInstallmentConfirmation {
  payment: Payment;
  installmentId: string;
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
  const [confirmTitle, setConfirmTitle] = useState("Confirmar ação");
  const [confirmLabel, setConfirmLabel] = useState("Confirmar");

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [installmentsModalPayment, setInstallmentsModalPayment] = useState<Payment | null>(null);

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
        payment.paymentStatus === "overdue"
          ? {
              key: "late",
              label: "Atrasado",
              detail: overdueCount === 1 ? "1 parcela" : `${overdueCount} parcelas`,
            }
          : payment.paymentStatus === "paid"
            ? { key: "on_time", label: "Pago", detail: "" }
            : { key: "on_time", label: "Pendente", detail: "" };

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
      const savedId = await savePaymentWithClient(
        user.uid,
        paymentData,
        editingPayment?.id,
      );
      if (editingPayment) {
        showSuccess(
          "Pagamento Atualizado",
          `Pagamento de ${paymentData.clientName} foi atualizado`,
        );
      } else {
        showSuccess(
          "Empréstimo Criado",
          `Empréstimo de ${paymentData.clientName} criado com sucesso`,
        );
      }

      await loadPayments(user.uid);
      await loadClients(user.uid);

      if (!editingPayment?.id) {
        const now = new Date();
        const pdfPayment: Payment = {
          id: savedId,
          userId: user.uid,
          clientName: paymentData.clientName,
          clientEmail: paymentData.clientEmail,
          amount: paymentData.amount,
          loanAmount: paymentData.loanAmount,
          firstReceiveDate: paymentData.firstReceiveDate,
          installmentCount: paymentData.installmentCount,
          installments: paymentData.installments,
          date: paymentData.date,
          status: paymentData.status,
          paymentMethod: paymentData.paymentMethod,
          description: paymentData.description,
          paymentStatus: "pending",
          createdAt: now,
          updatedAt: now,
        };
        try {
          await exportPaymentPDF(pdfPayment);
          showSuccess(
            "PDF gerado",
            "O comprovante foi baixado automaticamente.",
          );
        } catch (pdfErr: unknown) {
          showError(
            "PDF",
            `Empréstimo salvo, mas o PDF falhou: ${getErrorMessage(pdfErr)}`,
          );
        }
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorMessage = "Erro ao salvar pagamento: " + getErrorMessage(err);
      setError(errorMessage);
      showError("Erro ao Salvar", errorMessage);
    }
  };

  const handleDeletePayment = async (id: string) => {
    const paymentToDelete = payments.find((p) => p.id === id);
    setConfirmTitle("Excluir Pagamento");
    setConfirmLabel("Excluir");
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

  const requestInstallmentPaymentConfirmation = ({
    payment,
    installmentId,
  }: PendingInstallmentConfirmation) => {
    const installment = payment.installments.find((item) => item.id === installmentId);
    if (!installment || installment.paid) return;

    setConfirmTitle("Confirmar pagamento");
    setConfirmLabel("Confirmar");
    setConfirmMessage(
      [
        "Tem certeza que deseja marcar esta parcela como PAGA?",
        `Data: ${formatDate(installment.dueDate)}`,
        `Valor: ${formatCurrency(installment.amount)}`,
      ].join("\n"),
    );
    setConfirmAction(() => async () => {
      await handleConfirmInstallmentPayment(payment, installmentId);
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const openInstallmentsModal = (payment: Payment) => {
    setInstallmentsModalPayment(payment);
  };

  const handleConfirmInstallmentPayment = async (
    payment: Payment,
    installmentId: string,
  ) => {
    if (!user) return;
    const installmentToConfirm = payment.installments.find(
      (installment) => installment.id === installmentId,
    );
    if (!installmentToConfirm || installmentToConfirm.paid) return;

    const paidAt = new Date().toISOString();
    const updatedInstallments = payment.installments.map((installment) =>
      installment.id === installmentId
        ? { ...installment, paid: true, paidAt }
        : installment,
    );
    const updatedPayment: Payment = {
      ...payment,
      installments: updatedInstallments,
    };
    // Atualização otimista no modal para feedback imediato.
    setInstallmentsModalPayment(updatedPayment);

    try {
      setError("");
      await updatePaymentInstallments(user.uid, payment.id, updatedInstallments);
      try {
        await exportPaymentPDF(updatedPayment);
      } catch {
        showError("Erro ao gerar PDF", "Não foi possível gerar o PDF automaticamente");
      }
      await loadPayments(user.uid);
      setInstallmentsModalPayment(updatedPayment);
      showSuccess(
        "Parcela e PDF",
        `Pagamento registrado para ${payment.clientName}. O comprovante foi baixado.`,
      );
    } catch (err: unknown) {
      const errorMessage = "Erro ao confirmar pagamento: " + getErrorMessage(err);
      setError(errorMessage);
      setInstallmentsModalPayment(payment);
      showError("Erro na Confirmação", errorMessage);
    }
  };

  const exportPaymentPDF = async (payment: Payment) => {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();

    const paidCount = payment.installments.filter((item) => item.paid).length;
    const pendingCount = payment.installments.length - paidCount;
    const emission = new Date().toLocaleString("pt-BR");

    try {
      const logoDataUrl = await loadImageAsDataUrl(appLogo);
      doc.addImage(logoDataUrl, "PNG", pageWidth - 44, 10, 32, 18);
    } catch {
      // Se a logo falhar, o PDF continua sendo gerado normalmente.
    }

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("Resumo de empréstimo", margin, 22);

    let nextY = 28;
    const lineHeight = 5.5;
    const gapAfterLabel = 3;

    const addInfoField = (label: string, value: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      const labelText = `${label}:`;
      doc.text(labelText, margin, nextY);
      const labelW = doc.getTextWidth(labelText);
      const valueX = margin + labelW + gapAfterLabel;
      const valueMaxW = pageWidth - margin - valueX;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      const valueLines = doc.splitTextToSize(value, Math.max(24, valueMaxW));
      doc.text(valueLines, valueX, nextY);
      nextY += Math.max(lineHeight, valueLines.length * lineHeight) + 2.5;
    };

    addInfoField("Cliente", payment.clientName);
    addInfoField("E-mail", payment.clientEmail);
    addInfoField("Valor emprestado", formatCurrency(payment.loanAmount));
    addInfoField("Primeiro recebimento", formatDate(payment.firstReceiveDate));
    addInfoField("Total de parcelas", String(payment.installments.length));
    addInfoField("Parcelas pagas", String(paidCount));
    addInfoField("Parcelas pendentes", String(pendingCount));
    addInfoField("Data de emissão", emission);

    nextY += 4;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("Cronograma de parcelas", margin, nextY);
    nextY += 4;

    const instBody = payment.installments.map((inst, i) => [
      `${i + 1}ª`,
      formatDate(inst.dueDate),
      formatCurrency(inst.amount),
      inst.paid ? "Pago" : "Pendente",
    ]);

    autoTable(doc, {
      startY: nextY,
      head: [["Parcela", "Vencimento", "Valor (R$)", "Situação"]],
      body: instBody,
      theme: "grid",
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 10,
        halign: "center",
      },
      styles: {
        fontSize: 9.5,
        cellPadding: 3.5,
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        valign: "middle",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 22 },
        1: { halign: "center", cellWidth: 36 },
        2: { halign: "right", cellWidth: 36 },
        3: { halign: "center", cellWidth: 28 },
      },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const inst = payment.installments[data.row.index];
        if (!inst) return;
        if (inst.paid) {
          data.cell.styles.fillColor = [209, 250, 229];
          data.cell.styles.textColor = [5, 122, 85];
        } else {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [185, 28, 28];
        }
      },
    });

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
                      Gerenciar parcelas
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
                        disabled
                        title="Status calculado com base nas parcelas"
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
            title={confirmTitle}
            message={confirmMessage}
            loading={confirmLoading}
            confirmLabel={confirmLabel}
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

      {installmentsModalPayment && (
        <div
          className="modal-overlay"
          onClick={() => {
            setInstallmentsModalPayment(null);
          }}
        >
          <div className="installments-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="installments-modal-title">
              <FontAwesomeIcon icon={faList} aria-hidden />
              Parcelas — {installmentsModalPayment.clientName}
            </h3>
            <div className="status-update-help">
              <p className="installments-status-line">
                <FontAwesomeIcon icon={faCircleInfo} aria-hidden />
                <span>
                  Status atual:{" "}
                  <strong>
                    {installmentsModalPayment.paymentStatus === "paid"
                      ? "Pago"
                      : installmentsModalPayment.paymentStatus === "overdue"
                        ? "Atrasado"
                        : "Pendente"}
                  </strong>
                </span>
              </p>
              <p>
                Marque manualmente a parcela como paga para gerar o PDF automático.
              </p>
            </div>
            <div className="form-group installments-manage-list">
              {installmentsModalPayment.installments.map((installment) => (
                <div
                  key={installment.id}
                  className={`installment-manage-row ${installment.paid ? "is-paid" : "is-pending"}`}
                >
                  <span className="installment-manage-row-text">
                    <FontAwesomeIcon
                      icon={installment.paid ? faCircleCheck : faClock}
                      className="installment-row-status-icon"
                      aria-hidden
                    />
                    <span>
                      {formatDate(installment.dueDate)} —{" "}
                      {formatCurrency(installment.amount)} —{" "}
                      {installment.paid ? "PAGO" : "PENDENTE"}
                    </span>
                  </span>
                  <button
                    type="button"
                    className={
                      installment.paid
                        ? "btn-installment-confirmed"
                        : "btn-installment-pending"
                    }
                    disabled={loading || installment.paid}
                    onClick={() =>
                      requestInstallmentPaymentConfirmation({
                        payment: installmentsModalPayment,
                        installmentId: installment.id,
                      })
                    }
                  >
                    {installment.paid ? "Confirmado" : "Marcar como pago"}
                  </button>
                </div>
              ))}
            </div>
            <div className="installments-modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => exportPaymentPDF(installmentsModalPayment)}
              >
                Gerar PDF para envio
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setInstallmentsModalPayment(null);
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PaymentsPage;
