import type React from "react";

import {
  faEdit,
  faFilter,
  faSearch,
  faTrash,
  faUserPlus,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClients } from "../../hooks";
import { useAuth } from "../../contexts/AuthContext";
import { useToastHelpers } from "../../contexts/ToastContext";
import type { Client } from "../../types/client";
import { getErrorMessage } from "../../utils/error";
import LoadingPage from "../LoadingPage/LoadingPage";
import ClientModal from "./ClientModal.tsx";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import "./ClientsPage.css";

interface FilterOptions {
  status: string;
  client: string;
  revenueRange: string;
  lastContactRange: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

type ClientStatus = Client["status"];

const statusConfig: Record<ClientStatus, { label: string; class: string }> = {
  active: { label: "Ativo", class: "status-active" },
  inactive: { label: "Inativo", class: "status-inactive" },
  pending: { label: "Pendente", class: "status-pending" },
};

function ClientsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [, setClientFilter] = useState<string>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    status: "all",
    client: "all",
    revenueRange: "all",
    lastContactRange: "all",
    sortBy: "name",
    sortOrder: "asc",
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  const { user } = useAuth();
  const { showSuccess, showError } = useToastHelpers();
  const navigate = useNavigate();
  const {
    clients,
    payments,
    loading,
    error,
    setError,
    loadClients,
    loadPayments,
    saveClientData,
    removeClient,
  } = useClients();

