-- Ako user šport robí: hobby (s kamošmi), training (tréning v klube),
-- match (zápas / súťaž). Len pre šport, životné udalosti majú null.
-- PREČO: hobby futbal a klubový tréning + zápas sú pre plán úplne iná
-- záťaž - AI podľa toho skladá beh a silu okolo nich.
-- RLS sa nemení - pribúda len stĺpec. Kód funguje aj bez migrácie
-- (insert bez stĺpca, chýbajúca hodnota = hobby).

alter table public.coach_external_events
  add column if not exists role text
  check (role is null or role in ('hobby', 'training', 'match'));
