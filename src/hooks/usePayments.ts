import { useCallback, useState } from "react";
import type { Payment } from "../types/payment";
import type { Client } from "../types/client";
import type { PaymentSaveInput } from "../services/paymentService";
import {
  deletePayment,
  ensureClientExistsForPayment,
  fetchPaymentsByUser,
  savePayment,
  updatePaymentInstallments,
} from "../services/paymentService";
import { fetchClientsByUser } from "../services/clientService";
import { getErrorMessage } from "../utils/error";

export function usePayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPayments = useCallback(async (userId: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchPaymentsByUser(userId);
      setPayments(data);
      return data;
    } catch (err: unknown) {
      setError(`Erro ao carregar pagamentos: ${getErrorMessage(err)}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClients = useCallback(async (userId: string) => {
    try {
      const data = await fetchClientsByUser(userId);
      setClients(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  const savePaymentWithClient = useCallback(
    async (userId: string, paymentData: PaymentSaveInput, editingPaymentId?: string) => {
      try {
        setLoading(true);
        setError("");
        await ensureClientExistsForPayment(userId, paymentData, clients);
        await savePayment(userId, paymentData, editingPaymentId);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        setError(`Erro ao salvar pagamento: ${message}`);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [clients],
  );

  const removePayment = useCallback(async (userId: string, id: string) => {
    try {
      setError("");
      await deletePayment(userId, id);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(`Erro ao excluir pagamento: ${message}`);
      throw new Error(message);
    }
  }, []);

  const updateInstallments = useCallback(
    async (
      userId: string,
      id: string,
      installments: Parameters<typeof updatePaymentInstallments>[2],
      status: Parameters<typeof updatePaymentInstallments>[3],
    ) => {
      try {
        setError("");
        await updatePaymentInstallments(userId, id, installments, status);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        setError(`Erro ao atualizar parcelas: ${message}`);
        throw new Error(message);
      }
    },
    [],
  );

  return {
    payments,
    clients,
    loading,
    error,
    setError,
    loadPayments,
    loadClients,
    savePaymentWithClient,
    removePayment,
    updatePaymentInstallments: updateInstallments,
  };
}
