import { addDoc, getDocs, orderBy, query } from "firebase/firestore";
import type { Task, TaskDataWithId } from "../types/task";
import { agendaItemsCollection } from "./firestorePaths";
import { requireAuthPathUid } from "./requireAuthPathUid";

export const addTask = async (userId: string, task: Task) => {
  requireAuthPathUid(userId);
  const { id: _omit, ...data } = task;
  await addDoc(agendaItemsCollection(userId), { ...data, userId });
};

export const getTasks = async (userId: string): Promise<TaskDataWithId[]> => {
  requireAuthPathUid(userId);
  const q = query(agendaItemsCollection(userId), orderBy("date", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(
    (d) => ({ id: d.id, ...d.data() } as TaskDataWithId),
  );
};
