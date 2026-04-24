import { getDocs, query, where } from "firebase/firestore";
import { loansItemsCollection } from "./firestorePaths";
import type { Toast } from "../types/toast";

interface PaymentReminder {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  description: string;
  status: "pending" | "overdue";
}

export interface ReminderActionIntent {
  type: "navigate";
  to: string;
}

type ReminderActionResolver = (
  intent: ReminderActionIntent,
) => Toast["action"] | undefined;

export class PaymentReminderService {
  static async getUpcomingPayments(userId: string): Promise<PaymentReminder[]> {
    try {
      const paymentsRef = loansItemsCollection(userId);
      const q = query(
        paymentsRef,
        where("status", "==", "pending")
      );

      const querySnapshot = await getDocs(q);
      const reminders: PaymentReminder[] = [];
      const today = new Date();
      const threeDaysFromNow = new Date(
        today.getTime() + 3 * 24 * 60 * 60 * 1000
      );

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const dueDate = new Date(data.date);

        if (dueDate <= threeDaysFromNow) {
          const isOverdue = dueDate < today;

          reminders.push({
            id: doc.id,
            clientName: data.clientName,
            amount: data.amount,
            dueDate: data.date,
            description: data.description || "Pagamento pendente",
            status: isOverdue ? "overdue" : "pending",
          });
        }
      });

      return reminders.sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      );
    } catch (error) {
      console.error("Erro ao buscar lembretes de pagamento:", error);
      return [];
    }
  }

  static createReminderToasts(
    reminders: PaymentReminder[],
    resolveAction?: ReminderActionResolver,
  ): Omit<Toast, "id" | "createdAt">[] {
    return reminders.map((reminder) => {
      const dueDate = new Date(reminder.dueDate);
      const today = new Date();
      const isOverdue = dueDate < today;
      const daysDiff = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      let title: string;
      let message: string;
      let type: Toast["type"];

      if (isOverdue) {
        const overdueDays = Math.abs(daysDiff);
        title = "Pagamento Vencido";
        message = `${reminder.clientName} - ${this.formatCurrency(
          reminder.amount
        )} (${overdueDays} dia${overdueDays > 1 ? "s" : ""} em atraso)`;
        type = "error";
      } else if (daysDiff === 0) {
        title = "Pagamento Vence Hoje";
        message = `${reminder.clientName} - ${this.formatCurrency(
          reminder.amount
        )}`;
        type = "warning";
      } else {
        title = "Pagamento Próximo do Vencimento";
        message = `${reminder.clientName} - ${this.formatCurrency(
          reminder.amount
        )} (vence em ${daysDiff} dia${daysDiff > 1 ? "s" : ""})`;
        type = "warning";
      }

      return {
        type,
        title,
        message,
        duration: undefined,
        action: resolveAction?.({ type: "navigate", to: "/payments" }),
      };
    });
  }

  private static formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  static async checkAndShowReminders(
    _userId: string,
    addToast: (toast: Omit<Toast, "id" | "createdAt">) => void,
    resolveAction?: ReminderActionResolver,
  ) {
    const reminders = await this.getUpcomingPayments(_userId);

    if (reminders.length > 0) {
      const toasts = this.createReminderToasts(reminders, resolveAction);

      toasts.forEach((toast, index) => {
        setTimeout(() => {
          addToast(toast);
        }, index * 500);
      });
    }
  }
}
