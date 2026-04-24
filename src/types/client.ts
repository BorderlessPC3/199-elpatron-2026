export type ClientStatus = "active" | "inactive" | "pending";

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: ClientStatus;
  lastContact: string;
  totalRevenue: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}
