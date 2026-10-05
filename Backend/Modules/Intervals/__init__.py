# Modules/Intervals
#
# Voliteľná integrácia s intervals.icu (Garmin → intervals.icu → SelfRace).
# Zatiaľ len recovery (HRV, kľudový tep, spánok) do users_recovery.
#
# Celý balík je zámerne izolovaný: zvyšok appky sa naň odkazuje len na
# dvoch miestach (main.py – router, Services/trigger_tasks.py – cron) a obe
# sú v try/except. Vypnutie = vymazať INTERVALS_ACCOUNTS z env.
# Odstránenie = zmazať tento priečinok + tie dve miesta.
