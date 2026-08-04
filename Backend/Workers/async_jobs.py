# Workers/async_jobs.py (úplne hore, ešte pred imports)

from __future__ import annotations

import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import time
import random

from DB.async_jobs import (
    db_pick_next_queued_job_global,
    db_pick_next_queued_job_for_user,
)
from Services.async_jobs import service_execute_job
from Modules.Supabase.auth import service_ctx 

WORKER_ID = os.getenv("ASYNC_WORKER_ID", "worker-1")
CHAIN_LIMIT = int(os.getenv("ASYNC_CHAIN_LIMIT", "10"))

IDLE_MIN = float(os.getenv("ASYNC_IDLE_MIN", "0.5"))
IDLE_MAX = float(os.getenv("ASYNC_IDLE_MAX", "8.0"))
JITTER = float(os.getenv("ASYNC_JITTER", "0.25"))


def _sleep(base: float) -> None:
    t = max(0.0, base + random.uniform(-JITTER, JITTER))
    time.sleep(t)


def _run_user_chain(ctx, user_id: int) -> int:
    """
    Po dokončení 1 jobu: spracuj ďalšie queued joby toho istého usera (max N).
    Worker je service => ctx=service.
    """
    ran = 0
    lim = max(1, min(int(CHAIN_LIMIT or 10), 25))

    for _ in range(lim):
        locked = db_pick_next_queued_job_for_user(
            ctx=ctx,
            user_id=int(user_id),
            worker_id=WORKER_ID,
            max_scan=5,
        )
        if not locked:
            break

        out = service_execute_job(ctx=ctx, job=locked)
        if out.get("error"):
            print(
                f"[ASYNC-WORKER] chained job failed id={locked.get('id')} err={out.get('error')}"
            )
        ran += 1

    return ran


def main() -> None:
    ctx = service_ctx(f"async_worker:{WORKER_ID}")

    idle = IDLE_MIN
    print(f"[ASYNC-WORKER] started worker_id={WORKER_ID} chain_limit={CHAIN_LIMIT}")

    while True:
        locked = db_pick_next_queued_job_global(
            ctx=ctx,
            worker_id=WORKER_ID,
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

        out = service_execute_job(ctx=ctx, job=locked)
        if out.get("error"):
            print(
                f"[ASYNC-WORKER] job failed id={locked.get('id')} user_id={user_id} err={out.get('error')}"
            )

        if user_id:
            ran = _run_user_chain(ctx, user_id)
            if ran:
                print(f"[ASYNC-WORKER] chained {ran} jobs for user_id={user_id}")


if __name__ == "__main__":
    main()