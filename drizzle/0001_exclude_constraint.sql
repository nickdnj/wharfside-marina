-- STORY-04: Postgres EXCLUDE USING gist constraint on assignment table.
-- This is the booking model's hard guarantee — no two assignments on the same
-- slip can overlap in date range while in proposed/confirmed status.
-- Drizzle cannot express this in its DSL, so it lives in raw SQL.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Generated daterange column (inclusive on both ends).
ALTER TABLE assignment
  ADD COLUMN IF NOT EXISTS daterange daterange
  GENERATED ALWAYS AS (daterange(start_date, end_date, '[]')) STORED;

-- The EXCLUDE constraint.
ALTER TABLE assignment
  DROP CONSTRAINT IF EXISTS no_slip_overlap;

ALTER TABLE assignment
  ADD CONSTRAINT no_slip_overlap
  EXCLUDE USING gist (
    slip_id WITH =,
    daterange WITH &&
  ) WHERE (status IN ('proposed','confirmed'));

-- audit_log append-only enforcement.
-- Revoke UPDATE and DELETE from the application role.
-- The application role name is environment-specific; replace `app_role` as needed.
-- REVOKE UPDATE, DELETE ON audit_log FROM app_role;
