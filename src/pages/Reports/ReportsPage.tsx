import { faDownload, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getDocs, orderBy, query } from "firebase/firestore";
import jsPDF from "jspdf";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { loansItemsCollection } from "../../services/firestorePaths";
import type { Payment } from "../../types/payment";
import { getErrorMessage } from "../../utils/error";
import { normalizePayment } from "../../utils/paymentNormalizer";
import LoadingPage from "../LoadingPage/LoadingPage";
import "./ReportsPage.css";

interface ReportFilter {
  startDate: string;
  endDate: string;
}

interface FinancialSummaryData {
  title: string;
  period: string;
  metrics: Array<{ label: string; value: string }>;
  totalPayments: number;
  paidPayments: number;
  pendingPayments: number;
  totalLoaned: number;
  totalReceived: number;
  totalPending: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

function ReportsPage() {
  const [reportData, setReportData] = useState<FinancialSummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<ReportFilter>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const { user } = useAuth();

  const generateReport = async () => {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const paymentsRef = loansItemsCollection(user.uid);
      const paymentsQuery = query(
        paymentsRef,
        orderBy("createdAt", "desc"),
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      const payments: Payment[] = paymentsSnapshot.docs.map((docSnap) =>
        normalizePayment({
          id: docSnap.id,
          ...(docSnap.data() as Record<string, unknown>),
        }),
      );

      const startDate = new Date(`${filters.startDate}T00:00:00`);
      const endDate = new Date(`${filters.endDate}T23:59:59`);

      const filteredPayments = payments.filter((payment) => {
        const paymentDate = new Date(payment.date);
        return paymentDate >= startDate && paymentDate <= endDate;
      });

      const totalLoaned = filteredPayments.reduce(
        (sum, payment) => sum + payment.loanAmount,
        0,
      );
      const totalReceived = filteredPayments.reduce(
        (sum, payment) =>
          sum +
          payment.installments
            .filter((installment) => installment.paid)
            .reduce((subtotal, installment) => subtotal + installment.amount, 0),
        0,
      );
      const totalPending = filteredPayments.reduce(
        (sum, payment) =>
          sum +
          payment.installments
            .filter((installment) => !installment.paid)
            .reduce((subtotal, installment) => subtotal + installment.amount, 0),
        0,
      );

      const paidPayments = filteredPayments.filter((payment) =>
        payment.installments.every((installment) => installment.paid),
      ).length;
      const pendingPayments = filteredPayments.length - paidPayments;
      const receiveRate =
        totalLoaned > 0 ? ((totalReceived / totalLoaned) * 100).toFixed(1) : "0.0";

      setReportData({
        title: "Resumo Financeiro",
        period: `${filters.startDate} a ${filters.endDate}`,
        metrics: [
          { label: "Total Emprestado", value: formatCurrency(totalLoaned) },
          { label: "Total Recebido", value: formatCurrency(totalReceived) },
          { label: "Total Pendente", value: formatCurrency(totalPending) },
          { label: "Taxa de Recebimento", value: `${receiveRate}%` },
        ],
        totalPayments: filteredPayments.length,
        paidPayments,
        pendingPayments,
        totalLoaned,
        totalReceived,
        totalPending,
      });
    } catch (err: unknown) {
      setError(`Erro ao gerar relatório: ${getErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF("p", "mm", "a4");
    const margin = 20;
    let y = 28;

    doc.setFontSize(18);
    doc.text(reportData.title, margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Período: ${reportData.period}`, margin, y);
    y += 12;

    reportData.metrics.forEach((metric) => {
      doc.setFontSize(12);
      doc.text(`${metric.label}: ${metric.value}`, margin, y);
      y += 8;
    });

    y += 4;
    doc.text(`Total de registros: ${reportData.totalPayments}`, margin, y);
    y += 8;
    doc.text(`Pagamentos concluídos: ${reportData.paidPayments}`, margin, y);
    y += 8;
    doc.text(`Pagamentos com pendências: ${reportData.pendingPayments}`, margin, y);
    y += 8;
    doc.text(`Emissão: ${new Date().toLocaleString("pt-BR")}`, margin, y);

    doc.save(`resumo-financeiro-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (loading && !reportData) {
    return <LoadingPage message="Carregando relatório financeiro" />;
  }

  return (
    <div className="reports-page">
      <div className="reports-header">
        <h1>Relatórios</h1>
        <p>Resumo financeiro por período</p>

        <div className="report-filter-card">
          <div className="report-filter-grid">
            <div className="form-group">
              <label>Data inicial</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, startDate: e.target.value }))
                }
              />
            </div>
            <div className="form-group">
              <label>Data final</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, endDate: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="report-filter-actions">
            <button
              className="btn-primary"
              onClick={generateReport}
              disabled={loading}
            >
              {loading ? "Gerando..." : "Gerar informações"}
            </button>
            <button
              className="btn-secondary"
              onClick={handleExportPDF}
              disabled={!reportData || loading}
            >
              <FontAwesomeIcon icon={faDownload} />
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          {error}
        </div>
      )}

      {reportData && (
        <div className="report-viewer">
          <div className="report-header">
            <div className="report-info">
              <h2>{reportData.title}</h2>
              <p>Período: {reportData.period}</p>
            </div>
          </div>

          <div className="report-content">
            <div className="metrics-grid">
              {reportData.metrics.map((metric) => (
                <div key={metric.label} className="metric-card">
                  <div className="metric-label">{metric.label}</div>
                  <div className="metric-value">{metric.value}</div>
                </div>
              ))}
            </div>

            <div className="report-section">
              <h3>Resumo do Período</h3>
              <div className="report-summary">
                <div className="summary-item">
                  <strong>Total de registros:</strong> {reportData.totalPayments}
                </div>
                <div className="summary-item">
                  <strong>Pagamentos concluídos:</strong> {reportData.paidPayments}
                </div>
                <div className="summary-item">
                  <strong>Pagamentos com pendências:</strong>{" "}
                  {reportData.pendingPayments}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportsPage;
