import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimal in-memory stand-in for the supabase-js query builder used by the handlers.
let rows;
let afterRead; // optional hook to simulate a concurrent write between a read and an update
function from() {
  const filters = [];
  let patch = null;
  let single = false;
  const run = () => {
    const matched = rows.filter((r) => filters.every((f) => f(r)));
    if (patch) {
      matched.forEach((r) => Object.assign(r, patch));
      return { data: matched.map((r) => ({ id: r.id })), error: null };
    }
    const data = single ? (matched[0] ? { ...matched[0] } : null) : matched.map((r) => ({ ...r }));
    afterRead?.();
    afterRead = null;
    return { data, error: null };
  };
  const q = {
    select: () => q,
    update: (v) => ((patch = v), q),
    eq: (k, v) => (filters.push((r) => r[k] === v), q),
    neq: (k, v) => (filters.push((r) => r[k] !== v), q),
    in: (k, vs) => (filters.push((r) => vs.includes(r[k])), q),
    order: () => q,
    limit: () => q,
    single: () => ((single = true), q),
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  };
  return q;
}

const createPaymentLink = vi.fn();
const sendPaymentConfirmationEmail = vi.fn();
const sendPaymentFailedEmail = vi.fn();
let notification;

vi.mock("../api/shared/supabase.js", () => ({ getSupabaseClient: () => ({ from }) }));
vi.mock("../api/niebocross/utils/sibs.js", () => ({
  createPaymentLink: (...a) => createPaymentLink(...a),
  decryptWebhookNotification: () => ({}),
  parseWebhookData: () => notification,
}));
vi.mock("../api/shared/database-operations.js", () => ({ repricePendingPayment: async () => {} }));
vi.mock("../api/shared/email.js", () => ({
  sendPaymentConfirmationEmail: (...a) => sendPaymentConfirmationEmail(...a),
  sendPaymentFailedEmail: (...a) => sendPaymentFailedEmail(...a),
}));

const { default: paymentHandler } = await import("../api/events/[eventId]/payment/[id].js");
const { default: webhookHandler } = await import("../api/payment/webhook.js");

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    setHeader: () => {},
    getHeader: () => "",
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
}

async function getPayment() {
  const res = mockRes();
  await paymentHandler({ method: "GET", query: { eventId: "wilczypolmaraton-2026", id: "reg-1" } }, res);
  return res;
}

async function sendWebhook(paymentStatus, transactionId) {
  notification = { merchantTransactionId: "pay-1", transactionId, paymentStatus, notificationId: "n-1" };
  const req = {
    method: "POST",
    headers: { "x-initialization-vector": "iv", "x-authentication-tag": "tag" },
    on(event, cb) {
      if (event === "data") cb(Buffer.from("ciphertext"));
      if (event === "end") cb();
      return this;
    },
  };
  const res = mockRes();
  await webhookHandler(req, res);
  return res;
}

function paymentRow(overrides) {
  return {
    id: "pay-1",
    registration_id: "reg-1",
    total_amount: 100,
    payment_status: "pending",
    payment_link: "old-context",
    transaction_id: "old-tx",
    created_at: new Date(Date.now() - 60_000).toISOString(),
    updated_at: new Date(Date.now() - 60_000).toISOString(),
    event_registrations: { email: "a@b.pl", contact_person: "Jan", event_id: "wilczypolmaraton-2026" },
    ...overrides,
  };
}

beforeEach(() => {
  afterRead = null;
  createPaymentLink.mockReset();
  createPaymentLink.mockResolvedValue({ formContext: "new-context", transactionID: "new-tx" });
  sendPaymentConfirmationEmail.mockReset();
  sendPaymentFailedEmail.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("GET /api/events/[eventId]/payment/[id] — SIBS session reuse", () => {
  it("reuses a fresh session while it is still open", async () => {
    rows = [paymentRow()];
    const res = await getPayment();
    expect(createPaymentLink).not.toHaveBeenCalled();
    expect(res.body.payment.formContext).toBe("old-context");
  });

  it("creates a new session once the cached one is older than 15 minutes", async () => {
    const old = new Date(Date.now() - 16 * 60_000).toISOString();
    rows = [paymentRow({ created_at: old, updated_at: old })];
    const res = await getPayment();
    expect(createPaymentLink).toHaveBeenCalledTimes(1);
    expect(res.body.payment.formContext).toBe("new-context");
  });

  it("does not offer a second payment when the row got paid while creating the session", async () => {
    rows = [paymentRow({ payment_link: null })];
    createPaymentLink.mockImplementation(async () => {
      rows[0].payment_status = "paid";
      return { formContext: "new-context", transactionID: "new-tx" };
    });
    const res = await getPayment();
    expect(res.body.has_pending_payment).toBe(false);
    expect(rows[0]).toMatchObject({ payment_status: "paid", payment_link: null, transaction_id: "old-tx" });
  });
});

describe("POST /api/payment/webhook — failure handling for event payments", () => {
  it("marks the payment failed and drops the dead session", async () => {
    rows = [paymentRow()];
    await sendWebhook("Declined", "old-tx");
    expect(rows[0]).toMatchObject({ payment_status: "failed", payment_link: null });
    expect(sendPaymentFailedEmail).toHaveBeenCalledTimes(1);
  });

  it("ignores a failure for an older SIBS transaction", async () => {
    rows = [paymentRow({ transaction_id: "new-tx", payment_link: "new-context" })];
    await sendWebhook("Declined", "old-tx");
    expect(rows[0]).toMatchObject({ payment_status: "pending", payment_link: "new-context", transaction_id: "new-tx" });
    expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it("ignores a failure when a newer session is stored between read and write", async () => {
    rows = [paymentRow()];
    afterRead = () => Object.assign(rows[0], { transaction_id: "new-tx", payment_link: "new-context" });
    await sendWebhook("Declined", "old-tx");
    expect(rows[0]).toMatchObject({ payment_status: "pending", payment_link: "new-context", transaction_id: "new-tx" });
    expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
  });

  it("never downgrades a paid payment", async () => {
    rows = [paymentRow({ payment_status: "paid" })];
    await sendWebhook("Declined", "old-tx");
    expect(rows[0].payment_status).toBe("paid");
  });
});

describe("retry after a declined/expired BLIK", () => {
  it("hands out a new session right after the failure and reuses it on reload, keeping the failed status", async () => {
    rows = [paymentRow()];
    await sendWebhook("Declined", "old-tx");

    const retry = await getPayment();
    expect(createPaymentLink).toHaveBeenCalledTimes(1);
    expect(retry.body.payment.formContext).toBe("new-context");
    expect(rows[0]).toMatchObject({ payment_status: "failed", payment_link: "new-context", transaction_id: "new-tx" });

    const reload = await getPayment();
    expect(createPaymentLink).toHaveBeenCalledTimes(1);
    expect(reload.body.payment.formContext).toBe("new-context");
  });

  it("lets a success on the new session mark the payment paid", async () => {
    rows = [paymentRow()];
    await sendWebhook("Declined", "old-tx");
    await getPayment();
    await sendWebhook("Success", "new-tx");
    expect(rows[0].payment_status).toBe("paid");
    expect(sendPaymentConfirmationEmail).toHaveBeenCalledTimes(1);
  });
});
