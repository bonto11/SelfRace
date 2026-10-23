-- Výživa: bielkoviny automaticky + BMR z body scanu (InBody).
-- Predpoklad: sql/nutrition.sql.

-- Bielkoviny: NULL = automaticky podľa cieľa (Configs/nutrition.py
-- PROTEIN_G_PER_KG_AUTO). Kontrola rozsahu 1,6–2,2 NULL prepustí.
alter table public.nutrition_profile alter column protein_g_per_kg drop not null;
alter table public.nutrition_profile alter column protein_g_per_kg drop default;
-- doterajších 1,8 bol len predvolený stav formulára, nie voľba usera
update public.nutrition_profile set protein_g_per_kg = null where protein_g_per_kg = 1.80;

-- BMR z už potvrdených body scanov do meraní (users_metrics `bmr_kcal`).
-- Nové zapisuje potvrdenie scanu (_sync_scan_metrics). Dátum = deň scanu,
-- rovnako ako váha a % tuku zo scanu.
insert into public.users_metrics (user_id, metric, value_num, unit, measured_at)
select bs.user_id,
       'bmr_kcal',
       bs.basal_metabolic_rate_kcal,
       'kcal',
       (bs.scan_date::date + time '12:00') at time zone 'UTC'
from public.body_scans bs
where bs.confirmed_by_user is true
  and bs.deleted_at is null
  and bs.basal_metabolic_rate_kcal is not null
  and not exists (
    select 1 from public.users_metrics m
    where m.user_id = bs.user_id
      and m.metric = 'bmr_kcal'
      and m.measured_at::date = bs.scan_date::date
  );
