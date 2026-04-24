import { addDoc, getDocs, orderBy, query } from "firebase/firestore";
import type { Task, TaskDataWithId } from "../types/task";
import { agendaItemsCollection } from "./firestorePaths";

export const addTask = async (userId: string, task: Task) => {
  const { id: _omit, ...data } = task;
  await addDoc(agendaItemsCollection(userId), { ...data, userId });
};

export const getTasks = async (userId: string): Promise<TaskDataWithId[]> => {
  const q = query(agendaItemsCollection(userId), orderBy("date", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...d.data() } as TaskDataWithId),
  );
};
