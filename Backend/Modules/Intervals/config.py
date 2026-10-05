# Modules/Intervals/config.py
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Dict, List

INTERVALS_BASE = "https://intervals.icu/api/v1"

# Hodiny (Europe/Bratislava), kedy hodinový scheduler spustí sync.
# Garmin posiela spánok a HRV ráno po synchronizácii hodiniek, preto ráno
# viackrát – posledný beh pred notifikáciou o recovery (11:00), aby user
# s napojenými hodinkami nedostal pripomienku na ručné vyplnenie.
SYNC_HOURS = {6, 7, 8, 9, 10}

# Koľko dní dozadu sa pri každom cron behu prepisuje. Garmin občas
# dopočíta spánok/HRV neskôr, 3 dni to zachytia.
CRON_SYNC_DAYS = 3

MAX_SYNC_DAYS = 90


@dataclass(frozen=True)
class IntervalsAccount:
    user_id: int
    athlete_id: str
    api_key: str


def _parse_accounts(raw: str) -> Dict[int, IntervalsAccount]:
    """
    INTERVALS_ACCOUNTS="46:i123456:APIKEY,52:i654321:APIKEY2"

    PREČO env a nie DB tabuľka: kým je to len pre pár userov, netreba
    migráciu ani UI na zadávanie kľúča. Keď sa to otvorí všetkým, nahradí
    sa len táto funkcia čítaním z DB (alebo OAuth) – zvyšok balíka ostáva.
    """
    out: Dict[int, IntervalsAccount] = {}
    for part in (raw or "").split(","):
        bits = [b.strip() for b in part.strip().split(":")]
        if len(bits) != 3 or not all(bits):
            continue
        try:
            uid = int(bits[0])
        except ValueError:
            continue
        out[uid] = IntervalsAccount(user_id=uid, athlete_id=bits[1], api_key=bits[2])
    return out


def get_accounts() -> Dict[int, IntervalsAccount]:
    # Číta sa pri každom volaní, aby zmena env na Railway nepotrebovala
    # zmenu kódu (stačí redeploy/restart).
    return _parse_accounts(os.getenv("INTERVALS_ACCOUNTS", ""))


def get_account(user_id: int) -> IntervalsAccount | None:
    return get_accounts().get(int(user_id))


def list_enabled_user_ids() -> List[int]:
    return sorted(get_accounts().keys())
