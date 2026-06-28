-- ============================================================
-- Pixanto PPM — Döviz Kuru Tablosu
-- Frankfurter API'den günlük çekilen EUR/TRY, USD/TRY, USD/EUR
--
-- Supabase SQL Editor'da çalıştırın. Tekrar çalıştırmak güvenlidir.
-- ============================================================

CREATE TABLE IF NOT EXISTS exchange_rates (
  pair       TEXT        PRIMARY KEY,           -- 'EUR_TRY', 'USD_TRY', 'USD_EUR'
  rate       NUMERIC(14, 6) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- Kurlar hassas veri değil, herkes okuyabilir
DROP POLICY IF EXISTS "exchange_rates_read" ON exchange_rates;
CREATE POLICY "exchange_rates_read" ON exchange_rates
  FOR SELECT USING (true);

-- Yazma yalnızca service_role (API route, cron job)
-- RLS ile authenticated/anon kulllanıcılar yazamaz

-- İlk seed: API çalışmadan önce makul varsayılanlar
INSERT INTO exchange_rates (pair, rate, updated_at) VALUES
  ('EUR_TRY', 38.50, now()),
  ('USD_TRY', 35.50, now()),
  ('USD_EUR', 0.923, now())
ON CONFLICT (pair) DO NOTHING;
