import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Minimal in-memory stand-in for the supabase-js query builder used by the handlers.
let tables;
const conflictKeys = {
  plebiscyt_votes: ["edition", "category", "voter_id"],
  plebiscyt_achievements: ["edition", "member_id"],
};
function from(table) {
  const filters = [];
  let op = "select";
  let patch = null;
  const run = () => {
    const rows = tables[table];
    if (op === "upsert") {
      const keys = conflictKeys[table];
      const existing = rows.find((r) => keys.every((k) => r[k] === patch[k]));
      if (existing) Object.assign(existing, patch);
      else rows.push({ ...patch });
      return { data: null, error: null };
    }
    const matched = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "delete") {
      tables[table] = rows.filter((r) => !matched.includes(r));
      return { data: null, error: null };
    }
    return { data: matched.map((r) => ({ ...r })), error: null };
  };
  const q = {
    select: () => q,
    upsert: (v) => ((op = "upsert"), (patch = v), q),
    delete: () => ((op = "delete"), q),
    eq: (k, v) => (filters.push((r) => r[k] === v), q),
    then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
  };
  return q;
}

let voter;
vi.mock("../api/plebiscyt/_shared.js", () => ({
  getServiceClient: () => ({ from }),
  authorizeVoter: async () => {
    if (!voter) throw new Error("Brak autoryzacji.");
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
  tables = {
    plebiscyt_votes: [
      { edition: 2025, category: "zatyrany_roku", voter_id: "me", candidate_id: "a" },
    ],
    plebiscyt_achievements: [],
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

  it("changes an existing vote and achievement instead of adding new rows", async () => {
    await call(voteHandler, "PUT", { votes: { zatyrany_roku: "me" }, achievement: "Pierwszy półmaraton" });
    await call(voteHandler, "PUT", { votes: { zatyrany_roku: "a" }, achievement: "  Życiówka na 10 km " });
    const votes2026 = tables.plebiscyt_votes.filter((v) => v.edition === 2026);
    expect(votes2026).toHaveLength(1);
    expect(votes2026[0].candidate_id).toBe("a");
    expect(tables.plebiscyt_achievements).toHaveLength(1);
    expect(tables.plebiscyt_achievements[0].description).toBe("Życiówka na 10 km");
  });

  it("removes a vote when the category is cleared", async () => {
    await call(voteHandler, "PUT", { votes: { zatyrany_roku: "a" }, achievement: "" });
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "" }, achievement: "Opis" });
    expect(res.statusCode).toBe(200);
    expect(tables.plebiscyt_votes.filter((v) => v.edition === 2026)).toHaveLength(0);
    expect(tables.plebiscyt_votes).toHaveLength(1);
  });

  it("rejects an empty submission", async () => {
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "" }, achievement: "  " });
    expect(res.statusCode).toBe(400);
  });

  it("rejects a candidate who is not on the list", async () => {
    const res = await call(voteHandler, "PUT", { votes: { zatyrany_roku: "gone" } });
    expect(res.statusCode).toBe(400);
    expect(tables.plebiscyt_votes.filter((v) => v.edition === 2026)).toHaveLength(0);
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
    expect(tables.plebiscyt_votes.find((v) => v.edition === 2026).candidate_id).toBe("a");
  });
});
