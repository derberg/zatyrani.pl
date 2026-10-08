import { describe, it, expect, vi, beforeEach } from "vitest";

// Minimal in-memory stand-in for the supabase-js query builder used by the handler.
let tables;
let rows;
function from(table) {
  const rows = tables[table];
  const filters = [];
  let op = "select";
  let patch = null;
  let single = false;
  const run = () => {
    if (op === "insert") {
      const row = { id: `id-${rows.length + 1}`, deleted_at: null, ...patch };
      rows.push(row);
      return { data: single ? row : [row], error: null };
    }
    const matched = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "delete") {
      tables[table] = rows.filter((r) => !matched.includes(r));
      return { data: null, error: null };
    }
    if (op === "update") matched.forEach((r) => Object.assign(r, patch));
    return { data: single ? matched[0] : matched.map((r) => ({ ...r })), error: null };
  };
  const q = {
    select: () => q,
    insert: (v) => ((op = "insert"), (patch = v), q),
    update: (v) => ((op = "update"), (patch = v), q),
    delete: () => ((op = "delete"), q),
    eq: (k, v) => (filters.push((r) => r[k] === v), q),
    is: (k, v) => (filters.push((r) => (r[k] ?? null) === v), q),
    single: () => ((single = true), q),
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  };
  return q;
}

vi.mock("../api/sms-gate/_shared.js", () => ({
  getServiceClient: () => ({ from }),
  authorizeSender: async () => ({ id: "me", name: "Łysy" }),
  systemError: (res) => res.status(500).json({ error: "system" }),
}));

const { default: handler } = await import("../api/sms-gate/members.js");

async function call(method, { id, body } = {}) {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  await handler({ method, query: id ? { id } : {}, body }, res);
  return res;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  rows = [
    { id: "me", name: "Łysy", phone: "+48500000001", can_send_sms: true, deleted_at: null },
    { id: "a", name: "Ania", phone: "\u202A+48500000002", can_send_sms: true, deleted_at: null },
    { id: "gone", name: "Stary", phone: "+48500000003", can_send_sms: true, deleted_at: "2026-01-01T00:00:00Z" },
  ];
  tables = {
    members: rows,
    sessions: [
      { id: "s1", member_id: "a" },
      { id: "s2", member_id: "me" },
    ],
  };
});

describe("POST /api/sms-gate/members", () => {
  it("adds a member with a normalized phone", async () => {
    const res = await call("POST", { body: { name: "  Jan   Kowalski ", phone: "600 100 200" } });
    expect(res.statusCode).toBe(201);
    expect(res.body.member).toMatchObject({ name: "Jan Kowalski", phone: "+48600100200" });
    expect(rows).toHaveLength(4);
  });

  it("rejects a phone already on the list, even with copy-paste marks", async () => {
    const res = await call("POST", { body: { name: "Ania 2", phone: "500 000 002" } });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toContain("Ania");
  });

  it("restores a deleted member with the same phone instead of duplicating", async () => {
    const res = await call("POST", { body: { name: "Stary Nowy", phone: "500000003" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.restored).toBe(true);
    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({ name: "Stary Nowy", deleted_at: null, can_send_sms: false });
  });

  it("validates name and phone", async () => {
    expect((await call("POST", { body: { name: "", phone: "600100200" } })).statusCode).toBe(400);
    expect((await call("POST", { body: { name: "Jan", phone: "123" } })).statusCode).toBe(400);
  });
});

describe("PATCH /api/sms-gate/members", () => {
  it("updates name and phone", async () => {
    const res = await call("PATCH", { id: "a", body: { name: "Anna", phone: "+48 600 100 201" } });
    expect(res.statusCode).toBe(200);
    expect(rows[1]).toMatchObject({ name: "Anna", phone: "+48600100201" });
  });

  it("allows saving the member's own unchanged phone", async () => {
    const res = await call("PATCH", { id: "a", body: { name: "Anna", phone: "500000002" } });
    expect(res.statusCode).toBe(200);
  });

  it("rejects a phone belonging to someone else", async () => {
    const res = await call("PATCH", { id: "a", body: { name: "Anna", phone: "500000001" } });
    expect(res.statusCode).toBe(409);
  });

  it("returns 404 for a deleted member", async () => {
    const res = await call("PATCH", { id: "gone", body: { name: "X", phone: "600100209" } });
    expect(res.statusCode).toBe(404);
  });

  it("requires an id", async () => {
    expect((await call("PATCH", { body: { name: "X", phone: "600100209" } })).statusCode).toBe(400);
  });
});

describe("DELETE /api/sms-gate/members", () => {
  it("soft-deletes by setting deleted_at and keeps the row", async () => {
    const res = await call("DELETE", { id: "a" });
    expect(res.statusCode).toBe(200);
    expect(rows).toHaveLength(3);
    expect(rows[1].deleted_at).toBeTruthy();
  });

  it("logs the deleted member out of all sessions", async () => {
    await call("DELETE", { id: "a" });
    expect(tables.sessions).toEqual([{ id: "s2", member_id: "me" }]);
  });

  it("refuses to delete the logged-in sender", async () => {
    const res = await call("DELETE", { id: "me" });
    expect(res.statusCode).toBe(400);
    expect(rows[0].deleted_at).toBeNull();
  });

  it("returns 404 when already deleted", async () => {
    expect((await call("DELETE", { id: "gone" })).statusCode).toBe(404);
  });
});

it("rejects other methods", async () => {
  expect((await call("GET")).statusCode).toBe(405);
});
