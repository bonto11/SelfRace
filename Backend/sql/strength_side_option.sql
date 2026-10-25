-- Jednostranné cviky: príznak data.side_option = obojstranný cvik, ktorý sa dá
-- robiť aj jednou rukou/nohou (zakopávanie, predkopávanie, bicepsy…). User to
-- volí pri cviku v zápise (log.exercises[].unilateral), váha je potom na stranu.
-- Nová tabuľka ani RLS netreba – mení sa len jsonb v strength_exercises.
-- updated_at = now() posunie verziu katalógu, FE si ho stiahne nanovo.

update public.strength_exercises
set data = jsonb_set(coalesce(data, '{}'::jsonb), '{side_option}', 'true'::jsonb),
    updated_at = now()
where id in (
  'leg_press_machine', 'leg_extension_machine', 'hamstring_curl_machine',
  'lying_leg_curl_machine', 'seated_calf_raise', 'standing_calf_raise',
  'leg_press_calf_raise', 'romanian_deadlift_dumbbell', 'kettlebell_swing',
  'lat_pulldown_machine', 'seated_cable_row', 'machine_row', 'chest_press_machine',
  'shoulder_press_dumbbell', 'farmers_carry', 'dumbbell_biceps_curl', 'hammer_curl',
  'cable_biceps_curl', 'overhead_triceps_extension', 'triceps_pushdown',
  'triceps_rope_pushdown', 'lateral_raise', 'rear_delt_fly', 'cable_fly'
)
and coalesce((data->>'unilateral')::boolean, false) = false
and coalesce((data->>'side_option')::boolean, false) = false;
