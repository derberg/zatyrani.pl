-- Plebiscyt (/plebiscyt2026): one row per member per edition.
-- votes maps a category key to the chosen member id, e.g. {"zatyrany_roku": "<members.id>"}.
-- Categories and the voting deadline live in src/utils/plebiscyt.js, so adding a category
-- later needs no schema change.
CREATE TABLE IF NOT EXISTS plebiscyt_entries (
  edition INTEGER NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id),
  votes JSONB NOT NULL DEFAULT '{}',
  achievement TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (edition, member_id)
);

-- Only the API (service role) touches this table: RLS on, no policies.
ALTER TABLE plebiscyt_entries ENABLE ROW LEVEL SECURITY;

-- Results:
-- SELECT v.key AS category, m.name, count(*) AS votes
-- FROM plebiscyt_entries e, jsonb_each_text(e.votes) v
-- JOIN members m ON m.id = v.value::uuid
-- WHERE e.edition = 2026 GROUP BY v.key, m.name ORDER BY v.key, votes DESC;
