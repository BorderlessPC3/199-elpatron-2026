import {
  faCircleXmark,
  faTimes,
  faUserPen,
  faUserPlus,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Client } from "../../types/client";
import "./ClientModal.css";

interface ClientModalProps {
  client: Client | null;
  onSave: (
    client: Omit<Client, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => void;
  onClose: () => void;
  loading?: boolean;
}

function ClientModal({
  client,
  onSave,
  onClose,
  loading = false,
}: ClientModalProps) {
  const [formData, setFormData] = useState<{
    name: string;
    email: string;
    phone: string;
    company: string;
    status: "active" | "inactive" | "pending";
    lastContact: string;
    totalRevenue: number;
  }>({
    name: "",
    email: "",
    phone: "",
    company: "",
    status: "active",
    lastContact: new Date().toISOString().split("T")[0],
    totalRevenue: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone,
        company: client.company,
        status: client.status,
        lastContact: client.lastContact,
        totalRevenue: client.totalRevenue,
      });
    } else {
      // Reset form when creating new client
      setFormData({
        name: "",
        email: "",
        phone: "",
        company: "",
        status: "active",
        lastContact: new Date().toISOString().split("T")[0],
        totalRevenue: 0,
      });
    }
  }, [client]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Nome é obrigatório";
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Email inválido";
    }

    if (!formData.phone.trim()) {
      newErrors.phone = "Telefone é obrigatório";
    }

    // Empresa não é obrigatória - pode ser cliente individual

    // Removido validação de totalRevenue - será calculado automaticamente

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Limpar erro do campo quando usuário começar a digitar
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, "");

    // Aplica a máscara (11) 99999-9999
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setFormData((prev) => ({ ...prev, phone: formatted }));

    if (errors.phone) {
      setErrors((prev) => ({ ...prev, phone: "" }));
    }
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, company: value }));

    if (errors.company) {
      setErrors((prev) => ({ ...prev, company: "" }));
    }
  };

  const modal = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content client-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="client-modal-form">
          <div className="modal-header">
            <h2 className="modal-title-with-icon">
              <FontAwesomeIcon
                icon={client ? faUserPen : faUserPlus}
                className="modal-title-icon"
                aria-hidden
              />
              {client ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <button className="modal-close" onClick={onClose} disabled={loading}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
          </div>

          <div className="modal-body-scroll">
            <div className="form-grid">
            <div className="form-group">
              <label htmlFor="name">Nome *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={errors.name ? "error" : ""}
                placeholder="Nome completo"
                disabled={loading}
              />
              {errors.name && (
                <span className="error-message">{errors.name}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? "error" : ""}
                placeholder="email@exemplo.com"
                disabled={loading}
              />
              {errors.email && (
                <span className="error-message">{errors.email}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Telefone *</label>
              <input
                type="text"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                className={errors.phone ? "error" : ""}
                placeholder="(11) 99999-9999"
                maxLength={15}
                disabled={loading}
              />
              {errors.phone && (
                <span className="error-message">{errors.phone}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="company">Empresa</label>
              <input
                type="text"
                id="company"
                name="company"
                value={formData.company}
                onChange={handleCompanyChange}
                className={errors.company ? "error" : ""}
                placeholder="Nome da empresa (opcional)"
                disabled={loading}
              />
              {errors.company && (
                <span className="error-message">{errors.company}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="status">Status</label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="pending">Pendente</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="lastContact">Último Contato</label>
              <input
                type="date"
                id="lastContact"
                name="lastContact"
                value={formData.lastContact}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            {/* Campo de empréstimo removido - será calculado automaticamente baseado nos pagamentos */}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className={client ? "btn-secondary" : "btn-cancel-danger"}
              onClick={onClose}
              disabled={loading}
            >
              <FontAwesomeIcon icon={faCircleXmark} aria-hidden />
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary btn-with-icon"
              disabled={loading}
              style={{
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
                position: "relative",
              }}
            >
              {loading ? (
                <>
                  <div
                    className="loading-spinner"
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid white",
                      borderRadius: "50%",
                      animation: "spin 1s linear infinite",
                      marginRight: "8px",
                    }}
                  ></div>
                  Salvando...
                </>
              ) : client ? (
                "Salvar Alterações"
              ) : (
                <>
                  <FontAwesomeIcon icon={faUserPlus} aria-hidden />
                  Criar Cliente
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

export default ClientModal;
