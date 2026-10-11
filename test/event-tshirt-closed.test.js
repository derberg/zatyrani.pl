import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Per-table in-memory stand-in for the supabase-js query builder.
let tables;
function from(table) {
  const filters = [];
  let patch = null;
  let single = false;
  const run = () => {
    const matched = (tables[table] || []).filter((r) => filters.every((f) => f(r)));
    if (patch) {
      matched.forEach((r) => Object.assign(r, patch));
      return { data: null, error: null };
    }
    const data = single ? (matched[0] ? { ...matched[0] } : null) : matched.map((r) => ({ ...r }));
    return { data, error: null };
  };
  const q = {
    select: () => q,
    update: (v) => ((patch = v), q),
    upsert: () => q,
    eq: (k, v) => (filters.push((r) => r[k] === v), q),
    in: (k, vs) => (filters.push((r) => vs.includes(r[k])), q),
    order: () => q,
    limit: () => q,
    single: () => ((single = true), q),
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  };
  return q;
}

const updateOrCreatePayment = vi.fn();
const createParticipantRecords = vi.fn();

vi.mock("../api/shared/supabase.js", () => ({ getSupabaseClient: () => ({ from }) }));
vi.mock("../api/shared/auth.js", () => ({ verifyToken: () => ({ registration_id: "reg-1" }) }));
vi.mock("../api/shared/database-operations.js", () => ({
  updateOrCreatePayment: (...a) => updateOrCreatePayment(...a),
  createParticipantRecords: (...a) => createParticipantRecords(...a),
  upsertClubs: async () => {},
}));
vi.mock("../api/shared/email.js", () => ({ sendRegistrationConfirmationEmail: async () => {} }));

const { default: addParticipantsHandler } = await import("../api/events/[eventId]/add-participants.js");
const { default: updateParticipantHandler } = await import("../api/events/[eventId]/update-participant.js");

function mockRes() {
  return {
    statusCode: 0,
    body: null,
    setHeader: () => {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
}

const participant = {
  firstName: "Jan",
  lastName: "Kowalski",
  birthDate: "1990-01-01",
  city: "Rybnik",
  nationality: "PL",
  raceCategory: "21km",
  phoneNumber: "600700800",
  gender: "male",
};

async function call(handler, body) {
  const res = mockRes();
  await handler({ method: "POST", query: { eventId: "wilczypolmaraton-2026" }, body }, res);
  return res;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
  updateOrCreatePayment.mockReset();
  createParticipantRecords.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  tables = {
    event_payments: [{ id: "pay-1", registration_id: "reg-1", payment_status: "pending", created_at: "2026-09-01T10:00:00Z" }],
    event_participants: [
      { id: "p-shirt", registration_id: "reg-1", tshirt_size: "M", created_at: "2026-09-01T10:00:00Z" },
      { id: "p-none", registration_id: "reg-1", tshirt_size: null, created_at: "2026-09-01T10:00:00Z" },
    ],
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("wilczypolmaraton-2026 — t-shirt sales closed", () => {
  it("rejects adding a participant with a t-shirt", async () => {
    const res = await call(addParticipantsHandler, { participants: [{ ...participant, tshirtSize: "L" }] });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("TSHIRT_CLOSED");
    expect(createParticipantRecords).not.toHaveBeenCalled();
  });

  it("rejects ordering a t-shirt for a participant who had none", async () => {
    const res = await call(updateParticipantHandler, { participantId: "p-none", participant: { ...participant, tshirtSize: "L" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("TSHIRT_CLOSED");
    expect(tables.event_participants[1].tshirt_size).toBe(null);
  });

  it("rejects changing the size of an existing order", async () => {
    const res = await call(updateParticipantHandler, { participantId: "p-shirt", participant: { ...participant, tshirtSize: "XL" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("TSHIRT_CLOSED");
    expect(tables.event_participants[0].tshirt_size).toBe("M");
  });

  it("keeps an existing order when other data is edited", async () => {
    const res = await call(updateParticipantHandler, { participantId: "p-shirt", participant: { ...participant, city: "Gliwice", tshirtSize: "M" } });
    expect(res.statusCode).toBe(200);
    expect(tables.event_participants[0]).toMatchObject({ city: "Gliwice", tshirt_size: "M" });
  });

  it("lets a participant drop an existing order", async () => {
    const res = await call(updateParticipantHandler, { participantId: "p-shirt", participant: { ...participant, tshirtSize: "" } });
    expect(res.statusCode).toBe(200);
    expect(tables.event_participants[0].tshirt_size).toBe(null);
  });
});

describe("wilczypolmaraton-2026 — already ordered t-shirts", () => {
  it("are still charged in the payment", async () => {
    const { calculatePaymentForParticipants } = await import("../api/shared/participant-validation.js");
    const { getEventConfig } = await import("../api/events/config.js");
    const payment = calculatePaymentForParticipants(
      [{ race_category: "21km", tshirt_size: "M" }, { race_category: "21km", tshirt_size: null }],
      getEventConfig("wilczypolmaraton-2026")
    );
    expect(payment.tshirtFees).toBe(80);
  });
});
