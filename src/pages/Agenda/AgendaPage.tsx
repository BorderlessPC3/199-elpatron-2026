import type React from "react";

import {
  faChevronLeft,
  faChevronRight,
  faPlus,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { getDocs, orderBy, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { loansItemsCollection } from "../../services/firestorePaths";
import { addTask, getTasks } from "../../services/agendaService";
import type { Payment } from "../../types/payment";
import { MONTHS, WEEKDAYS, type Task } from "../../types/task";
import "./AgendaPage.css";

interface ScheduledInstallment {
  paymentId: string;
  clientName: string;
  installmentId: string;
  amount: number;
  dueDate: string;
  paid: boolean;
}

function AgendaPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [scheduledInstallments, setScheduledInstallments] = useState<
    ScheduledInstallment[]
  >([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as "high" | "medium" | "low",
  });
  const { user } = useAuth();

  useEffect(() => {
    const fetchAgendaData = async () => {
      if (!user) return;

      const firebaseTasks = await getTasks(user.uid);
      setTasks(firebaseTasks);
      const paymentsRef = loansItemsCollection(user.uid);
      const paymentsQuery = query(
        paymentsRef,
        orderBy("createdAt", "desc"),
      );
      const snapshot = await getDocs(paymentsQuery);
      const paymentData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Payment[];

      const flattenedInstallments: ScheduledInstallment[] = paymentData.flatMap(
        (payment) =>
          (payment.installments || []).map((installment) => ({
            paymentId: payment.id,
            clientName: payment.clientName,
            installmentId: installment.id,
            amount: installment.amount,
            dueDate: installment.dueDate,
            paid: installment.paid,
          })),
      );
      setScheduledInstallments(flattenedInstallments);
    };
    fetchAgendaData();
  }, [user]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    const prevMonth = new Date(year, month - 1, 0);
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonth.getDate() - i),
        isCurrentMonth: false,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getTasksForDate = (date: Date) => {
    const dateString = formatDate(date);
    return tasks.filter((task) => task.date === dateString);
  };

  const getInstallmentsForDate = (date: Date) => {
    const dateString = formatDate(date);
    return scheduledInstallments.filter(
      (installment) => installment.dueDate === dateString,
    );
  };

  const handlePrevMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
    );
  };

  const handleNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
    );
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(formatDate(date));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !user) return;

    const newTask: Task = {
      userId: user.uid,
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      date: selectedDate,
      id: "",
      completed: false,
    };

    try {
      await addTask(user.uid, newTask);
      const updatedTasks = await getTasks(user.uid);
      setTasks(updatedTasks);
      setFormData({ title: "", description: "", priority: "medium" });
      setShowModal(false);
    } catch (error) {
      console.error("Erro ao salvar tarefa:", error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({ title: "", description: "", priority: "medium" });
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div className="agenda-page">
      <div className="page-header">
        <h1 className="page-title">Agenda</h1>
        <button
          className="add-btn"
          onClick={() => {
            setSelectedDate(formatDate(new Date()));
            setShowModal(true);
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
          Nova Pendência
        </button>
      </div>

      <div className="calendar-container">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="nav-btn" onClick={handlePrevMonth}>
              <FontAwesomeIcon icon={faChevronLeft} />
            </button>
            <h2 className="current-month">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button className="nav-btn" onClick={handleNextMonth}>
              <FontAwesomeIcon icon={faChevronRight} />
            </button>
          </div>
        </div>

        <div className="calendar-grid">
          <div className="calendar-weekdays">
            {WEEKDAYS.map((day) => (
              <div key={day} className="weekday">
                {day}
              </div>
            ))}
          </div>

          <div className="calendar-days">
            {days.map((day, index) => {
              const dayTasks = getTasksForDate(day.date);
              const dayInstallments = getInstallmentsForDate(day.date);
              const dayEvents = [
                ...dayTasks.map((task) => ({
                  id: `task-${task.id}`,
                  label: task.title,
                  kind: "task" as const,
                  paid: false,
                })),
                ...dayInstallments.map((installment) => ({
                  id: `installment-${installment.installmentId}`,
                  label: `${installment.clientName} ${new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(installment.amount)}`,
                  kind: "installment" as const,
                  paid: installment.paid,
                })),
              ];
              const visibleEvents = dayEvents.slice(0, 2);
              const hiddenEvents = dayEvents.length - visibleEvents.length;
              return (
                <div
                  key={index}
                  className={`calendar-day ${
                    !day.isCurrentMonth ? "other-month" : ""
                  } ${isToday(day.date) ? "today" : ""}`}
                  onClick={() => handleDayClick(day.date)}
                >
                  <div className="day-number">{day.date.getDate()}</div>
                  <div className="day-tasks">
                    {visibleEvents.map((event) => (
                      <div
                        key={event.id}
                        className={`day-item-compact ${
                          event.kind === "installment"
                            ? event.paid
                              ? "event-paid"
                              : "event-pending"
                            : "event-task"
                        }`}
                        title={event.label}
                      >
                        <span className="day-item-dot" />
                        <span className="day-item-text">{event.label}</span>
                      </div>
                    ))}
                    {hiddenEvents > 0 && (
                      <div className="day-more-events">+{hiddenEvents} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Nova Pendência</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Título *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descrição</label>
                <textarea
                  className="form-textarea"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Descreva os detalhes da pendência..."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Data</label>
                <input
                  type="date"
                  className="form-input"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Prioridade</label>
                <select
                  className="form-select"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as "high" | "medium" | "low",
                    })
                  }
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Salvar Pendência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AgendaPage;
