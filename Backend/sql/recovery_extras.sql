-- Regeneračné praktiky k rannému zápisu recovery („Včera“: sauna, otužovanie,
-- masáž, mobilita, zdriemnutie, fyzioterapia, dychové cvičenia).
-- Zoznam kľúčov (jsonb array), napr. ["sauna", "cold"]. Platia pre deň PRED
-- ranným zápisom – rovnako ako alkohol / neskorá káva.
-- RLS: existujúce politiky users_recovery (vlastné riadky + trainer_read) platia aj pre nový stĺpec.

alter table public.users_recovery
  add column if not exists recovery_extras jsonb;

comment on column public.users_recovery.recovery_extras is
  'Regeneračné praktiky deň pred ranným zápisom: sauna, cold, massage, mobility, nap, physio, breathing';
