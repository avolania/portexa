-- ============================================================
-- Pixanto PPM — itsm_sequences RLS Düzeltmesi
-- Sorun: itsm_sequences tablosu herkese açık (RLS kapalı).
-- Çözüm: RLS etkinleştir, doğrudan erişimi kapat.
--
-- Neden politika yok?
--   next_ticket_number() fonksiyonu SECURITY DEFINER ile tanımlı,
--   yani fonksiyon sahibi (postgres/service_role) yetkileriyle
--   çalışır ve RLS'yi otomatik olarak bypass eder.
--   Bu nedenle tabloya politika eklemeye gerek yok;
--   RLS açmak tek başına yeterlidir — authenticated/anon
--   kullanıcıların doğrudan erişimi engellenir, fonksiyon ise
--   etkilenmez.
--
-- Supabase SQL Editor'da çalıştırın. Tekrar çalıştırmak güvenlidir.
-- ============================================================

-- ── 1. RLS Etkinleştir ───────────────────────────────────────
-- Politikasız RLS = authenticated ve anon rollerine kapalı.
-- SECURITY DEFINER fonksiyonları bypass eder, etkilenmez.

alter table itsm_sequences enable row level security;

-- ── 2. Doğrulama ─────────────────────────────────────────────
-- Aşağıdaki sorguyu çalıştırarak RLS'nin aktif olduğunu doğrulayın:
-- select relname, relrowsecurity
-- from pg_class
-- where relname = 'itsm_sequences';
-- → relrowsecurity: true olmalı
