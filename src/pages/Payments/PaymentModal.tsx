import { faChevronDown, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type {
  Payment,
  PaymentInstallment,
} from "../../types/payment";
import type { Client } from "../../types/client";
import "./PaymentModal.css";

interface PaymentModalProps {
  payment: Payment | null;
  onSave: (
    payment: Omit<Payment, "id" | "userId" | "createdAt" | "updatedAt">,
  ) => void;
  onClose: () => void;
  loading?: boolean;
  clients?: Client[];
}

interface ValidationState {
  isValid: boolean;
  message: string;
}

interface PaymentFormData {
  clientName: string;
  clientEmail: string;
  loanAmount: number;
  firstReceiveDate: string;
  installmentCount: number;
  installments: PaymentInstallment[];
  date: string;
  description: string;
}

const formatInputDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const generateInstallments = (
  totalAmount: number,
  count: number,
  firstDate: string,
): PaymentInstallment[] => {
  if (totalAmount <= 0 || count <= 0 || !firstDate) return [];

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  const firstInstallmentDate = new Date(`${firstDate}T00:00:00`);

  return Array.from({ length: count }, (_, index) => {
    const dueDate = new Date(firstInstallmentDate);
    dueDate.setMonth(firstInstallmentDate.getMonth() + index);

    return {
      id: `installment-${index + 1}`,
      dueDate: formatInputDate(dueDate),
      amount: (baseCents + (index < remainder ? 1 : 0)) / 100,
      paid: false,
      paidAt: null,
    };
  });
};

function PaymentModal({
  payment,
  onSave,
  onClose,
  loading = false,
  clients = [],
}: PaymentModalProps) {
  const [formData, setFormData] = useState<PaymentFormData>({
    clientName: "",
    clientEmail: "",
    loanAmount: 0,
    firstReceiveDate: formatInputDate(new Date()),
    installmentCount: 1,
    installments: [],
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [isClientSelected, setIsClientSelected] = useState(false);
  const [validationState, setValidationState] = useState<
    Record<string, ValidationState>
  >({});
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (payment) {
      setFormData({
        clientName: payment.clientName,
        clientEmail: payment.clientEmail,
        loanAmount: payment.loanAmount || payment.amount,
        firstReceiveDate: payment.firstReceiveDate || payment.date,
        installmentCount: payment.installmentCount || 1,
        installments:
          payment.installments && payment.installments.length > 0
            ? payment.installments
            : generateInstallments(
                payment.amount,
                payment.installmentCount || 1,
                payment.firstReceiveDate || payment.date,
              ),
        date: payment.date,
        description: payment.description,
      });
      setIsClientSelected(true);
    } else {
      // Reset form when creating new payment
      setFormData({
        clientName: "",
        clientEmail: "",
        loanAmount: 0,
        firstReceiveDate: formatInputDate(new Date()),
        installmentCount: 1,
        installments: [],
        date: new Date().toISOString().split("T")[0],
        description: "",
      });
      setIsClientSelected(false);
    }
  }, [payment]);
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.clientName.trim()) {
      newErrors.clientName = "Nome do cliente é obrigatório";
    }

    if (!formData.clientEmail.trim()) {
      newErrors.clientEmail = "Email do cliente é obrigatório";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)) {
      newErrors.clientEmail = "Email inválido";
    }

    if (formData.loanAmount <= 0) {
      newErrors.loanAmount = "Valor emprestado deve ser maior que zero";
    }

    if (formData.installments.length === 0) {
      newErrors.installments = "Gere as parcelas antes de salvar";
    } else {
      const hasInvalidInstallment = formData.installments.some(
        (installment) => !installment.dueDate || installment.amount <= 0,
      );
      if (hasInvalidInstallment) {
        newErrors.installments =
          "Cada parcela precisa ter data e valor maior que zero";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateField = (field: string, value: unknown): ValidationState => {
    switch (field) {
      case "clientName":
        if (!String(value ?? "").trim()) {
          return { isValid: false, message: "Nome do cliente é obrigatório" };
        }
        if (String(value ?? "").length < 2) {
          return {
            isValid: false,
            message: "Nome deve ter pelo menos 2 caracteres",
          };
        }
        return { isValid: true, message: "" };

      case "clientEmail":
        if (!String(value ?? "").trim()) {
          return { isValid: false, message: "Email do cliente é obrigatório" };
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? ""))) {
          return { isValid: false, message: "Email inválido" };
        }
        return { isValid: true, message: "" };

      case "loanAmount":
        if (Number(value) <= 0) {
          return { isValid: false, message: "Valor deve ser maior que zero" };
        }
        if (Number(value) > 1000000) {
          return { isValid: false, message: "Valor muito alto" };
        }
        return { isValid: true, message: "" };

      case "description":
        if (!value || !String(value).trim()) {
          return { isValid: true, message: "" };
        }
        if (String(value).trim().length < 5) {
          return {
            isValid: false,
            message: "Descrição deve ter pelo menos 5 caracteres",
          };
        }
        return { isValid: true, message: "" };

      default:
        return { isValid: true, message: "" };
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      const totalInstallments = formData.installments.reduce(
        (sum, installment) => sum + installment.amount,
        0,
      );
      const computedStatus = payment?.status ?? "pending";

      onSave({
        ...formData,
        amount: totalInstallments,
        loanAmount: formData.loanAmount,
        firstReceiveDate:
          formData.installments[0]?.dueDate || formData.firstReceiveDate,
        installmentCount: formData.installments.length,
        installments: formData.installments,
        status: computedStatus,
        paymentMethod: "pix",
      });
    }
  };

  const formatCurrency = (value: string | number) => {
    if (typeof value === "number") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 2,
      }).format(value);
    }

    const numbers = value.replace(/\D/g, "");
    const cents = parseInt(numbers) || 0;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    }).format(cents / 100);
  };

  const parseCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return parseInt(numbers) / 100;
  };

  const handleGenerateInstallments = () => {
    const generated = generateInstallments(
      formData.loanAmount,
      formData.installmentCount,
      formData.firstReceiveDate,
    );
    setFormData((prev) => ({ ...prev, installments: generated }));
    if (errors.installments) {
      setErrors((prev) => ({ ...prev, installments: "" }));
    }
  };

  const generateClientSuggestions = (term: string) => {
    if (!term.trim()) return [];
    return clients
      .filter(
        (client) =>
          client.name.toLowerCase().includes(term.toLowerCase()) ||
          client.email.toLowerCase().includes(term.toLowerCase()),
      )
      .slice(0, 5);
  };

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIsTyping(true);

    setFormData((prev) => ({
      ...prev,
      clientName: value,
      clientEmail: "",
    }));
    setIsClientSelected(false);

    const validation = validateField("clientName", value);
    setValidationState((prev) => ({ ...prev, clientName: validation }));

    if (value.trim()) {
      const suggestions = generateClientSuggestions(value);
      setClientSuggestions(suggestions);
      setShowClientSuggestions(suggestions.length > 0);
    } else {
      setShowClientSuggestions(false);
      setClientSuggestions([]);
    }

    if (errors.clientName) {
      setErrors((prev) => ({ ...prev, clientName: "" }));
    }

    setTimeout(() => setIsTyping(false), 500);
  };

  const handleClientSelection = (client: Client) => {
    setFormData((prev) => ({
      ...prev,
      clientName: client.name,
      clientEmail: client.email,
    }));
    setIsClientSelected(true);
    setShowClientSuggestions(false);
    setClientSuggestions([]);

    if (errors.clientName) {
      setErrors((prev) => ({ ...prev, clientName: "" }));
    }
    if (errors.clientEmail) {
      setErrors((prev) => ({ ...prev, clientEmail: "" }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as HTMLInputElement;

    if (name === "loanAmount") {
      const numericValue = parseCurrency(value);
      setFormData((prev) => ({ ...prev, [name]: numericValue }));
      const validation = validateField("loanAmount", numericValue);
      setValidationState((prev) => ({ ...prev, loanAmount: validation }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (name === "clientEmail" || name === "description") {
        const validation = validateField(name, value);
        setValidationState((prev) => ({ ...prev, [name]: validation }));
      }
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleInstallmentChange = (
    index: number,
    field: "amount" | "dueDate",
    value: string,
  ) => {
    setFormData((prev) => {
      const updated = [...prev.installments];
      const current = updated[index];
      if (!current) return prev;

      if (field === "amount") {
        updated[index] = { ...current, amount: parseCurrency(String(value)) };
      } else {
        updated[index] = { ...current, dueDate: String(value) };
      }

      return { ...prev, installments: updated };
    });
  };

  const modal = (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{payment ? "Editar Empréstimo" : "Novo Empréstimo"}</h2>
          <button className="modal-close" onClick={onClose} disabled={loading}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="clientName">Nome do Cliente *</label>
              <div className="autocomplete-container">
                <input
                  type="text"
                  id="clientName"
                  name="clientName"
                  value={formData.clientName}
                  onChange={handleClientNameChange}
                  className={`autocomplete-input ${
                    errors.clientName || !validationState.clientName?.isValid
                      ? "error"
                      : ""
                  } ${isClientSelected ? "selected" : ""} ${
                    isTyping ? "typing" : ""
                  }`}
                  placeholder="Digite para buscar cliente..."
                  disabled={loading}
                  onFocus={() => {
                    if (
                      formData.clientName.trim() &&
                      clientSuggestions.length > 0
                    ) {
                      setShowClientSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowClientSuggestions(false), 200);
                  }}
                />
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="autocomplete-arrow"
                  style={{ color: "var(--color-primary)" }}
                />
                {isTyping && (
                  <div className="typing-indicator">
                    <span>Buscando...</span>
                  </div>
                )}
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <div className="autocomplete-suggestions">
                    {clientSuggestions.map((client) => (
                      <div
                        key={client.id}
                        className="suggestion-item"
                        onClick={() => handleClientSelection(client)}
                      >
                        <div className="suggestion-name">{client.name}</div>
                        <div className="suggestion-email">{client.email}</div>
                        {client.company && (
                          <div className="suggestion-company">
                            {client.company}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {(errors.clientName || validationState.clientName) && (
                <span
                  className={`error-message ${validationState.clientName?.isValid ? "success" : ""}`}
                >
                  {errors.clientName || validationState.clientName?.message}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="clientEmail">Email do Cliente *</label>
              <input
                type="email"
                id="clientEmail"
                name="clientEmail"
                value={formData.clientEmail}
                onChange={handleChange}
                className={`${errors.clientEmail || !validationState.clientEmail?.isValid ? "error" : ""} ${isClientSelected ? "readonly" : ""}`}
                placeholder="Será preenchido automaticamente"
                disabled={loading || isClientSelected}
                readOnly={isClientSelected}
              />
              {(errors.clientEmail || validationState.clientEmail) && (
                <span
                  className={`error-message ${validationState.clientEmail?.isValid ? "success" : ""}`}
                >
                  {errors.clientEmail || validationState.clientEmail?.message}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="loanAmount">Valor emprestado (R$) *</label>
              <input
                type="text"
                id="loanAmount"
                name="loanAmount"
                value={formatCurrency(formData.loanAmount)}
                onChange={handleChange}
                className={
                  errors.loanAmount || !validationState.loanAmount?.isValid
                    ? "error"
                    : ""
                }
                placeholder="R$ 0,00"
                disabled={loading}
              />
              {(errors.loanAmount || validationState.loanAmount) && (
                <span
                  className={`error-message ${validationState.loanAmount?.isValid ? "success" : ""}`}
                >
                  {errors.loanAmount || validationState.loanAmount?.message}
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="firstReceiveDate">Primeiro recebimento *</label>
              <input
                type="date"
                id="firstReceiveDate"
                name="firstReceiveDate"
                value={formData.firstReceiveDate}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="installmentCount">Quantidade de parcelas *</label>
              <input
                type="number"
                id="installmentCount"
                name="installmentCount"
                min={1}
                max={120}
                value={formData.installmentCount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    installmentCount: Number(e.target.value) || 1,
                  }))
                }
                disabled={loading}
              />
            </div>

            <div className="form-group full-width">
              <div className="installments-header">
                <label>Parcelas *</label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleGenerateInstallments}
                  disabled={loading}
                >
                  Gerar parcelas
                </button>
              </div>
              {errors.installments && (
                <span className="error-message">{errors.installments}</span>
              )}
              <div className="installments-list">
                {formData.installments.map((installment, index) => (
                  <div key={installment.id} className="installment-item">
                    <span className="installment-index">{index + 1}a</span>
                    <input
                      type="date"
                      value={installment.dueDate}
                      onChange={(e) =>
                        handleInstallmentChange(index, "dueDate", e.target.value)
                      }
                      disabled={loading}
                    />
                    <input
                      type="text"
                      value={formatCurrency(installment.amount)}
                      onChange={(e) =>
                        handleInstallmentChange(index, "amount", e.target.value)
                      }
                      disabled={loading}
                    />
                  </div>
                ))}
                {formData.installments.length === 0 && (
                  <p className="installments-empty">
                    Informe valor, data inicial e quantidade, depois clique em
                    "Gerar parcelas".
                  </p>
                )}
              </div>
            </div>

            <div className="form-group full-width">
              <label htmlFor="description">Descrição (opcional)</label>
              <input
                type="text"
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className={
                  errors.description || !validationState.description?.isValid
                    ? "error"
                    : ""
                }
                placeholder="Descrição do serviço ou produto"
                disabled={loading}
              />
              {(errors.description || validationState.description) && (
                <span
                  className={`error-message ${validationState.description?.isValid ? "success" : ""}`}
                >
                  {errors.description || validationState.description?.message}
                </span>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
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
              ) : payment ? (
                "Salvar Alterações"
              ) : (
                "Criar Pagamento"
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

export default PaymentModal;
