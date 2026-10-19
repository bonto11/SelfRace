"""
Pravidlo pre AI: ako user robí externý šport (`role`) a kedy smie AI
navrhnúť externú aktivitu vynechať. Spoločné pre hodnotenie týždňa,
týždenný aj denný plán, aby si moduly neprotirečili.

PREČO: hobby futbal s kamošmi a klubový tréning 2× týždenne + zápas sú
úplne iná záťaž. Pri klubovom športe je ten šport hlavná záťaž a beh či
posilňovňa ho majú podporiť, nie s ním súperiť.
"""


def build_external_role_rule() -> str:
    return (
        "- EXTERNAL SPORT ROLE ('role' on a sport external activity; missing = hobby):\n"
        "  - hobby: recreational sport with friends. Real load, but not competition. Call it by its "
        "title or plainly ('futbal', 'futbal s kamošmi') - never 'match', 'game', 'zápas' or "
        "'tréning'.\n"
        "  - training: club/team training. It IS training volume of that sport and a hard-ish day "
        "(sprints, changes of direction, contact). Call it a training of that sport.\n"
        "  - match: competition - the key hard day of the week. Day before: rest or easy only, no "
        "heavy legs, no quality run. Day after: recovery only.\n"
        "  - With training/match the team sport is the athlete's MAIN load. Running and strength must "
        "support it, not compete with it: running = easy aerobic base or short speed work, never a "
        "hard run the day before a match; strength = 1-2 short sessions, injury prevention first "
        "(hamstrings incl. Nordic curls, adductors, calves, core, single-leg work), heavy legs at least "
        "2 days before a match. Keep the total weekly load realistic - do not stack a full running plan "
        "on top of club practice.\n"
        "- SKIPPING EXTERNAL ACTIVITIES: never suggest skipping or moving a non-sport event (wedding, "
        "visit, family, work, travel) - plan around it. A sport activity may be suggested to skip or "
        "soften ONLY when truly necessary (the athlete's goal race within 2 days, acute illness or "
        "injury, clear overreaching) - say why, as an option, not an order. A club match is never "
        "suggested to skip except for acute illness or injury. Never assume the athlete takes that "
        "advice: plan and evaluate the rest of the week as if the activity happens as set (title, "
        "intensity, note), until the athlete changes it themselves.\n"
    )
