import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def get_ai_reply(user_message: str) -> str:
    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant for a person with communication "
                    "and motor impairments. Keep responses clear, supportive, "
                    "and concise — ideally 1-2 sentences."
                ),
            },
            {"role": "user", "content": user_message},
        ],
    )
    return response.choices[0].message.content or "I could not generate a reply."
