from datetime import datetime
from services.sms import send_sms


def emergency_alert(payload=None):
    payload = payload or {}

    phone = payload.get("phone", "+359883333419") # test number, needs to be connected with frontend

    message = payload.get(
        "message",
        f"""🚨 EMERGENCY ALERT
User needs immediate assistance!

Time: {datetime.now().strftime("%H:%M:%S")}
""",
    )

    result = send_sms(phone, message)

    if result["success"]:
        return {
            "status": "executed",
            "action": "emergency",
            "success": True,
            "message": "Emergency SMS sent",
            "data": result,
        }

    return {
        "status": "error",
        "action": "emergency",
        "success": False,
        "message": result["message"],
        "error": result.get("error"),
    }

