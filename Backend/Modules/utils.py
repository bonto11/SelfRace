def format_minutes_to_hours_minutes(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    return f"{h}h {m}m" if h else f"{m}m"
