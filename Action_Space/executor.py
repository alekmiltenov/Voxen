from actions import call_caregiver, emergency_alert, ai_chat, turn_lights_on

ACTION_MAP = {
    1: call_caregiver,
    2: emergency_alert,
    3: ai_chat,
    4: turn_lights_on,
}

def execute_action(action_number: int):
    action_function = ACTION_MAP.get(action_number)

    if action_function is None:
        return {"status": "error", "message": "Invalid action"}

    return action_function()