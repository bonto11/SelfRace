# Services/progress_narrative.py
def _avg(nums): return sum(nums) / len(nums) if nums else 0.0
def _safe(v, d=0.0):
    try:
        return float(v)
    except Exception:
        return d

def build_progress_narrative(ctx: dict, weeks: int) -> dict:
    weekly = (ctx.get("weekly") or {}).get("weeks") or []
    recovery = ctx.get("recovery") or []
    notes = ctx.get("notes") or []

    last = weekly[-1] if weekly else None
    prev = weekly[-weeks:-1] if len(weekly) > 1 else []
    km_last = _safe(last.get("km_run")) if last else 0.0
    tr_last = _safe(last.get("trimp")) if last else 0.0
    km_prev = _avg([_safe(w.get("km_run")) for w in prev])
    tr_prev = _avg([_safe(w.get("trimp")) for w in prev])

    rec_sorted = list(reversed(recovery))
    last7, prev14 = rec_sorted[:7], rec_sorted[7:21]
    hrv7 = _avg([_safe(r.get("HRV_avg_ms")) for r in last7]); rhr7 = _avg([_safe(r.get("RHR_bpm")) for r in last7])
    hrv14 = _avg([_safe(r.get("HRV_avg_ms")) for r in prev14]); rhr14 = _avg([_safe(r.get("RHR_bpm")) for r in prev14])

    def sign(x): return "↑" if x > 1e-6 else ("↓" if x < -1e-6 else "≈")

    period = []
    if prev:
        period.append(f"Za posledných {min(len(prev)+1, weeks)} týždňov držíš beh ~{km_prev:.1f} km/týž. a TRIMP ~{tr_prev:.0f}.")
    if hrv14 or rhr14:
        period.append(f"Recovery trend: HRV ~{hrv14:.0f} ms, RHR ~{rhr14:.0f} bpm (predposledné 2 týždne).")

    last_week = [f"Minulý týždeň: beh {km_last:.1f} km ({sign(km_last-km_prev)} {km_last-km_prev:+.1f} vs. priemer), TRIMP {tr_last:.0f} ({sign(tr_last-tr_prev)} {tr_last-tr_prev:+.0f})."]
    if hrv7 or rhr7:
        last_week.append(f"HRV {hrv7:.0f} ms ({hrv7-hrv14:+.0f} vs. predch.), RHR {rhr7:.1f} bpm ({rhr7-rhr14:+.1f}).")

    txt = " ".join([str(n.get("feeling") or "") for n in (notes or [])[-20:]]).lower()
    flags = []
    if any(k in txt for k in ["dovolen", "holiday", "vacation"]): flags.append("dovolenka")
    if any(k in txt for k in ["sick", "ill", "chor", "virus", "flu", "covid"]): flags.append("choroba")
    if any(k in txt for k in ["race", "prete", "marat", "10k", "half"]): flags.append("preteky")
    if flags: last_week.append("Poznámky naznačujú: " + ", ".join(flags) + ".")

    return {
        "period_summary": " ".join(period) or None,
        "last_week_summary": " ".join(last_week) or None
    }