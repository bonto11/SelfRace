-- Backend/sql/retention.sql
-- Udržanie nových userov: koľko ich je po 4 týždňoch stále aktívnych.
-- Len čítanie, nič nemení. Spusti v Supabase SQL editore (service role).
--
-- Dve metriky, lebo aktivity zo Stravy chodia aj userovi, ktorý appku
-- už neotvára:
--   trains_w4 = mal aspoň 1 aktivitu v 4. týždni (dni 21-27 od registrácie)
--   uses_w4   = v 4. týždni sám niečo urobil v appke (vyžiadal hodnotenie,
--               náhľad tréningu, plán... = ai_usage_events so source 'user')
-- uses_w4 je dôležitejšie číslo - ukazuje, či appka má pre usera hodnotu.

with cohort as (
  select
    u.id as user_id,
    au.created_at as signed_up_at,
    date_trunc('week', au.created_at)::date as cohort_week
  from public.users u
  join auth.users au on au.id::text = u.auth_uid::text
  where au.created_at < now() - interval '28 days'
),
trains as (
  select distinct c.user_id
  from cohort c
  join public.activities_summary a on a.user_id = c.user_id
  where a.date >= c.signed_up_at + interval '21 days'
    and a.date <  c.signed_up_at + interval '28 days'
),
uses as (
  select distinct c.user_id
  from cohort c
  join public.ai_usage_events e on e.user_id = c.user_id
  where e.source = 'user'
    and e.created_at >= c.signed_up_at + interval '21 days'
    and e.created_at <  c.signed_up_at + interval '28 days'
),
had_activity as (
  -- pripojil Stravu a niečo sa naimportovalo (vôbec začal)
  select distinct c.user_id
  from cohort c
  join public.activities_summary a on a.user_id = c.user_id
)
select
  c.cohort_week,
  count(*)                                                    as signups,
  count(h.user_id)                                            as started,
  count(t.user_id)                                            as trains_w4,
  count(s.user_id)                                            as uses_w4,
  round(100.0 * count(t.user_id) / nullif(count(*), 0), 1)    as trains_w4_pct,
  round(100.0 * count(s.user_id) / nullif(count(*), 0), 1)    as uses_w4_pct,
  round(100.0 * count(s.user_id) / nullif(count(h.user_id), 0), 1) as uses_w4_of_started_pct
from cohort c
left join had_activity h on h.user_id = c.user_id
left join trains t on t.user_id = c.user_id
left join uses s on s.user_id = c.user_id
group by c.cohort_week
order by c.cohort_week desc;
