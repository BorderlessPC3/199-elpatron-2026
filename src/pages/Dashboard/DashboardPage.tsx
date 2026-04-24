import {
  faCalendarAlt,
  faChartBar,
  faHourglassHalf,
  faMoneyBillWave,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../../contexts/AuthContext";
import { saveClient, type ClientSaveInput } from "../../services/clientService";
import { savePayment, type PaymentSaveInput } from "../../services/paymentService";
import { fetchUserClientsPayments } from "../../services/fetchUserClientsPayments";
import type { Client } from "../../types/client";
import type { Payment } from "../../types/payment";
import { getErrorMessage } from "../../utils/error";
import { parseLocalDate } from "../../utils/paymentNormalizer";
import ClientModal from "../Clients/ClientModal";
import LoadingPage from "../LoadingPage/LoadingPage";
import PaymentModal from "../Payments/PaymentModal";
import "./DashboardPage.css";

interface ReportFilter {
  type: "pending" | "paid" | "monthly" | "all";
  month?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
}

interface ReportData {
  title: string;
  subtitle: string;
  totalAmount: number;
  totalCount: number;
  payments: Payment[];
}


function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [openModal, setOpenModal] = useState<"client" | "payment" | "report" | null>(null);
  const [reportFilter, setReportFilter] = useState<ReportFilter>({
    type: "all",
  });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [showReportPreview, setShowReportPreview] = useState(false);
  const [upcomingDays, setUpcomingDays] = useState(7);
  const [chartMonths, setChartMonths] = useState(6);

  const { user } = useAuth();

  // Carregar dados do Firestore
  const loadDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError("");

      const { clients: clientsData, payments: paymentsData } =
        await fetchUserClientsPayments(user.uid);

      setClients(clientsData);
      setPayments(paymentsData);

    } catch (err: unknown) {
      setError("Erro ao carregar dados: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  useEffect(() => {
    if (showReportPreview) {
      const data = generateReportData();
      setReportData(data);
    }
  }, [showReportPreview, reportFilter, payments]);

  const panelMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const rangeEnd = new Date(today);
    rangeEnd.setDate(rangeEnd.getDate() + upcomingDays);
    const rangeEndTime = rangeEnd.getTime();

    const installments = payments.flatMap((payment) =>
      payment.installments.map((installment) => ({
        ...installment,
        clientName: payment.clientName,
      })),
    );

    const pendingInstallments = installments.filter((i) => !i.paid);
    const paidInstallments = installments.filter((i) => i.paid);
    const overdueInstallments = pendingInstallments.filter(
      (i) => parseLocalDate(i.dueDate).getTime() < todayTime,
    );

    const receiveToday = pendingInstallments
      .filter((i) => parseLocalDate(i.dueDate).getTime() === todayTime)
      .reduce((sum, i) => sum + i.amount, 0);

    const receiveUpcoming = pendingInstallments
      .filter((i) => {
        const dueTime = parseLocalDate(i.dueDate).getTime();
        return dueTime > todayTime && dueTime <= rangeEndTime;
      })
      .reduce((sum, i) => sum + i.amount, 0);

    return {
      totalLoaned: payments.reduce((sum, p) => sum + (p.loanAmount || 0), 0),
      totalReceived: paidInstallments.reduce((sum, i) => sum + i.amount, 0),
      totalOpen: pendingInstallments.reduce((sum, i) => sum + i.amount, 0),
      overdueValue: overdueInstallments.reduce((sum, i) => sum + i.amount, 0),
      delayedClientsCount: new Set(overdueInstallments.map((i) => i.clientName))
        .size,
      overdueInstallmentsCount: overdueInstallments.length,
      receiveToday,
      receiveUpcoming,
    };
  }, [payments, upcomingDays]);

  const chartData = useMemo(() => {
    const monthLabels = [
      "Jan",
      "Fev",
      "Mar",
      "Abr",
      "Mai",
      "Jun",
      "Jul",
      "Ago",
      "Set",
      "Out",
      "Nov",
      "Dez",
    ];

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const buckets: {
      key: string;
      label: string;
      recebido: number;
      emAberto: number;
      previsto: number;
    }[] = [];
    for (let i = 0; i < chartMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({
        key,
        label: `${monthLabels[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`,
        recebido: 0,
        emAberto: 0,
        previsto: 0,
      });
    }
    const indexByKey = new Map(buckets.map((b, idx) => [b.key, idx]));

    const installments = payments.flatMap((payment) => payment.installments);

    installments.forEach((item) => {
      const d = parseLocalDate(item.dueDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const idx = indexByKey.get(key);
      if (idx === undefined) return;

      buckets[idx].previsto += item.amount;
      if (item.paid) buckets[idx].recebido += item.amount;
      if (!item.paid) buckets[idx].emAberto += item.amount;
    });

    const paidTotal = installments
      .filter((i) => i.paid)
      .reduce((sum, i) => sum + i.amount, 0);

    const overdueTotal = installments
      .filter((i) => !i.paid && parseLocalDate(i.dueDate).getTime() < todayTime)
      .reduce((sum, i) => sum + i.amount, 0);

    const onTimeNotDueTotal = installments
      .filter((i) => !i.paid && parseLocalDate(i.dueDate).getTime() >= todayTime)
      .reduce((sum, i) => sum + i.amount, 0);

    return {
      comparison: buckets,
      donut: [
        { name: "Pago", value: paidTotal, color: "#16a34a" },
        { name: "Atrasado", value: overdueTotal, color: "#dc2626" },
        { name: "Em dia (a vencer)", value: onTimeNotDueTotal, color: "#d97706" },
      ],
    };
  }, [payments, chartMonths]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatTooltipCurrency = (value: unknown) =>
    formatCurrency(Number(value || 0));
  const formatAxisNumber = (value: unknown) =>
    `$${new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0))}`;

  const handleSaveClient = async (clientData: ClientSaveInput) => {
    if (!user) return;

    try {
      setLoading(true);
      setError("");

      await saveClient(user.uid, clientData);

      setOpenModal(null);
      await loadDashboardData();
    } catch (err: unknown) {
      setError("Erro ao salvar cliente: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayment = async (paymentData: PaymentSaveInput) => {
    if (!user) return;

    try {
      setLoading(true);
      setError("");

      await savePayment(user.uid, paymentData);

      setOpenModal(null);
      await loadDashboardData();
    } catch (err: unknown) {
      setError("Erro ao salvar pagamento: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReportAction = (
    reportType: "pending" | "paid" | "monthly" | "all",
  ) => {
    setReportFilter({ type: reportType });
    setShowReportPreview(true);
    setOpenModal(null);
  };

  const handlePendingReport = () => handleGenerateReportAction("pending");
  const handlePaidReport = () => handleGenerateReportAction("paid");
  const handleMonthlyReport = () => handleGenerateReportAction("monthly");
  const handleAllReport = () => handleGenerateReportAction("all");

  const handleGeneratePDF = async () => {
    if (!reportData) return;

    setLoading(true);
    setError("");

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      const contentWidth = pageWidth - margin * 2;

      // Cores do tema profissional
      const primaryColor: [number, number, number] = [44, 62, 80]; // Azul escuro
      const secondaryColor: [number, number, number] = [52, 73, 94]; // Azul médio
      const accentColor: [number, number, number] = [116, 125, 136]; // Cinza
      const lightGray: [number, number, number] = [245, 247, 250]; // Cinza claro
      const successGreen: [number, number, number] = [16, 185, 129]; // Verde sucesso
      const warningOrange: [number, number, number] = [245, 158, 11]; // Laranja aviso
      const dangerRed: [number, number, number] = [239, 68, 68]; // Vermelho erro
      const white: [number, number, number] = [255, 255, 255];
      const black: [number, number, number] = [0, 0, 0];

      // Função para adicionar linha horizontal
      const addHorizontalLine = (
        y: number,
        width: number = contentWidth,
        color: number[] = accentColor,
      ) => {
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.5);
        doc.line(margin, y, margin + width, y);
      };

      // Função para adicionar retângulo com borda
      const addBorderedRect = (
        x: number,
        y: number,
        width: number,
        height: number,
        fillColor?: number[],
        borderColor?: number[],
      ) => {
        if (fillColor) {
          doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
          doc.rect(x, y, width, height, "F");
        }
        const border = borderColor || accentColor;
        doc.setDrawColor(border[0], border[1], border[2]);
        doc.setLineWidth(0.3);
        doc.rect(x, y, width, height, "S");
      };

      // Função para adicionar badge de status
      const addStatusBadge = (status: string, x: number, y: number) => {
        const statusText = getStatusText(status);
        let badgeColor: number[];

        switch (status) {
          case "paid":
            badgeColor = successGreen;
            break;
          case "pending":
            badgeColor = warningOrange;
            break;
          case "failed":
            badgeColor = dangerRed;
            break;
          default:
            badgeColor = accentColor;
        }

        // Calcular largura do texto
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        const textWidth = doc.getTextWidth(statusText);
        const badgeWidth = textWidth + 8;
        const badgeHeight = 6;

        // Desenhar badge
        doc.setFillColor(badgeColor[0], badgeColor[1], badgeColor[2]);
        doc.roundedRect(x, y - 4, badgeWidth, badgeHeight, 2, 2, "F");

        // Texto do badge
        doc.setTextColor(white[0], white[1], white[2]);
        doc.text(statusText, x + badgeWidth / 2, y, { align: "center" });
      };

      // Cabeçalho profissional otimizado
      doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.rect(0, 0, pageWidth, 45, "F");

      // Logo/Nome da empresa
      doc.setTextColor(white[0], white[1], white[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("El Patrón", margin, 22);

      // Subtítulo da empresa
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(lightGray[0], lightGray[1], lightGray[2]);
      doc.text("Sistema de Gestão Financeira Empresarial", margin, 30);

      // Informações de geração (posicionamento melhorado)
      const currentDate = new Date().toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      const currentTime = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const generationText = `Emissão: ${currentDate} às ${currentTime}`;
      doc.text(generationText, pageWidth - margin, 30, { align: "right" });

      // Linha separadora no cabeçalho
      addHorizontalLine(40, contentWidth, white);

      // Conteúdo principal
      let currentY = 60;

      // Título do relatório com destaque
      doc.setTextColor(black[0], black[1], black[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(reportData.title, margin, currentY);
      currentY += 15;

      // Subtítulo do relatório
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(reportData.subtitle, margin, currentY);
      currentY += 20;

      // Informações do relatório em cards otimizados
      const cardWidth = (contentWidth - 20) / 3;
      const cardHeight = 30;
      const cardSpacing = 10;

      // Card 1 - Total de registros
      addBorderedRect(
        margin,
        currentY,
        cardWidth,
        cardHeight,
        lightGray,
        primaryColor,
      );
      doc.setTextColor(black[0], black[1], black[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(
        reportData.totalCount.toString(),
        margin + cardWidth / 2,
        currentY + 12,
        { align: "center" },
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text("Total de Registros", margin + cardWidth / 2, currentY + 22, {
        align: "center",
      });

      // Card 2 - Valor total
      addBorderedRect(
        margin + cardWidth + cardSpacing,
        currentY,
        cardWidth,
        cardHeight,
        lightGray,
        successGreen,
      );
      doc.setTextColor(black[0], black[1], black[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        formatCurrency(reportData.totalAmount),
        margin + cardWidth + cardSpacing + cardWidth / 2,
        currentY + 12,
        { align: "center" },
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(
        "Valor Total",
        margin + cardWidth + cardSpacing + cardWidth / 2,
        currentY + 22,
        { align: "center" },
      );

      // Card 3 - Período do relatório
      addBorderedRect(
        margin + (cardWidth + cardSpacing) * 2,
        currentY,
        cardWidth,
        cardHeight,
        lightGray,
        accentColor,
      );
      const periodText =
        reportFilter.type === "monthly" ? "Mês Atual" : "Todos os Períodos";
      doc.setTextColor(black[0], black[1], black[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        periodText,
        margin + (cardWidth + cardSpacing) * 2 + cardWidth / 2,
        currentY + 12,
        { align: "center" },
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
      doc.text(
        "Período",
        margin + (cardWidth + cardSpacing) * 2 + cardWidth / 2,
        currentY + 22,
        { align: "center" },
      );

      currentY += cardHeight + 20;

      // Estatísticas detalhadas (se houver espaço)
      if (reportData.payments.length > 0 && currentY < pageHeight - 100) {
        // Título da seção
        doc.setTextColor(black[0], black[1], black[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Análise por Status", margin, currentY);
        currentY += 12;

        // Estatísticas por status
        const statusStats = reportData.payments.reduce<Record<string, number>>((acc, payment) => {
          acc[payment.status] = (acc[payment.status] || 0) + 1;
          return acc;
        }, {});

        const statusLabels = {
          paid: "Pagos",
          pending: "Pendentes",
          failed: "Falharam",
          refunded: "Reembolsados",
        };

        // Criar tabela de estatísticas compacta
        const statsData = Object.entries(statusStats).map(([status, count]) => [
          statusLabels[status as keyof typeof statusLabels] || status,
          (count as number).toString(),
          formatCurrency(
            reportData.payments
              .filter((p) => p.status === status)
              .reduce((sum, p) => sum + p.amount, 0),
          ),
        ]);

        autoTable(doc, {
          head: [["Status", "Qtd", "Valor Total"]],
          body: statsData,
          startY: currentY,
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 8,
            cellPadding: 3,
            textColor: black,
            fontStyle: "normal",
            lineColor: accentColor,
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: primaryColor,
            textColor: white,
            fontStyle: "bold",
            fontSize: 9,
          },
          alternateRowStyles: {
            fillColor: lightGray,
          },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 20 },
            2: { cellWidth: 35 },
          },
        });

        currentY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY) + 15;
      }

      // Tabela detalhada de pagamentos (com verificação de espaço)
      if (reportData.payments.length > 0 && currentY < pageHeight - 80) {
        // Título da tabela
        doc.setTextColor(black[0], black[1], black[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("Detalhamento dos Pagamentos", margin, currentY);
        currentY += 8;

        // Função para truncar texto
        const truncateText = (text: string, maxLength: number) => {
          return text.length > maxLength
            ? text.substring(0, maxLength - 3) + "..."
            : text;
        };

        // Preparar dados da tabela otimizada
        const tableData = reportData.payments.map((payment, index) => [
          (index + 1).toString(), // Número sequencial
          truncateText(payment.clientName, 20),
          truncateText(payment.clientEmail, 25),
          formatCurrency(payment.amount),
          payment.date,
          getStatusText(payment.status),
          getPaymentMethodText(payment.paymentMethod),
          truncateText(payment.description || "-", 20),
        ]);

        // Configuração da tabela otimizada
        autoTable(doc, {
          head: [
            [
              "#",
              "Cliente",
              "Email",
              "Valor",
              "Data",
              "Status",
              "Método",
              "Descrição",
            ],
          ],
          body: tableData,
          startY: currentY,
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 7,
            cellPadding: 3,
            textColor: black,
            fontStyle: "normal",
            lineColor: accentColor,
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: primaryColor,
            textColor: white,
            fontStyle: "bold",
            fontSize: 8,
          },
          alternateRowStyles: {
            fillColor: lightGray,
          },
          columnStyles: {
            0: { cellWidth: 10 }, // Número
            1: { cellWidth: 28 }, // Cliente
            2: { cellWidth: 30 }, // Email
            3: { cellWidth: 22 }, // Valor
            4: { cellWidth: 18 }, // Data
            5: { cellWidth: 18 }, // Status
            6: { cellWidth: 18 }, // Método
            7: { cellWidth: 20 }, // Descrição
          },
          didDrawCell: function (data) {
            // Adicionar badges de status na coluna de status
            if (data.column.index === 5 && data.row.index > 0) {
              const status = reportData.payments[data.row.index - 1].status;
              const cell = data.cell;
              const x = cell.x + cell.width / 2;
              const y = cell.y + cell.height / 2 + 2;
              addStatusBadge(status, x, y);
            }
          },
        });

        currentY = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY) + 15;
      }

      // Resumo executivo (se houver espaço)
      if (currentY < pageHeight - 60) {
        doc.setTextColor(black[0], black[1], black[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Resumo Executivo", margin, currentY);
        currentY += 8;

        // Linha separadora
        addHorizontalLine(currentY - 3, 40, primaryColor);
        currentY += 10;

        // Texto do resumo
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(
          secondaryColor[0],
          secondaryColor[1],
          secondaryColor[2],
        );

        const summaryText = [
          `• Este relatório contém ${reportData.totalCount} registro(s) de pagamentos.`,
          `• O valor total processado é de ${formatCurrency(
            reportData.totalAmount,
          )}.`,
          `• Período analisado: ${
            reportFilter.type === "monthly" ? "Mês atual" : "Todos os períodos"
          }.`,
          `• Relatório gerado automaticamente pelo sistema El Patrón.`,
        ];

        summaryText.forEach((text, index) => {
          doc.text(text, margin, currentY + index * 5);
        });
      }

      // Rodapé profissional otimizado
      const addFooter = (pageNumber: number, totalPages: number) => {
        const footerY = pageHeight - 15;

        // Linha separadora
        addHorizontalLine(footerY - 5, contentWidth, accentColor);

        // Informações do rodapé
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);

        // Página (esquerda)
        doc.text(`Página ${pageNumber} de ${totalPages}`, margin, footerY);

        // Logo e informações da empresa (centro)
        doc.setFont("helvetica", "bold");
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(
          "El Patrón - Sistema de Gestão Financeira",
          pageWidth / 2,
          footerY,
          { align: "center" },
        );

        // Data e hora (direita)
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
        const now = new Date();
        const dateTime = now.toLocaleString("pt-BR");
        doc.text(dateTime, pageWidth - margin, footerY, { align: "right" });
      };

      // Adicionar rodapé em todas as páginas
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }

      // Salvar PDF com nome mais descritivo
      const reportType =
        {
          pending: "pendentes",
          paid: "realizados",
          monthly: "mensal",
          all: "completo",
        }[reportFilter.type] || "geral";

      const fileName = `relatorio-pagamentos-${reportType}-${
        new Date().toISOString().split("T")[0]
      }.pdf`;
      doc.save(fileName);

      setShowReportPreview(false);
      setReportData(null);
    } catch (err: unknown) {
      setError("Erro ao gerar PDF: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "paid":
        return "Pago";
      case "pending":
        return "Pendente";
      case "failed":
        return "Falhou";
      case "refunded":
        return "Reembolsado";
      default:
        return status;
    }
  };

  const getPaymentMethodText = (method: string) => {
    switch (method) {
      case "credit_card":
        return "Cartão";
      case "pix":
        return "PIX";
      case "bank_transfer":
        return "Transferência";
      case "cash":
        return "Dinheiro";
      default:
        return method;
    }
  };

  const generateReportData = () => {
    if (!payments.length) return null;

    let filteredPayments = [...payments];
    let title = "";
    let subtitle = "";

    switch (reportFilter.type) {
      case "pending":
        filteredPayments = payments.filter((p) => p.status === "pending");
        title = "Relatório de Pagamentos Pendentes";
        subtitle = "Lista de todos os pagamentos com status pendente";
        break;

      case "paid":
        filteredPayments = payments.filter((p) => p.status === "paid");
        title = "Relatório de Pagamentos Realizados";
        subtitle = "Lista de todos os pagamentos com status pago";
        break;

      case "monthly":
        {
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();
          filteredPayments = payments.filter((p) => {
            const paymentDate = new Date(p.date);
            return (
              paymentDate.getMonth() === currentMonth &&
              paymentDate.getFullYear() === currentYear
            );
          });
          title = "Relatório Mensal de Pagamentos";
          subtitle = `Pagamentos do mês de ${new Date().toLocaleDateString(
            "pt-BR",
            { month: "long", year: "numeric" },
          )}`;
        }
        break;

      case "all":
      default:
        title = "Relatório Completo de Pagamentos";
        subtitle = "Lista de todos os pagamentos registrados";
        break;
    }

    const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

    return {
      title,
      subtitle,
      totalAmount,
      totalCount: filteredPayments.length,
      payments: filteredPayments.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    };
  };
  if (loading && clients.length === 0 && payments.length === 0) {
    return <LoadingPage message="Carregando dashboard" />;
  }

  return (
    <div className="dashboard-page">
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

      <div className="dashboard-custom-sections">
        <section className="custom-section">
          <h2>Resumo financeiro</h2>
          <div className="custom-metrics-grid">
            <div className="custom-metric-card">
              <span>Total emprestado</span>
              <strong>{formatCurrency(panelMetrics.totalLoaned)}</strong>
            </div>
            <div className="custom-metric-card">
              <span>Total recebido</span>
              <strong>{formatCurrency(panelMetrics.totalReceived)}</strong>
            </div>
            <div className="custom-metric-card">
              <span>Total em aberto</span>
              <strong>{formatCurrency(panelMetrics.totalOpen)}</strong>
            </div>
          </div>
        </section>

        <section className="custom-section">
          <div className="custom-section-header">
            <h2>Gráficos comparativos</h2>
            <div className="custom-days-filter">
              <label htmlFor="dashboard-chart-months">Período</label>
              <select
                id="dashboard-chart-months"
                value={chartMonths}
                onChange={(e) => setChartMonths(Number(e.target.value))}
              >
                <option value={3}>3 meses</option>
                <option value={6}>6 meses</option>
                <option value={12}>12 meses</option>
              </select>
            </div>
          </div>

          <div className="charts-grid">
            <article className="chart-card">
              <h3>Recebido x Em aberto</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData.comparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" />
                    <YAxis
                      width={88}
                      tickMargin={8}
                      tickFormatter={(value) => formatAxisNumber(value)}
                    />
                    <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="recebido"
                      name="Recebido"
                      stroke="#16a34a"
                      fill="#86efac"
                      fillOpacity={0.35}
                    />
                    <Area
                      type="monotone"
                      dataKey="emAberto"
                      name="Em aberto"
                      stroke="#d97706"
                      fill="#fcd34d"
                      fillOpacity={0.35}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="chart-card">
              <h3>Distribuição da carteira</h3>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Tooltip formatter={(value) => formatTooltipCurrency(value)} />
                    <Legend />
                    <Pie
                      data={chartData.donut}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {chartData.donut.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>
        </section>

        <section className="custom-section">
          <h2>Visão de risco</h2>
          <div className="custom-metrics-grid">
            <div className="custom-metric-card risk">
              <span>Valor vencido</span>
              <strong>{formatCurrency(panelMetrics.overdueValue)}</strong>
            </div>
            <div className="custom-metric-card risk">
              <span>Clientes em atraso</span>
              <strong>{panelMetrics.delayedClientsCount}</strong>
            </div>
            <div className="custom-metric-card risk">
              <span>Parcelas atrasadas</span>
              <strong>{panelMetrics.overdueInstallmentsCount}</strong>
            </div>
          </div>
        </section>

        <section className="custom-section">
          <div className="custom-section-header">
            <h2>Fluxo de recebimentos</h2>
            <div className="custom-days-filter">
              <label htmlFor="dashboard-upcoming-days">Próximos dias</label>
              <select
                id="dashboard-upcoming-days"
                value={upcomingDays}
                onChange={(e) => setUpcomingDays(Number(e.target.value))}
              >
                <option value={3}>3</option>
                <option value={7}>7</option>
                <option value={15}>15</option>
                <option value={30}>30</option>
              </select>
            </div>
          </div>
          <div className="custom-metrics-grid">
            <div className="custom-metric-card">
              <span>A receber hoje</span>
              <strong>{formatCurrency(panelMetrics.receiveToday)}</strong>
            </div>
            <div className="custom-metric-card">
              <span>A receber nos próximos {upcomingDays} dias</span>
              <strong>{formatCurrency(panelMetrics.receiveUpcoming)}</strong>
            </div>
          </div>
        </section>
      </div>

      {/* Modais */}
      {openModal === "client" &&
        createPortal(
          <ClientModal
            client={null}
            onSave={handleSaveClient}
            onClose={() => setOpenModal(null)}
            loading={loading}
          />,
          document.body,
        )}

      {openModal === "payment" &&
        createPortal(
          <PaymentModal
            payment={null}
            onSave={handleSavePayment}
            onClose={() => setOpenModal(null)}
            loading={loading}
          />,
          document.body,
        )}

      {/* Modal de Relatório */}
      {openModal === "report" &&
        createPortal(
          <div className="modal-overlay" onClick={() => setOpenModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Gerar Relatório de Pagamentos</h2>
                <button
                  className="modal-close"
                  onClick={() => setOpenModal(null)}
                >
                  <FontAwesomeIcon
                    icon={faTimes}
                    style={{ color: "var(--color-error)" }}
                  />
                </button>
              </div>
              <div className="modal-body">
                <p>Escolha o tipo de relatório que deseja gerar:</p>
                <div className="report-options">
                  <button
                    className="report-option"
                    onClick={handlePendingReport}
                  >
                    <FontAwesomeIcon
                      icon={faHourglassHalf}
                      style={{ color: "var(--color-warning)" }}
                    />
                    Pagamentos Pendentes
                  </button>
                  <button className="report-option" onClick={handlePaidReport}>
                    <FontAwesomeIcon
                      icon={faMoneyBillWave}
                      style={{ color: "var(--color-success)" }}
                    />
                    Pagamentos Realizados
                  </button>
                  <button
                    className="report-option"
                    onClick={handleMonthlyReport}
                  >
                    <FontAwesomeIcon
                      icon={faCalendarAlt}
                      style={{ color: "var(--color-primary)" }}
                    />
                    Relatório Mensal
                  </button>
                  <button className="report-option" onClick={handleAllReport}>
                    <FontAwesomeIcon
                      icon={faChartBar}
                      style={{ color: "var(--color-primary)" }}
                    />
                    Todos os Pagamentos
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal de Preview do Relatório */}
      {showReportPreview &&
        createPortal(
          <div
            className="modal-overlay"
            onClick={() => setShowReportPreview(false)}
          >
            <div
              className="modal-content large"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Preview do Relatório</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowReportPreview(false)}
                >
                  <FontAwesomeIcon
                    icon={faTimes}
                    style={{ color: "var(--color-error)" }}
                  />
                </button>
              </div>
              <div className="modal-body">
                {reportData ? (
                  <div className="report-preview">
                    <div className="report-header">
                      <h3>{reportData.title}</h3>
                      <p>{reportData.subtitle}</p>
                      <div className="report-summary">
                        <div className="summary-item">
                          <strong>Total de registros:</strong>{" "}
                          {reportData.totalCount}
                        </div>
                        <div className="summary-item">
                          <strong>Valor total:</strong>{" "}
                          {formatCurrency(reportData.totalAmount)}
                        </div>
                      </div>
                    </div>

                    {reportData.payments.length > 0 ? (
                      <div className="report-table">
                        <table>
                          <thead>
                            <tr>
                              <th>Cliente</th>
                              <th>Email</th>
                              <th>Valor</th>
                              <th>Data</th>
                              <th>Status</th>
                              <th>Método</th>
                              <th>Descrição</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.payments
                              .slice(0, 10)
                              .map((payment, index) => (
                                <tr key={index}>
                                  <td>{payment.clientName}</td>
                                  <td>{payment.clientEmail}</td>
                                  <td>{formatCurrency(payment.amount)}</td>
                                  <td>{payment.date}</td>
                                  <td>
                                    <span
                                      className={`status-badge ${payment.status}`}
                                    >
                                      {getStatusText(payment.status)}
                                    </span>
                                  </td>
                                  <td>
                                    {getPaymentMethodText(
                                      payment.paymentMethod,
                                    )}
                                  </td>
                                  <td>{payment.description || "-"}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {reportData.payments.length > 10 && (
                          <p className="table-note">
                            Mostrando os primeiros 10 registros de{" "}
                            {reportData.payments.length} total
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="no-data">
                        <p>
                          Nenhum pagamento encontrado para os critérios
                          selecionados.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-data">
                    <p>Nenhum dado encontrado para o filtro selecionado.</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowReportPreview(false)}
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleGeneratePDF}
                  disabled={loading || !reportData}
                >
                  {loading ? "Gerando PDF..." : "Gerar PDF"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

    </div>
  );
}

export default DashboardPage;
