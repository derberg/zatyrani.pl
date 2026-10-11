import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Per-table in-memory stand-in for the supabase-js query builder.
let tables;
function from(table) {
  const filters = [];
  let single = false;
  const run = () => {
    const matched = (tables[table] || []).filter((r) => filters.every((f) => f(r)));
    const data = single ? (matched[0] ? { ...matched[0] } : null) : matched.map((r) => ({ ...r }));
    return { data, error: null };
  };
  const q = {
    select: () => q,
    eq: (k, v) => (filters.push((r) => r[k] === v), q),
    in: (k, vs) => (filters.push((r) => vs.includes(r[k])), q),
    order: () => q,
    limit: () => q,
    single: () => ((single = true), q),
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  };
  return q;
}

vi.mock("../api/shared/supabase.js", () => ({ getSupabaseClient: () => ({ from }) }));
vi.mock("../api/shared/auth.js", () => ({ verifyToken: () => ({ registration_id: "reg-1" }) }));
vi.mock("../api/shared/database-operations.js", () => ({ repricePendingPayment: async () => ({}) }));

const { default: dashboardHandler } = await import("../api/events/[eventId]/dashboard.js");

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

async function getDashboard() {
  const res = mockRes();
  await dashboardHandler({ method: "GET", query: { eventId: "wilczypolmaraton-2026" } }, res);
  return res;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  tables = {
    event_registrations: [{ id: "reg-1", email: "a@b.pl", contact_person: "Jan", created_at: "2026-09-01T10:00:00Z" }],
    event_participants: [{ id: "p-1", registration_id: "reg-1", first_name: "Jan", last_name: "K", race_category: "21km", created_at: "2026-09-01T10:00:00Z" }],
    event_payments: [{ id: "pay-1", registration_id: "reg-1", total_amount: 130, race_fees: 130, tshirt_fees: 0, payment_status: "pending", created_at: "2026-09-01T10:00:00Z" }],
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/events/wilczypolmaraton-2026/dashboard — registrationDeadline", () => {
  it("lets an unpaid registration pay and add participants until 15 Oct", async () => {
    vi.setSystemTime(new Date("2026-10-15T20:00:00Z"));
    const res = await getDashboard();
    expect(res.statusCode).toBe(200);
    expect(res.body.paymentOpen).toBe(true);
    expect(res.body.canAddParticipants).toBe(true);
    expect(res.body.payment.paymentStatus).toBe("pending");
  });

  it("closes payment and adding participants after 15 Oct, but the panel still loads", async () => {
    vi.setSystemTime(new Date("2026-10-16T00:00:00Z"));
    const res = await getDashboard();
    expect(res.statusCode).toBe(200);
    expect(res.body.paymentOpen).toBe(false);
    expect(res.body.canAddParticipants).toBe(false);
    expect(res.body.participants).toHaveLength(1);
  });
});