  useEffect(() => {
    if (!user) return;
    loadClients(user.uid);
    loadPayments(user.uid);
  }, [user, loadClients, loadPayments]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".advanced-filters")) {
        setShowAdvancedFilters(false);
      }
    };

    if (showAdvancedFilters) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAdvancedFilters]);

  const financialByClient = useMemo(() => {
    const map = new Map<string, { revenue: number; pending: number }>();
    payments.forEach((payment) => {
      const current = map.get(payment.clientName) ?? { revenue: 0, pending: 0 };
      if (payment.status === "paid") {
        current.revenue += payment.amount;
      }
      if (payment.status === "late") {
        current.pending += payment.amount;
      }
      map.set(payment.clientName, current);
    });
    return map;
  }, [payments]);

  const uniqueClients = useMemo(
    () => [...new Set(clients.map((client) => client.name))].sort(),
    [clients],
  );

  const generateSuggestions = (term: string) => {
    if (!term.trim()) return [];
    return uniqueClients
      .filter((client) => client.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 5);
  };

  const getRevenueRange = (revenue: number) => {
    if (revenue === 0) return "sem-receita";
    if (revenue <= 1000) return "baixa";
    if (revenue <= 5000) return "media";
    return "alta";
  };

  const getLastContactRange = (lastContact: string) => {
    const daysDiff = Math.floor(
      (new Date().getTime() - new Date(lastContact).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (daysDiff <= 7) return "recente";
    if (daysDiff <= 30) return "mes";
    if (daysDiff <= 90) return "trimestre";
    return "antigo";
  };

  const sortClients = useCallback((list: Client[]) => {
    return list.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (filterOptions.sortBy) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "revenue":
          aValue = financialByClient.get(a.name)?.revenue ?? 0;
          bValue = financialByClient.get(b.name)?.revenue ?? 0;
          break;
        case "lastContact":
          aValue = new Date(a.lastContact).getTime();
          bValue = new Date(b.lastContact).getTime();
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (filterOptions.sortOrder === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [filterOptions.sortBy, filterOptions.sortOrder, financialByClient]);

  const filteredClients = useMemo(() => {
    const result = clients.filter((client) => {
      const matchesSearch =
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.company.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterOptions.status === "all" ||
        client.status === filterOptions.status;
      const matchesClient =
        filterOptions.client === "all" || client.name === filterOptions.client;

      const clientRevenue = financialByClient.get(client.name)?.revenue ?? 0;
      const revenueRange = getRevenueRange(clientRevenue);
      const matchesRevenue =
        filterOptions.revenueRange === "all" ||
        revenueRange === filterOptions.revenueRange;

      const lastContactRange = getLastContactRange(client.lastContact);
      const matchesLastContact =
        filterOptions.lastContactRange === "all" ||
        lastContactRange === filterOptions.lastContactRange;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesClient &&
        matchesRevenue &&
        matchesLastContact
      );
    });
    return sortClients(result);
  }, [clients, searchTerm, filterOptions, sortClients, financialByClient]);

  // Resetar página quando filtros/sort/dados mudarem
  useEffect(() => {
    setCurrentPage(1);
    // Também limpar seleção ao mudar filtros para evitar inconsistências
    setSelectedClients([]);
  }, [searchTerm, filterOptions]);

  // Garantir currentPage dentro do intervalo ao mudar itemsPerPage ou dados
  useEffect(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(filteredClients.length / itemsPerPage),
    );
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredClients.length, itemsPerPage, currentPage]);

  // Paginação: itens visíveis
  const totalItems = filteredClients.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedClients = filteredClients.slice(startIndex, endIndex);

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

  const handleNewClient = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleSaveClient = async (
    clientData: Omit<Client, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => {
    if (!user) return;

    try {
      if (editingClient) {
        await saveClientData(user.uid, clientData, editingClient.id);
        showSuccess(
          "Cliente Atualizado",
          `${clientData.name} foi atualizado com sucesso`,
        );
      } else {
        await saveClientData(user.uid, clientData);
        showSuccess(
          "Cliente Criado",
          `${clientData.name} foi adicionado com sucesso`,
        );
      }

      await loadClients(user.uid);
      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorMessage = "Erro ao salvar cliente: " + getErrorMessage(err);
      setError(errorMessage);
      showError("Erro ao Salvar", errorMessage);
    }
  };

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] =
    useState<(() => Promise<void>) | null>(null);

  const handleDeleteClient = async (id: string) => {
    const clientToDelete = clients.find((c) => c.id === id);
    setConfirmMessage(
      `Tem certeza que deseja excluir ${clientToDelete?.name || "este cliente"}?`,
    );
    setConfirmAction(() => async () => {
      try {
        setConfirmLoading(true);
        setError("");
        if (!user) return;
        await removeClient(user.uid, id);
        showSuccess(
          "Cliente Excluído",
          `${clientToDelete?.name || "Cliente"} foi removido com sucesso`,
        );
        await loadClients(user.uid);
        setCurrentPage((prev) => {
          const newTotal = Math.max(0, filteredClients.length - 1);
          const newTotalPages = Math.max(1, Math.ceil(newTotal / itemsPerPage));
          return Math.min(prev, newTotalPages);
        });
      } catch (err: unknown) {
        const errorMessage = "Erro ao excluir cliente: " + getErrorMessage(err);
        setError(errorMessage);
        showError("Erro ao Excluir", errorMessage);
      } finally {
        setConfirmLoading(false);
        setConfirmOpen(false);
      }
    });
    setConfirmOpen(true);
  };

  const getStatusBadge = (status: ClientStatus) => {
    const config = statusConfig[status];
    return (
      <span className={`status-badge ${config.class}`}>{config.label}</span>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR");
  };

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return "-";
    return phone;
  };

  const formatCompanyName = (company: string) => {
    if (!company || company.trim() === "") return "-";
    return company;
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

  const handleFilterChange = (field: keyof FilterOptions, value: string) => {
    setFilterOptions((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSort = (field: string) => {
    setFilterOptions((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder:
        prev.sortBy === field && prev.sortOrder === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIcon = (field: string) => {
    if (filterOptions.sortBy !== field) return null;
    return filterOptions.sortOrder === "asc" ? "↑" : "↓";
  };

  const handleBulkAction = (action: "delete" | "status") => {
    if (selectedClients.length === 0) {
      setError("Selecione pelo menos um cliente");
      return;
    }

    if (action === "delete") {
      setConfirmMessage(
        `Tem certeza que deseja excluir ${selectedClients.length} cliente(s)?`,
      );
      setConfirmAction(() => async () => {
        try {
          setConfirmLoading(true);
          if (!user) return;
          for (const id of selectedClients) {
            await removeClient(user.uid, id);
          }
          showSuccess(
            "Clientes Excluídos",
            `${selectedClients.length} cliente(s) removido(s)`,
          );
          if (user) await loadClients(user.uid);
          setSelectedClients([]);
        } catch (err: unknown) {
          const errorMessage = "Erro ao excluir clientes: " + getErrorMessage(err);
          setError(errorMessage);
          showError("Erro ao Excluir", errorMessage);
        } finally {
          setConfirmLoading(false);
          setConfirmOpen(false);
        }
      });
      setConfirmOpen(true);
    }
  };

  const handleSelectAll = () => {
    // Seleciona apenas os clientes da página atual
    if (paginatedClients.every((c) => selectedClients.includes(c.id))) {
      setSelectedClients((prev) =>
        prev.filter((id) => !paginatedClients.some((c) => c.id === id)),
      );
    } else {
      setSelectedClients((prev) => {
        const newIds = paginatedClients
          .map((c) => c.id)
          .filter((id) => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId],
    );
  };

  const handleOpenClientPayments = (clientName: string) => {
    navigate(`/payments?client=${encodeURIComponent(clientName)}`);
  };

  if (loading && clients.length === 0) {
    return <LoadingPage message="Carregando clientes" />;
  }

  return (
    <div className="clients-page">
      <div className="clients-header">
        <div className="header-content">
          <h1>Clientes</h1>
          <p>Gerencie seus clientes e mantenha suas informações atualizadas</p>
        </div>
        <button
          className="btn-primary"
          onClick={handleNewClient}
          disabled={loading}
        >
          <FontAwesomeIcon icon={faUserPlus} />
          Novo Cliente
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

      {/* Filtros */}
      <div className="clients-filters">
        <div className="search-box">
          <span className="search-icon">
            <FontAwesomeIcon icon={faSearch} />
          </span>
          <input
            type="text"
            placeholder="Buscar clientes..."
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
              {suggestions.map((suggestion, index) => (
                <button
                  type="button"
                  key={index}
                  className="suggestion-item"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Filtros Avançados */}
        <div className="advanced-filters">
          <button
            className={`filter-toggle ${showAdvancedFilters ? "active" : ""}`}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          >
            <FontAwesomeIcon icon={faFilter} />
            Filtros Avançados
            {showAdvancedFilters ? " ↑" : " ↓"}
          </button>

          {showAdvancedFilters && (
            <div className="filters-panel">
              <div className="filter-group">
                <label>Status</label>
                <select
                  value={filterOptions.status}
                  onChange={(e) => handleFilterChange("status", e.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                  <option value="pending">Pendentes</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Receita</label>
                <select
                  value={filterOptions.revenueRange}
                  onChange={(e) =>
                    handleFilterChange("revenueRange", e.target.value)
                  }
                >
                  <option value="all">Todas</option>
                  <option value="sem-receita">Sem receita</option>
                  <option value="baixa">Baixa (até R$ 1.000)</option>
                  <option value="media">Média (R$ 1.000 - R$ 5.000)</option>
                  <option value="alta">Alta (acima de R$ 5.000)</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Último Contato</label>
                <select
                  value={filterOptions.lastContactRange}
                  onChange={(e) =>
                    handleFilterChange("lastContactRange", e.target.value)
                  }
                >
                  <option value="all">Todos</option>
                  <option value="recente">Últimos 7 dias</option>
                  <option value="mes">Último mês</option>
                  <option value="trimestre">Último trimestre</option>
                  <option value="antigo">Mais antigo</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ações em Lote */}
      {selectedClients.length > 0 && (
        <div className="bulk-actions">
          <span>{selectedClients.length} cliente(s) selecionado(s)</span>
          <button
            className="btn-danger"
            onClick={() => handleBulkAction("delete")}
            disabled={loading}
          >
            Excluir Selecionados
          </button>
        </div>
      )}

      <div className="clients-table-container">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
          </div>
        )}

        <table className="clients-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={
                    paginatedClients.length > 0 &&
                    paginatedClients.every((c) =>
                      selectedClients.includes(c.id),
                    )
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th onClick={() => handleSort("name")} className="sortable">
                Cliente {getSortIcon("name")}
              </th>
              <th>Empresa</th>
              <th>Contato</th>
              <th onClick={() => handleSort("status")} className="sortable">
                Status {getSortIcon("status")}
              </th>
              <th
                onClick={() => handleSort("lastContact")}
                className="sortable"
              >
                Último Contato {getSortIcon("lastContact")}
              </th>
              <th onClick={() => handleSort("revenue")} className="sortable">
                Receita Total {getSortIcon("revenue")}
              </th>
              <th>Devendo</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {paginatedClients.map((client) => (
              <tr
                key={client.id}
                className={
                  selectedClients.includes(client.id) ? "selected" : ""
                }
              >
                <td>
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={() => handleSelectClient(client.id)}
                  />
                </td>
                <td>
                  <div className="client-info">
                    <div className="client-avatar">
                      {client.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <button
                        type="button"
                        className="client-name client-name-link"
                        onClick={() => handleOpenClientPayments(client.name)}
                        title="Ver todos os pagamentos deste cliente"
                      >
                        {client.name}
                      </button>
                      <div className="client-email">{client.email}</div>
                    </div>
                  </div>
                </td>
                <td>{formatCompanyName(client.company)}</td>
                <td>{formatPhoneNumber(client.phone)}</td>
                <td>{getStatusBadge(client.status)}</td>
                <td>{formatDate(client.lastContact)}</td>
                <td className="revenue">
                  {formatCurrency(financialByClient.get(client.name)?.revenue ?? 0)}
                </td>
                <td
                  className={`pending ${
                    (financialByClient.get(client.name)?.pending ?? 0) > 0
                      ? "has-pending"
                      : ""
                  }`}
                >
                  {formatCurrency(financialByClient.get(client.name)?.pending ?? 0)}
                </td>
                <td>
                  <div className="actions">
                    <button
                      className="btn-action edit"
                      onClick={() => handleEditClient(client)}
                      title="Editar"
                      disabled={loading}
                    >
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button
                      className="btn-action delete"
                      onClick={() => handleDeleteClient(client.id)}
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

        {/* Confirm Modal */}
        {confirmOpen && (
          <ConfirmModal
            title="Excluir Cliente"
            message={confirmMessage}
            loading={confirmLoading}
            confirmLabel="Excluir"
            cancelLabel="Cancelar"
            onConfirm={() => {
              if (confirmAction) confirmAction();
            }}
            onCancel={() => setConfirmOpen(false)}
          />
        )}
        {filteredClients.length === 0 && !loading && (
          <div className="empty-state">
            <span className="empty-icon">
              <FontAwesomeIcon
                icon={faUsers}
                style={{ color: "var(--color-primary)" }}
              />
            </span>
            <h3>Nenhum cliente encontrado</h3>
            <p>Tente ajustar os filtros ou criar um novo cliente</p>
          </div>
        )}

        {/* Paginação */}
        {filteredClients.length > 0 && (
          <div
            className="pagination-container"
            role="navigation"
            aria-label="Paginação de clientes"
          >
            <div className="items-per-page">
              <label htmlFor="clients-items-per-page">Itens por página</label>
              <select
                id="clients-items-per-page"
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
        <ClientModal
          client={editingClient}
          onSave={handleSaveClient}
          onClose={() => setIsModalOpen(false)}
          loading={loading}
        />
      )}
    </div>
  );
}

export default ClientsPage;
