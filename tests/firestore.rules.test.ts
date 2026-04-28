import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { beforeAll, afterAll, describe, it } from "vitest";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

const rulesPath = join(process.cwd(), "firestore.rules");
const rules = readFileSync(rulesPath, "utf8");

const aliceUid = "user-alice-111";
const bobUid = "user-bob-222";

function validClient(uid: string, name = "Cliente") {
  return {
    name,
    email: "a@b.com",
    phone: "",
    company: "",
    status: "pending" as const,
    lastContact: "2026-01-01",
    totalRevenue: 0,
    userId: uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

function validLoan(uid: string) {
  return {
    clientName: "Cliente",
    clientEmail: "a@b.com",
    amount: 100,
    loanAmount: 100,
    firstReceiveDate: "2026-02-01",
    date: "2026-02-01",
    installmentCount: 1,
    installments: [
      {
        id: "i1",
        dueDate: "2026-02-01",
        amount: 100,
        paid: false,
        paidAt: null,
      },
    ],
    status: "pending" as const,
    paymentMethod: "pix" as const,
    description: "",
    asaasPaymentId: null,
    pixQrCode: null,
    pixCopyPaste: null,
    paymentStatus: "pending" as const,
    externalPaymentProvider: "asaas" as const,
    userId: uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

describe("Firestore security rules — elpatron", () => {
  let env: RulesTestEnvironment | undefined;

  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: "demo-elpatron",
      firestore: { rules },
    });
  });

  afterAll(async () => {
    await env?.cleanup();
  });

  it("1) Usuário A não lê dados de B (clients)", async () => {
    if (!env) throw new Error("Test environment not initialized");
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "clients", bobUid, "items", "c-bob"), validClient(bobUid));
    });

    const alice = env!.authenticatedContext(aliceUid).firestore();
    await assertFails(getDoc(doc(alice, "clients", bobUid, "items", "c-bob")));
  });

  it("2) Cliente sem nome é rejeitado", async () => {
    if (!env) throw new Error("Test environment not initialized");
    const alice = env.authenticatedContext(aliceUid).firestore();
    await assertFails(
      setDoc(doc(alice, "clients", aliceUid, "items", "bad"), validClient(aliceUid, "")),
    );
  });

  it("3) Empréstimo com valor não positivo é rejeitado", async () => {
    if (!env) throw new Error("Test environment not initialized");
    const alice = env.authenticatedContext(aliceUid).firestore();
    const bad = { ...validLoan(aliceUid), loanAmount: -10, amount: -10 };
    await assertFails(setDoc(doc(alice, "loans", aliceUid, "items", "bad-loan"), bad));
  });

  it("4) Escrita com campo extra no cliente é rejeitada", async () => {
    if (!env) throw new Error("Test environment not initialized");
    const alice = env.authenticatedContext(aliceUid).firestore();
    await assertFails(
      setDoc(doc(alice, "clients", aliceUid, "items", "hack"), {
        ...validClient(aliceUid),
        isAdmin: true,
      }),
    );
  });

  it("dono pode criar cliente e empréstimo válidos", async () => {
    if (!env) throw new Error("Test environment not initialized");
    const alice = env.authenticatedContext(aliceUid).firestore();
    await assertSucceeds(
      setDoc(doc(alice, "clients", aliceUid, "items", "c-ok"), validClient(aliceUid)),
    );
    await assertSucceeds(
      setDoc(doc(alice, "loans", aliceUid, "items", "loan-ok"), validLoan(aliceUid)),
    );
  });
});
