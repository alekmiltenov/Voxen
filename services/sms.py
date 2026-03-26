from twilio.rest import Client
from dotenv import load_dotenv
import os

load_dotenv()
ACCOUNT_SID = os.getenv("ACCOUNT_SID")
AUTH_TOKEN = os.getenv("AUTH_TOKEN")
MESSAGING_SERVICE_SID = os.getenv("MESSAGING_SERVICE_SID")

client = Client(ACCOUNT_SID, AUTH_TOKEN)


def send_sms(to_phone: str, message: str):
    try:
        msg = client.messages.create(
            messaging_service_sid=MESSAGING_SERVICE_SID,
            body=message,
            to=to_phone,
        )

        return {
            "success": True,
            "status": "sent",
            "sid": msg.sid,
            "to": to_phone,
            "message": "SMS sent successfully",
        }

    except Exception as e:
        return {
            "success": False,
            "status": "error",
            "error": str(e),
            "message": "Failed to send SMS",
        }