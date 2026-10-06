-- Dôvod zrušenia plánu: 'user' (zrušil sám) / 'autocancel' (nespustený plán,
-- začiatok starší ako 3 dni - Services/plan_pending.py).
-- RLS sa nemení - stĺpec patrí pod existujúce politiky coach_plan_meta.
alter table public.coach_plan_meta
  add column if not exists cancel_reason text;
