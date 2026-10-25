-- Plebiscyt (/plebiscyt2026): members vote in categories and describe their sporting year.
-- Categories and the voting deadline live in src/utils/plebiscyt.js; the DB only stores
-- the category key, so adding a category later needs no schema change.

-- One vote per voter per category per edition. Changing a vote updates the row.
CREATE TABLE IF NOT EXISTS plebiscyt_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edition INTEGER NOT NULL,
  category TEXT NOT NULL,
  voter_id UUID NOT NULL REFERENCES members(id),
  candidate_id UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (edition, category, voter_id)
);

-- "Opisz swoje osiągnięcie": optional, one text per member per edition.
CREATE TABLE IF NOT EXISTS plebiscyt_achievements (
  edition INTEGER NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id),
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (edition, member_id)
);

-- Only the API (service role) touches these tables: RLS on, no policies.
ALTER TABLE plebiscyt_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plebiscyt_achievements ENABLE ROW LEVEL SECURITY;

-- Results:
-- SELECT category, m.name, count(*) AS votes
-- FROM plebiscyt_votes v JOIN members m ON m.id = v.candidate_id
-- WHERE edition = 2026 GROUP BY category, m.name ORDER BY category, votes DESC;
