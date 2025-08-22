from flask import Flask
from Modules.API.Strava.auth import register_exchange_token_route, authorize_user

app = Flask(__name__)
register_exchange_token_route(app)

if __name__ == "__main__":
    print("🌐 Spúšťam OAuth server na http://localhost:5000 ...")
    # 1) otvorí Strava login v prehliadači
    authorize_user()
    # 2) beží lokálny callback /exchange_token, ktorý uloží tokens.json
    app.run(port=5000)
