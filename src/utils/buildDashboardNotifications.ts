export type DashboardNotificationType =
  | "info"
  | "warning"
  | "success"
  | "error";

export interface DashboardNotification {
  id: string;
  type: DashboardNotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  action?: {
    label: string;
    path: string;
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

interface ClientForNotifications {
  status: "active" | "inactive" | "pending";
  lastContact: string;
}

interface PaymentForNotifications {
  id: string;
  installments?: {
    dueDate: string;
    amount: number;
    paid: boolean;
  }[];
}

function parseLocalDate(dateString: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  return new Date(dateString);
}

export function buildDashboardNotifications(
  _clientsData: ClientForNotifications[],
  paymentsData: PaymentForNotifications[],
): DashboardNotification[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  const overdueInstallments = paymentsData.flatMap((payment) =>
    (payment.installments || []).filter(
      (installment) =>
        !installment.paid &&
        parseLocalDate(installment.dueDate).getTime() < todayTime,
    ),
  );

  if (overdueInstallments.length === 0) {
    return [];
  }

  const overdueLoansCount = new Set(
    paymentsData
      .filter((payment) =>
        (payment.installments || []).some(
          (installment) =>
            !installment.paid &&
            parseLocalDate(installment.dueDate).getTime() < todayTime,
        ),
      )
      .map((payment) => payment.id),
  ).size;

  return [
    {
      id: "overdue-loans",
      type: "warning",
      title: "Empréstimos em Atraso",
      message: `Você tem ${
        overdueInstallments.length
      } parcela(s) vencida(s), total de ${formatCurrency(
        overdueInstallments.reduce((sum, item) => sum + item.amount, 0),
      )}, em ${overdueLoansCount} empréstimo(s).`,
      timestamp: new Date(),
      read: false,
      action: { label: "Ver Empréstimos", path: "/payments" },
    },
  ];
}
