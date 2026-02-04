from __future__ import annotations

import os
import time
import random
from typing import Dict, Optional

from Routes_DB.async_jobs import (
    db_pick_next_queued_job_global,
    db_pick_next_queued_job_for_user,
)
from Services.async_jobs import service_execute_job

WORKER_ID = os.getenv("ASYNC_WORKER_ID", "worker-1")
CHAIN_LIMIT = int(os.getenv("ASYNC_CHAIN_LIMIT", "10"))

IDLE_MIN = float(os.getenv("ASYNC_IDLE_MIN", "0.5"))
IDLE_MAX = float(os.getenv("ASYNC_IDLE_MAX", "8.0"))
JITTER = float(os.getenv("ASYNC_JITTER", "0.25"))


def _sleep(base: float) -> None:
    t = max(0.0, base + random.uniform(-JITTER, JITTER))
    time.sleep(t)


def _run_user_chain(user_id: int) -> int:
    """
    Po dokončení 1 jobu: spracuj ďalšie queued joby toho istého usera (max N).
    """
    ran = 0
    lim = max(1, min(int(CHAIN_LIMIT or 10), 25))

    for _ in range(lim):
        locked = db_pick_next_queued_job_for_user(
            user_id=int(user_id),
            worker_id=WORKER_ID,
            service=True,
            user_jwt=None,
            max_scan=5,
        )
        if not locked:
            break

        out = service_execute_job(locked)
        if out.get("error"):
            print(f"[ASYNC-WORKER] chained job failed id={locked.get('id')} err={out.get('error')}")
        ran += 1

    return ran


def main() -> None:
    idle = IDLE_MIN
    print(f"[ASYNC-WORKER] started worker_id={WORKER_ID} chain_limit={CHAIN_LIMIT}")

    while True:
        locked = db_pick_next_queued_job_global(
            worker_id=WORKER_ID,
            service=True,
            user_jwt=None,
            max_scan=10,
        )

        if not locked:
            _sleep(idle)
            idle = min(IDLE_MAX, idle * 1.6)
            continue

        idle = IDLE_MIN

        try:
            user_id = int(locked.get("user_id") or 0)
        except Exception:
            user_id = 0

        out = service_execute_job(locked)
        if out.get("error"):
            print(f"[ASYNC-WORKER] job failed id={locked.get('id')} user_id={user_id} err={out.get('error')}")

        if user_id:
            ran = _run_user_chain(user_id)
            if ran:
                print(f"[ASYNC-WORKER] chained {ran} jobs for user_id={user_id}")


if __name__ == "__main__":
    main()