export interface TaskDataWithId extends Task {
  id: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description: string;
  date: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
}

export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
