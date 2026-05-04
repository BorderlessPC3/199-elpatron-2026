import { getDocs, query, where } from "firebase/firestore";
import { parseLocalDate } from "../utils/paymentNormalizer";
import { loansItemsCollection } from "./firestorePaths";
import type { Toast } from "../types/toast";

const MS_PER_DAY = 86400000;

function startOfLocalToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Diferença em dias civis (due − today): negativo = atrasado, 0 = hoje, positivo = futuro. */
function calendarDaysFromToday(dueYmd: string): number {
  const due0 = parseLocalDate(dueYmd.trim());
  const today0 = startOfLocalToday();
  return Math.round((due0.getTime() - today0.getTime()) / MS_PER_DAY);
}

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

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const dateStr = String(data.date ?? "");
        if (!dateStr.trim()) return;

        const dayDiff = calendarDaysFromToday(dateStr);
        /* Atrasados ou vencimento em até 3 dias (inclusive), em dias civis */
        if (dayDiff > 3) return;

        const isOverdue = dayDiff < 0;

        reminders.push({
          id: doc.id,
          clientName: data.clientName,
          amount: data.amount,
          dueDate: dateStr,
          description: data.description || "Pagamento pendente",
          status: isOverdue ? "overdue" : "pending",
        });
      });

      return reminders.sort(
        (a, b) =>
          parseLocalDate(a.dueDate).getTime() - parseLocalDate(b.dueDate).getTime(),
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
      const dayDiff = calendarDaysFromToday(reminder.dueDate);

      let title: string;
      let message: string;
      let type: Toast["type"];

      if (dayDiff < 0) {
        const overdueDays = Math.max(1, -dayDiff);
        title = "Pagamento Vencido";
        message = `${reminder.clientName} - ${this.formatCurrency(
          reminder.amount,
        )} (${overdueDays} dia${overdueDays > 1 ? "s" : ""} em atraso)`;
        type = "error";
      } else if (dayDiff === 0) {
        title = "Pagamento Vence Hoje";
        message = `${reminder.clientName} - ${this.formatCurrency(
          reminder.amount,
        )}`;
        type = "warning";
      } else {
        title = "Pagamento Próximo do Vencimento";
        message = `${reminder.clientName} - ${this.formatCurrency(
          reminder.amount,
        )} (vence em ${dayDiff} dia${dayDiff > 1 ? "s" : ""})`;
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
