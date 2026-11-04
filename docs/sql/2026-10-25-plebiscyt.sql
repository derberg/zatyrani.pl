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
  -- Gala Zatyranych attendance: 'no', 'alone', 'plus_one' or 'plus_member' (the plus one is a member too).
  gala TEXT NULL CHECK (gala IN ('no', 'alone', 'plus_one', 'plus_member')),
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

-- 2026-11-04: added the 'plus_member' gala answer. For a table created before that, run this
-- right before deploying it:
-- ALTER TABLE plebiscyt_entries DROP CONSTRAINT plebiscyt_entries_gala_check;
-- ALTER TABLE plebiscyt_entries ADD CONSTRAINT plebiscyt_entries_gala_check
--   CHECK (gala IN ('no', 'alone', 'plus_one', 'plus_member'));
-- Every 'plus_one' answer given before 'plus_member' existed came from a member whose partner
-- is a member too, so move them over. Check the rows first:
-- SELECT e.member_id, m.name FROM plebiscyt_entries e JOIN members m ON m.id = e.member_id
--   WHERE e.edition = 2026 AND e.gala = 'plus_one';
-- UPDATE plebiscyt_entries SET gala = 'plus_member' WHERE edition = 2026 AND gala = 'plus_one';
