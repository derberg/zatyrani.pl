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
      gala: "",
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
  const both = (zatyrany = "a") => ({ serce_druzyny: "a", zatyrany_roku: zatyrany });

  it("saves votes in both categories, yourself included, without a description", async () => {
    const res = await call(voteHandler, "PUT", {
      votes: { serce_druzyny: "a", zatyrany_roku: "me" },
      achievement: "",
      gala: "alone",
    });
    expect(res.statusCode).toBe(200);
    const state = await call(stateHandler, "GET");
    expect(state.body.votes).toEqual({ serce_druzyny: "a", zatyrany_roku: "me" });
    expect(state.body.achievement).toBe("");
    expect(state.body.gala).toBe("alone");
  });

  it("accepts abstaining in a category instead of choosing a person", async () => {
    const res = await call(voteHandler, "PUT", {
      votes: { serce_druzyny: "abstain", zatyrany_roku: "a" },
      gala: "no",
    });
    expect(res.statusCode).toBe(200);
    expect((await call(stateHandler, "GET")).body.votes).toEqual({ serce_druzyny: "abstain", zatyrany_roku: "a" });
  });

  it("requires a vote in both categories", async () => {
    expect((await call(voteHandler, "PUT", { votes: {}, gala: "no" })).statusCode).toBe(400);
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "a", serce_druzyny: "" }, gala: "no" });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain("Serce Drużyny");
    expect(tables.plebiscyt_entries.filter((e) => e.edition === 2026)).toHaveLength(0);
  });

  it("changes an existing answer instead of adding a new row", async () => {
    await call(voteHandler, "PUT", { votes: both("me"), achievement: "Pierwszy półmaraton", gala: "no" });
    await call(voteHandler, "PUT", {
      votes: both("a"),
      achievement: "  Życiówka na 10 km ",
      gala: "plus_one",
    });
    const entries2026 = tables.plebiscyt_entries.filter((e) => e.edition === 2026);
    expect(entries2026).toHaveLength(1);
    expect(entries2026[0].votes).toEqual(both("a"));
    expect(entries2026[0].achievement).toBe("Życiówka na 10 km");
    expect(entries2026[0].gala).toBe("plus_one");
    expect(tables.plebiscyt_entries.find((e) => e.edition === 2025).votes).toEqual({ zatyrany_roku: "a" });
  });

  it("does not let a saved vote be cleared", async () => {
    await call(voteHandler, "PUT", { votes: both("a"), gala: "alone" });
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "", serce_druzyny: "a" }, gala: "alone" });
    expect(res.statusCode).toBe(400);
    expect(tables.plebiscyt_entries.find((e) => e.edition === 2026).votes).toEqual(both("a"));
  });

  it("requires a valid gala answer", async () => {
    expect((await call(voteHandler, "PUT", { votes: both(), achievement: "Opis" })).statusCode).toBe(400);
    expect((await call(voteHandler, "PUT", { votes: both(), gala: "maybe" })).statusCode).toBe(400);
    expect(tables.plebiscyt_entries.filter((e) => e.edition === 2026)).toHaveLength(0);
  });

  it("ignores votes for categories that are not configured", async () => {
    await call(voteHandler, "PUT", { votes: { ...both(), kijkarz: "me" }, gala: "no" });
    expect(tables.plebiscyt_entries.find((e) => e.edition === 2026).votes).toEqual(both());
  });

  it("rejects a candidate who is not on the list", async () => {
    const res = await call(voteHandler, "PUT", { votes: both("gone"), gala: "no" });
    expect(res.statusCode).toBe(400);
    expect(tables.plebiscyt_entries.filter((e) => e.edition === 2026)).toHaveLength(0);
  });

  it("rejects a too long description", async () => {
    const res = await call(voteHandler, "PUT", { votes: both(), achievement: "x".repeat(1001), gala: "no" });
    expect(res.statusCode).toBe(400);
  });

  it("accepts votes on the last day and refuses them after the deadline", async () => {
    vi.setSystemTime(new Date("2026-11-14T23:59:00+01:00"));
    expect((await call(voteHandler, "PUT", { votes: both("a"), gala: "alone" })).statusCode).toBe(200);

    vi.setSystemTime(new Date("2026-11-15T00:00:01+01:00"));
    const res = await call(voteHandler, "PUT", { votes: both("me"), gala: "alone" });
    expect(res.statusCode).toBe(403);
    expect((await call(stateHandler, "GET")).body.closed).toBe(true);
    expect(tables.plebiscyt_entries.find((e) => e.edition === 2026).votes).toEqual(both("a"));
  });
});

describe("GET /api/plebiscyt/results", () => {
  it("counts votes and abstentions per category, sums gala seats and lists achievements by name", async () => {
    tables.plebiscyt_entries.push(
      { edition: 2026, member_id: "me", votes: { zatyrany_roku: "a", serce_druzyny: "a" }, achievement: "Życiówka", gala: "plus_one" },
      { edition: 2026, member_id: "a", votes: { zatyrany_roku: "a", serce_druzyny: "abstain" }, achievement: null, gala: "alone" },
      { edition: 2026, member_id: "gone", votes: { zatyrany_roku: "me" }, achievement: "Pierwszy ultra", gala: "no" }
    );
    const res = await call(resultsHandler, "GET");
    expect(res.statusCode).toBe(200);
    expect(res.body.categories).toEqual([
      {
        key: "serce_druzyny",
        label: "Serce Drużyny",
        total: 1,
        abstained: 1,
        results: [{ name: "Ania", votes: 1 }],
      },
      {
        key: "zatyrany_roku",
        label: "Zatyrany Roku",
        total: 3,
        abstained: 0,
        results: [
          { name: "Ania", votes: 2 },
          { name: "Łysy", votes: 1 },
        ],
      },
    ]);
    expect(res.body.gala).toEqual({
      people: 3,
      options: [
        { key: "no", label: "Nie będę", count: 1, names: ["Stary"], people: 0 },
        { key: "alone", label: "Będę sam/sama", count: 1, names: ["Ania"], people: 1 },
        { key: "plus_one", label: "Będę z osobą towarzyszącą", count: 1, names: ["Łysy"], people: 2 },
      ],
    });
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
