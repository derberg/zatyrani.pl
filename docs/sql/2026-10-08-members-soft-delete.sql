-- SMS gate: soft delete for members.
-- Rows with deleted_at set are hidden from /sms and skipped when sending.
-- The row itself stays, so sms_gate_usage history keeps pointing at it.
ALTER TABLE members ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;
