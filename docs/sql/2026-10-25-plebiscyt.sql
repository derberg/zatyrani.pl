-- Plebiscyt (/plebiscyt): one row per member per edition.
-- votes maps a category key to the chosen member id, e.g. {"zatyrany_roku": "<members.id>"},
-- or to "abstain" when the member abstained in that category.
-- Categories and the voting deadline live in src/utils/plebiscyt.js, so adding a category
-- later needs no schema change.
CREATE TABLE IF NOT EXISTS plebiscyt_entries (
  edition INTEGER NOT NULL,
  member_id UUID NOT NULL REFERENCES members(id),
  votes JSONB NOT NULL DEFAULT '{}',
  achievement TEXT NULL,
  -- Gala Zatyranych attendance: 'no', 'alone' or 'plus_one'.
  gala TEXT NULL CHECK (gala IN ('no', 'alone', 'plus_one')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (edition, member_id)
);

-- Only the API (service role) touches this table: RLS on, no policies.
ALTER TABLE plebiscyt_entries ENABLE ROW LEVEL SECURITY;

-- Results:
-- SELECT v.key AS category, m.name, count(*) AS votes
-- FROM plebiscyt_entries e, jsonb_each_text(e.votes) v
-- JOIN members m ON m.id::text = v.value
-- WHERE e.edition = 2026 GROUP BY v.key, m.name ORDER BY v.key, votes DESC;
-- Abstentions are the "abstain" values, which match no member and drop out of the join above.

-- Who can see /plebiscyt/wyniki (summary and everyone's achievements).
ALTER TABLE members ADD COLUMN IF NOT EXISTS can_view_plebiscyt BOOLEAN NOT NULL DEFAULT false;
-- Grant it by member id, after finding the right row with SELECT id, name FROM members:
-- UPDATE members SET can_view_plebiscyt = true WHERE id = '<members.id>';
