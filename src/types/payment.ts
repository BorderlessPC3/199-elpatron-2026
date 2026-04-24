export type PaymentStatus = "paid" | "late" | "pending" | "failed" | "refunded";

export type PaymentMethod = "credit_card" | "pix" | "bank_transfer" | "cash";

export interface PaymentInstallment {
  id: string;
  dueDate: string;
  amount: number;
  paid: boolean;
  paidAt: string | null;
}

export interface Payment {
  id: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  loanAmount: number;
  firstReceiveDate: string;
  installmentCount: number;
  installments: PaymentInstallment[];
  date: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  description: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
