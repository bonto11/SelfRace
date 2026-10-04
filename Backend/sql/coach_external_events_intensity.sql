-- Náročnosť externej aktivity (low / moderate / high).
-- Predtým sa ukladala len cez priority (high = fixed, inak optional), takže
-- stredná sa stratila. RLS sa nemení - pribúda len stĺpec.
-- Kód funguje aj bez migrácie (insert bez stĺpca, náročnosť z priority).

alter table public.coach_external_events
  add column if not exists intensity text
  check (intensity is null or intensity in ('low', 'moderate', 'high'));

-- staré riadky: rovnaké odvodenie, aké doteraz robil FE
update public.coach_external_events
set intensity = case when priority = 'fixed' then 'high' else 'low' end
where intensity is null;
