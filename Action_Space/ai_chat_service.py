import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def get_ai_reply(user_message: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a helpful assistant for a person with communication "
                    "and motor impairments. Keep responses clear, supportive, "
                    "and concise."
                ),
            },
            {"role": "user", "content": user_message},
        ],
    )

    return response.choices[0].message.content or "I could not generate a reply."