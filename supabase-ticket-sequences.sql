-- ─── Atomic ticket number sequences ───────────────────────────────────────────
-- Run once in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS itsm_sequences (
  prefix   TEXT    PRIMARY KEY,
  last_seq INTEGER NOT NULL DEFAULT 0
);

INSERT INTO itsm_sequences (prefix, last_seq)
VALUES ('INC', 0), ('REQ', 0), ('CHG', 0)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION next_ticket_number(p_prefix TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  UPDATE itsm_sequences
  SET last_seq = last_seq + 1
  WHERE prefix = p_prefix
  RETURNING last_seq INTO v_seq;

  RETURN p_prefix || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;
