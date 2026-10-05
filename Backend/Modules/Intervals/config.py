# Modules/Intervals/config.py
from __future__ import annotations

INTERVALS_BASE = "https://intervals.icu/api/v1"

TABLE_INTERVALS_ACCOUNTS = "intervals_accounts"

# Hodiny (Europe/Bratislava), kedy hodinový scheduler spustí sync.
# Garmin posiela spánok a HRV ráno po synchronizácii hodiniek, preto ráno
# viackrát – posledný beh pred notifikáciou o recovery (11:00), aby user
# s napojenými hodinkami nedostal pripomienku na ručné vyplnenie.
SYNC_HOURS = {6, 7, 8, 9, 10}

# Koľko dní dozadu sa pri každom cron behu prepisuje. Garmin občas
# dopočíta spánok/HRV neskôr, 3 dni to zachytia.
CRON_SYNC_DAYS = 3

MAX_SYNC_DAYS = 90
MAX_ERROR_LEN = 300
