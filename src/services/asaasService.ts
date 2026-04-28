import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.config";

interface CreatePixChargeInput {
  userId: string;
  loanId: string;
}

export interface CreatePixChargeResponse {
  asaasPaymentId: string;
  pixQrCode: string | null;
  pixCopyPaste: string | null;
  paymentStatus: "pending";
}

const createPixChargeCallable = httpsCallable<
  CreatePixChargeInput,
  CreatePixChargeResponse
>(functions, "createPixCharge");

export async function createPixCharge(
  data: CreatePixChargeInput,
): Promise<CreatePixChargeResponse> {
  const result = await createPixChargeCallable(data);
  return result.data;
}
