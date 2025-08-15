# Trainalyze

Repository for my application Trainalyze.

Trainalyze/
│
├── venv/ ← virtuálne prostredie (ignorovať)
│
├── trainalyze/ ← zdrojové kódy
│ ├── **init**.py
│ ├── main.py ← hlavný spúšťací skript
│ ├── api_strava.py ← komunikácia so Strava API
│ ├── analysis.py ← analýza dát
│ └── utils.py ← pomocné funkcie
│
├── data/ ← uložené dáta (CSV, JSON…)
│ └── .gitkeep ← aby sa priečinok dal nahrať aj prázdny
│
├── requirements.txt ← zoznam knižníc pre pip
├── .gitignore ← ignorované súbory (venv, cache…)
└── README.md ← popis projektu

1. User Authorization URL: Užívateľ klikne na odkaz, ktorý vedie na Strava prihlasovanie s parametrami (client_id, redirect_uri, response_type=code, scope).
2. Užívateľ sa prihlási a autorizuje prístup.
3. Strava presmeruje užívateľa späť na redirect_uri s code (authorization code).
4. Tvoja aplikácia prijme tento kód a pošle ho na Strava token endpoint, aby ho vymenila za access token.
5. Strava odpovie access tokenom a refresh tokenom.
6. Tvoja aplikácia ich uloží a používa na autorizované volania API.
7. Aplikácia môže volať API na základe access tokenu.
