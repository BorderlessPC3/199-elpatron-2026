import type { Payment, PaymentInstallment, PaymentStatus } from "../types/payment";

type TimestampLike = { toDate?: () => Date } | Date | null | undefined;

export interface RawPayment extends Record<string, unknown> {
  id?: string;
}

const toDate = (value: TimestampLike): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return value.toDate?.() ?? new Date();
};

export const formatInputDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateString: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const normalizePaymentStatus = (status: unknown): PaymentStatus => {
  switch (status) {
    case "paid":
    case "late":
    case "pending":
    case "failed":
    case "refunded":
      return status;
    default:
      return "pending";
  }
};

const normalizeExternalPaymentStatus = (
  status: unknown,
): "pending" | "paid" | "overdue" => {
  switch (status) {
    case "pending":
    case "paid":
    case "overdue":
      return status;
    default:
      return "pending";
  }
};

export const normalizeInstallments = (
  paymentData: Record<string, unknown>,
): PaymentInstallment[] => {
  const rawInstallments = paymentData.installments;
  if (Array.isArray(rawInstallments) && rawInstallments.length > 0) {
    return rawInstallments.map((installment, index) => {
      const typed = installment as Record<string, unknown>;
      return {
        id: String(typed.id || `installment-${index + 1}`),
        dueDate: String(
          typed.dueDate || paymentData.date || formatInputDate(new Date()),
        ),
        amount: Number(typed.amount || 0),
        paid: Boolean(typed.paid),
        paidAt: typed.paidAt ? String(typed.paidAt) : null,
      };
    });
  }

  const fallbackAmount = Number(paymentData.amount || 0);
  const fallbackDate = String(paymentData.date || formatInputDate(new Date()));
  const fallbackPaid = paymentData.status === "paid";

  return [
    {
      id: "installment-1",
      dueDate: fallbackDate,
      amount: fallbackAmount,
      paid: fallbackPaid,
      paidAt: fallbackPaid ? fallbackDate : null,
    },
  ];
};

export const normalizePayment = (raw: RawPayment): Payment => {
  const installments = normalizeInstallments(raw);
  const totalAmount = installments.reduce((sum, item) => sum + item.amount, 0);

  return {
    id: String(raw.id || ""),
    clientName: String(raw.clientName || ""),
    clientEmail: String(raw.clientEmail || ""),
    amount: Number(raw.amount || totalAmount),
    loanAmount: Number(raw.loanAmount || raw.amount || totalAmount),
    firstReceiveDate: String(raw.firstReceiveDate || raw.date || installments[0]?.dueDate || ""),
    installmentCount: Number(raw.installmentCount || installments.length || 1),
    installments,
    date: String(raw.date || installments[0]?.dueDate || ""),
    status: normalizePaymentStatus(raw.status),
    paymentMethod: (raw.paymentMethod as Payment["paymentMethod"]) || "pix",
    description: String(raw.description || ""),
    asaasPaymentId: raw.asaasPaymentId ? String(raw.asaasPaymentId) : undefined,
    pixQrCode: raw.pixQrCode ? String(raw.pixQrCode) : null,
    pixCopyPaste: raw.pixCopyPaste ? String(raw.pixCopyPaste) : null,
    paymentStatus: normalizeExternalPaymentStatus(raw.paymentStatus),
    externalPaymentProvider:
      raw.externalPaymentProvider === "asaas" ? "asaas" : undefined,
    userId: String(raw.userId || ""),
    createdAt: toDate(raw.createdAt as TimestampLike),
    updatedAt: toDate(raw.updatedAt as TimestampLike),
  };
};
