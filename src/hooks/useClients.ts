import { useCallback, useState } from "react";
import type { Client } from "../types/client";
import type { Payment } from "../types/payment";
import type { ClientSaveInput } from "../services/clientService";
import {
  deleteClient,
  fetchClientsByUser,
  fetchPaymentsSummaryByUser,
  saveClient,
} from "../services/clientService";
import { getErrorMessage } from "../utils/error";

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadClients = useCallback(async (userId: string) => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchClientsByUser(userId);
      setClients(data);
      return data;
    } catch (err: unknown) {
      setError(`Erro ao carregar clientes: ${getErrorMessage(err)}`);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPayments = useCallback(async (userId: string) => {
    try {
      const data = await fetchPaymentsSummaryByUser(userId);
      setPayments(data);
      return data;
    } catch {
      return [];
    }
  }, []);

  const saveClientData = useCallback(
    async (userId: string, clientData: ClientSaveInput, editingClientId?: string) => {
      try {
        setLoading(true);
        setError("");
        await saveClient(userId, clientData, editingClientId);
      } catch (err: unknown) {
        const message = getErrorMessage(err);
        setError(`Erro ao salvar cliente: ${message}`);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const removeClient = useCallback(async (userId: string, id: string) => {
    try {
      setError("");
      await deleteClient(userId, id);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(`Erro ao excluir cliente: ${message}`);
      throw new Error(message);
    }
  }, []);

  return {
    clients,
    payments,
    loading,
    error,
    setError,
    loadClients,
    loadPayments,
    saveClientData,
    removeClient,
  };
}
