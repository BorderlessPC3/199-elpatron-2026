import axios, { type AxiosInstance } from "axios";

export type AsaasEnvironment = "sandbox" | "production";

interface AsaasCustomerPayload {
  name: string;
  email?: string;
  mobilePhone?: string;
  externalReference?: string;
}

interface AsaasCustomerResponse {
  id: string;
  name: string;
  email?: string;
  externalReference?: string;
}

interface AsaasPaymentPayload {
  customer: string;
  billingType: "PIX";
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
}

interface AsaasPaymentResponse {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  billingType: "PIX";
  pixTransaction?: {
    qrCode?: {
      encodedImage?: string;
      payload?: string;
    };
  };
}

interface AsaasListCustomersResponse {
  data?: AsaasCustomerResponse[];
}

function getAsaasBaseUrl(): string {
  const env = (process.env.ASAAS_ENV ?? "production") as AsaasEnvironment;
  return env === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
}

function createAsaasAxiosClient(): AxiosInstance {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada nas Functions.");
  }

  return axios.create({
    baseURL: getAsaasBaseUrl(),
    headers: {
      access_token: apiKey,
      "Content-Type": "application/json",
    },
    timeout: 15000,
  });
}

const asaasHttp = createAsaasAxiosClient();

export async function createCustomer(
  data: AsaasCustomerPayload,
): Promise<AsaasCustomerResponse> {
  const response = await asaasHttp.post<AsaasCustomerResponse>("/customers", data);
  return response.data;
}

export async function createPayment(
  data: AsaasPaymentPayload,
): Promise<AsaasPaymentResponse> {
  const response = await asaasHttp.post<AsaasPaymentResponse>("/payments", data);
  return response.data;
}

export async function getPayment(paymentId: string): Promise<AsaasPaymentResponse> {
  const response = await asaasHttp.get<AsaasPaymentResponse>(`/payments/${paymentId}`);
  return response.data;
}

export async function findCustomerByExternalReference(
  externalReference: string,
): Promise<AsaasCustomerResponse | null> {
  const response = await asaasHttp.get<AsaasListCustomersResponse>("/customers", {
    params: { externalReference, limit: 1, offset: 0 },
  });
  const customer = response.data.data?.[0];
  return customer ?? null;
}
