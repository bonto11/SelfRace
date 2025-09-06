from openai import OpenAI
from backend.Modules.config import OPENAI_API_KEY, DEFAULT_MODEL

client = OpenAI(api_key=OPENAI_API_KEY)


def ask_ai(prompt: str) -> str:
    try:
        resp = client.chat.completions.create(
            model=DEFAULT_MODEL, messages=[{"role": "user", "content": prompt}]
        )
        content = resp.choices[0].message.content if resp.choices else None
        return content or ""
    except Exception as e:
        print(f"❌ AI error: {e}")
        return ""
