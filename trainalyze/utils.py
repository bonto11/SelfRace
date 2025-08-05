def format_time(seconds):
    mins, secs = divmod(seconds, 60)
    return f"{mins}:{secs:02d}"