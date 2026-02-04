from __future__ import annotations

import os
import time
import random

from Routes_DB.async_jobs import (
    db_pick_next_job_global,
    db_pick_next_job_for_user,
)
from Services.async_jobs import service_execute_job

WORKER_ID = os.getenv("ASYNC_WORKER_ID", "worker-1")
CHAIN_LIMIT = int(os.getenv("ASYNC_CHAIN_LIMIT", "10"))

IDLE_MIN = 0.5
IDLE_MAX = 8.0
JITTER = 0.3


def _sleep(t: float):
    time.sleep(max(0.0, t + random.uniform(-JITTER, JITTER)))


def _run_chain(user_id: int):
    for _ in range(CHAIN_LIMIT):
        job = db_pick_next_job_for_user(
            user_id=user_id,
            worker_id=WORKER_ID,
            service=True,
        )
        if not job:
            return
        service_execute_job(job)


def main():
    print(f"[ASYNC-WORKER] started ({WORKER_ID})")
    idle = IDLE_MIN

    while True:
        try:
            job = db_pick_next_job_global(
                worker_id=WORKER_ID,
                service=True,
            )

            if not job:
                _sleep(idle)
                idle = min(IDLE_MAX, idle * 1.5)
                continue

            idle = IDLE_MIN
            user_id = int(job["user_id"])
            print(f"[ASYNC-WORKER] job={job['id']} user={user_id}")

            service_execute_job(job)
            _run_chain(user_id)

        except KeyboardInterrupt:
            print("[ASYNC-WORKER] stopped")
            return
        except Exception as e:
            print("[ASYNC-WORKER] error:", repr(e))
            _sleep(1.0)


if __name__ == "__main__":
    main()