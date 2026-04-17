-- ─── Atomic ticket number sequences (per-org) ──────────────────────────────
-- Idempotent — birden fazla kez çalıştırılabilir.

-- 1. Eski global tabloyu (single-PK) düşür, yerine composite-PK'lı yeni tablo
DROP TABLE IF EXISTS itsm_sequences;

CREATE TABLE IF NOT EXISTS itsm_sequences (
  prefix   TEXT    NOT NULL,
  org_id   TEXT    NOT NULL,
  last_seq INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (prefix, org_id)
);

-- 2. Per-org atomic sequence fonksiyonu
--    İlk çağrıda satırı otomatik seed'ler (INSERT … ON CONFLICT DO NOTHING),
--    ardından atomik UPDATE … RETURNING ile sıradaki numarayı alır.
CREATE OR REPLACE FUNCTION next_ticket_number(p_prefix TEXT, p_org_id TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_seq INTEGER;
BEGIN
  -- İlk ticket için satırı oluştur; zaten varsa dokunma
  INSERT INTO itsm_sequences (prefix, org_id, last_seq)
  VALUES (p_prefix, p_org_id, 0)
  ON CONFLICT (prefix, org_id) DO NOTHING;

  -- Atomic increment
  UPDATE itsm_sequences
  SET    last_seq = last_seq + 1
  WHERE  prefix  = p_prefix
    AND  org_id  = p_org_id
  RETURNING last_seq INTO v_seq;

  RETURN p_prefix || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$$;
