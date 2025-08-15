import os
from flask import Flask
from dotenv import load_dotenv

load_dotenv()  # načíta premenné zo súboru .env

app = Flask(__name__)

@app.route('/')
def index():
    client_id = os.getenv("STRAVA_CLIENT_ID")
    return f"Strava Client ID je: {client_id}"

if __name__ == '__main__':
    app.run(debug=True, port=5000)