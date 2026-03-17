from google import genai

# Tu vlož svoj reálny kľúč z .env
from Configs.config import GEMINI_API_KEY

def list_my_models():
    print("Pripájam sa na Google API...")
    client = genai.Client(api_key=GEMINI_API_KEY)
    
    print("Dostupné modely pre tvoj Tier 1 účet:")
    print("-" * 40)
    
    for m in client.models.list():
        # OPRAVA: Pridali sme kontrolu, či supported_actions vôbec existuje (nie je None)
        if m.supported_actions and "generateContent" in m.supported_actions:
            print(f"- {m.name}")

if __name__ == "__main__":
    list_my_models()