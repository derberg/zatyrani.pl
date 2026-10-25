import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Minimal in-memory stand-in for the supabase-js query builder used by the handlers.
let tables;
function from(table) {
  const filters = [];
  let op = "select";
  let patch = null;
  const run = () => {
    const rows = tables[table];
    if (op === "upsert") {
      const existing = rows.find((r) => r.edition === patch.edition && r.member_id === patch.member_id);
      if (existing) Object.assign(existing, patch);
      else rows.push({ ...patch });
      return { data: null, error: null };
    }
    const matched = rows.filter((r) => filters.every((f) => f(r)));
    return { data: matched.map((r) => ({ ...r })), error: null };
  };
  const q = {
    select: () => q,
    upsert: (v) => ((op = "upsert"), (patch = v), q),
    eq: (k, v) => (filters.push((r) => r[k] === v), q),
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  };
  return q;
}

let voter;
let isAdmin;
vi.mock("../api/plebiscyt/_shared.js", () => ({
  getServiceClient: () => ({ from }),
  authorizeVoter: async () => {
    if (!voter) throw new Error("Brak autoryzacji.");
    return voter;
  },
  authorizeAdmin: async () => {
    if (!voter) throw new Error("Brak autoryzacji.");
    if (!isAdmin) throw Object.assign(new Error("forbidden"), { status: 403 });
    return voter;
  },
  listActiveMembers: async () => [
    { id: "me", name: "Łysy", phone: "+48500000001" },
    { id: "a", name: "Ania", phone: "+48500000002" },
  ],
  systemError: (res) => res.status(500).json({ error: "system" }),
}));

const { default: stateHandler } = await import("../api/plebiscyt/state.js");
const { default: voteHandler } = await import("../api/plebiscyt/vote.js");
const { default: resultsHandler } = await import("../api/plebiscyt/results.js");

async function call(handler, method, body) {
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
  await handler({ method, query: {}, body }, res);
  return res;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T12:00:00+01:00"));
  vi.spyOn(console, "log").mockImplementation(() => {});
  voter = { id: "me", name: "Łysy" };
  isAdmin = true;
  tables = {
    members: [
      { id: "me", name: "Łysy" },
      { id: "a", name: "Ania" },
      { id: "gone", name: "Stary" },
    ],
    plebiscyt_entries: [
      { edition: 2025, member_id: "me", votes: { zatyrany_roku: "a" }, achievement: "Stary opis" },
    ],
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/plebiscyt/state", () => {
  it("returns candidates without phones and no answers for a new voter", async () => {
    const res = await call(stateHandler, "GET");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      me: { id: "me", name: "Łysy" },
      candidates: [
        { id: "me", name: "Łysy" },
        { id: "a", name: "Ania" },
      ],
      votes: {},
      achievement: "",
      closed: false,
    });
  });

  it("returns 401 when not logged in", async () => {
    voter = null;
    const res = await call(stateHandler, "GET");
    expect(res.statusCode).toBe(401);
  });
});

describe("PUT /api/plebiscyt/vote", () => {
  it("saves a vote for yourself without a description", async () => {
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "me" }, achievement: "" });
    expect(res.statusCode).toBe(200);
    const state = await call(stateHandler, "GET");
    expect(state.body.votes).toEqual({ zatyrany_roku: "me" });
    expect(state.body.achievement).toBe("");
  });

  it("changes an existing answer instead of adding a new row", async () => {
    await call(voteHandler, "PUT", { votes: { zatyrany_roku: "me" }, achievement: "Pierwszy półmaraton" });
    await call(voteHandler, "PUT", { votes: { zatyrany_roku: "a" }, achievement: "  Życiówka na 10 km " });
    const entries2026 = tables.plebiscyt_entries.filter((e) => e.edition === 2026);
    expect(entries2026).toHaveLength(1);
    expect(entries2026[0].votes).toEqual({ zatyrany_roku: "a" });
    expect(entries2026[0].achievement).toBe("Życiówka na 10 km");
    expect(tables.plebiscyt_entries.find((e) => e.edition === 2025).votes).toEqual({ zatyrany_roku: "a" });
  });

  it("removes a vote when the category is cleared", async () => {
    await call(voteHandler, "PUT", { votes: { zatyrany_roku: "a" }, achievement: "" });
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "" }, achievement: "Opis" });
    expect(res.statusCode).toBe(200);
    expect(tables.plebiscyt_entries.find((e) => e.edition === 2026).votes).toEqual({});
    expect((await call(stateHandler, "GET")).body.votes).toEqual({});
  });

  it("rejects an empty submission", async () => {
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "" }, achievement: "  " });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a candidate who is not on the list", async () => {
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "gone" } });
    expect(res.statusCode).toBe(400);
    expect(tables.plebiscyt_entries.filter((e) => e.edition === 2026)).toHaveLength(0);
  });

  it("rejects a too long description", async () => {
    const res = await call(voteHandler, "PUT", { votes: {}, achievement: "x".repeat(1001) });
    expect(res.statusCode).toBe(400);
  });

  it("accepts votes on the last day and refuses them after the deadline", async () => {
    vi.setSystemTime(new Date("2026-11-14T23:59:00+01:00"));
    expect((await call(voteHandler, "PUT", { votes: { zatyrany_roku: "a" } })).statusCode).toBe(200);

    vi.setSystemTime(new Date("2026-11-15T00:00:01+01:00"));
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "me" } });
    expect(res.statusCode).toBe(403);
    expect((await call(stateHandler, "GET")).body.closed).toBe(true);
    expect(tables.plebiscyt_entries.find((e) => e.edition === 2026).votes).toEqual({ zatyrany_roku: "a" });
  });
});

describe("GET /api/plebiscyt/results", () => {
  it("counts votes per category and lists achievements by name", async () => {
    tables.plebiscyt_entries.push(
      { edition: 2026, member_id: "me", votes: { zatyrany_roku: "a" }, achievement: "Życiówka" },
      { edition: 2026, member_id: "a", votes: { zatyrany_roku: "a" }, achievement: null },
      { edition: 2026, member_id: "gone", votes: { zatyrany_roku: "me" }, achievement: "Pierwszy ultra" }
    );
    const res = await call(resultsHandler, "GET");
    expect(res.statusCode).toBe(200);
    expect(res.body.categories).toEqual([
      {
        key: "zatyrany_roku",
        label: "Wybierz Zatyranego Roku",
        total: 3,
        results: [
          { name: "Ania", votes: 2 },
          { name: "Łysy", votes: 1 },
        ],
      },
    ]);
    expect(res.body.achievements).toEqual([
      { name: "Łysy", achievement: "Życiówka" },
      { name: "Stary", achievement: "Pierwszy ultra" },
    ]);
    expect(res.body.answered).toBe(3);
    expect(res.body.members).toBe(2);
  });

  it("returns 403 for a member without results access", async () => {
    isAdmin = false;
    expect((await call(resultsHandler, "GET")).statusCode).toBe(403);
  });

  it("returns 401 when not logged in", async () => {
    voter = null;
    expect((await call(resultsHandler, "GET")).statusCode).toBe(401);
  });
});
