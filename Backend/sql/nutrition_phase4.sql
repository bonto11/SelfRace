-- Výživa fáza 4: režim bez počítania, kalibrácia výdaja, stav dňa
-- („deň mám zapísaný celý“, AI návrh jedál), zdroje zápisu suggestion/copy.
-- Predpoklad: sql/nutrition.sql, sql/nutrition_bmr_protein.sql.
-- Popis: docs/VYZIVA.md.

-- ---------------------------------------------------------------------------
-- Profil
-- ---------------------------------------------------------------------------
-- mode: macros = čísla, simple = tanier a porcie bez počítania
alter table public.nutrition_profile
  add column if not exists mode text not null default 'macros';
alter table public.nutrition_profile drop constraint if exists nutrition_profile_mode_check;
alter table public.nutrition_profile
  add constraint nutrition_profile_mode_check check (mode in ('macros', 'simple'));

-- kalibrácia z váhy a celých dní (Services/nutrition_calibration.py);
-- NULL = bez kalibrácie (faktor 1). Rozsah 0,90–1,15 drží aj BE.
alter table public.nutrition_profile
  add column if not exists tdee_factor numeric(4,3);
alter table public.nutrition_profile drop constraint if exists nutrition_profile_tdee_factor_check;
alter table public.nutrition_profile
  add constraint nutrition_profile_tdee_factor_check
  check (tdee_factor is null or tdee_factor between 0.80 and 1.30);
alter table public.nutrition_profile
  add column if not exists tdee_calibration jsonb;
alter table public.nutrition_profile
  add column if not exists tdee_calibrated_at timestamptz;

-- ---------------------------------------------------------------------------
-- Zápis jedla: nové zdroje (AI návrh jedál, „ako včera“)
-- ---------------------------------------------------------------------------
alter table public.food_log drop constraint if exists food_log_source_check;
alter table public.food_log
  add constraint food_log_source_check check (source in (
    'manual', 'text', 'favorite', 'recent', 'barcode', 'label', 'photo', 'suggestion', 'copy'
  ));

-- ---------------------------------------------------------------------------
-- Stav dňa
-- ---------------------------------------------------------------------------
create table if not exists public.nutrition_days (
  user_id        bigint not null references public.users(id) on delete cascade,
  log_date       date   not null,
  -- user potvrdil, že deň je zapísaný celý (rozpočet, kalibrácia, varovania)
  complete       boolean not null default false,
  -- posledný AI návrh jedál na tento deň (Services/AI/nutrition/main.py)
  suggestion     jsonb check (suggestion is null or jsonb_typeof(suggestion) = 'object'),
  suggestion_at  timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, log_date)
);

do $$
declare
  t text := 'nutrition_days';
begin
  execute format('alter table public.%I enable row level security', t);
  execute format('grant select, insert, update, delete on public.%I to authenticated', t);

  execute format('drop policy if exists select_own on public.%I', t);
  execute format('drop policy if exists insert_own on public.%I', t);
  execute format('drop policy if exists update_own on public.%I', t);
  execute format('drop policy if exists delete_own on public.%I', t);
  execute format('drop policy if exists trainer_read on public.%I', t);

  execute format(
    'create policy select_own on public.%I for select using (user_id = app_user_id())', t);
  execute format(
    'create policy insert_own on public.%I for insert with check (user_id = app_user_id())', t);
  execute format(
    'create policy update_own on public.%I for update using (user_id = app_user_id()) '
    'with check (user_id = app_user_id())', t);
  execute format(
    'create policy delete_own on public.%I for delete using (user_id = app_user_id())', t);

  -- živý tréner: len čítanie, kým spolupráca beží
  execute format(
    'create policy trainer_read on public.%I for select to authenticated '
    'using (user_id in (select public.sr_my_athlete_ids()))', t);
end $$;

-- Rollback:
-- drop table if exists public.nutrition_days;
-- alter table public.food_log drop constraint if exists food_log_source_check;
-- alter table public.food_log add constraint food_log_source_check check (source in
--   ('manual', 'text', 'favorite', 'recent', 'barcode', 'label', 'photo'));
-- alter table public.nutrition_profile drop column if exists tdee_calibrated_at,
--   drop column if exists tdee_calibration, drop column if exists tdee_factor,
--   drop column if exists mode;
