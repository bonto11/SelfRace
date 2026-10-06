# Modules/Intervals
#
# Voliteľná integrácia s intervals.icu (Garmin → intervals.icu → SelfRace).
# Recovery (HRV, kľudový tep, spánok) do users_recovery a plán tréningov
# do kalendára intervals.icu → Garmin (workouts.py, zapína user).
#
# Celý balík je zámerne izolovaný: zvyšok appky sa naň odkazuje len na
# dvoch miestach (main.py – router, Services/trigger_tasks.py – cron) a obe
# sú v try/except. Kto má sync zapnutý, určuje tabuľka intervals_accounts
# (Backend/sql/intervals_accounts.sql). Vypnutie pre usera = enabled=false.
# Odstránenie = zmazať tento priečinok, tie dve miesta, FE tlačidlo
# (features/recovery/components/IntervalsSyncButton.tsx) a tabuľku.
