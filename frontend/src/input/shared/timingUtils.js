export const DIRECTIONS = {
	LEFT: "LEFT",
	RIGHT: "RIGHT",
	UP: "UP",
	DOWN: "DOWN",
	CENTER: "CENTER",
};

export function normalizeDirectionLabel(label) {
	const normalized = String(label || "").toUpperCase();
	if (normalized === "CLOSED") return DIRECTIONS.CENTER;
	if (Object.prototype.hasOwnProperty.call(DIRECTIONS, normalized)) {
		return DIRECTIONS[normalized];
	}
	return null;
}

export function createFastDirectionalState() {
	return {
		stableDirection: DIRECTIONS.CENTER,
		candidateDirection: DIRECTIONS.CENTER,
		candidateSince: 0,
		lastCommandTime: 0,
		navLock: null,
		selectionStartTime: null,
		selectionTriggered: false,
		briefSelectionArmed: false,
	};
}

export function runFastDirectionalStateMachine(direction, now, prevState, config = {}) {
	const state = {
		...createFastDirectionalState(),
		...prevState,
	};

	const switchDebounceMs = Math.max(0, Number(config.switchDebounceMs ?? 30));
	const commandDelay = Math.max(0, Number(config.commandDelay ?? 120));
	const repeatEnabled = !!config.repeatEnabled;
	const repeatDelay = Math.max(30, Number(config.repeatDelay ?? 120));
	const selectionMethod = normalizeDirectionLabel(config.selectionMethod) || DIRECTIONS.RIGHT;
	const selectionDwell = Math.max(120, Number(config.selectionDwell ?? 650));
	const selectionReleaseMin = Math.max(0, Number(config.selectionReleaseMin ?? 80));

	let command = null;
	let reason = "NO_COMMAND";

	const nextDirection = normalizeDirectionLabel(direction) || DIRECTIONS.CENTER;

	if (nextDirection !== state.candidateDirection) {
		state.candidateDirection = nextDirection;
		state.candidateSince = now;
	}

	if (
		nextDirection !== state.stableDirection &&
		now - (state.candidateSince || now) >= switchDebounceMs
	) {
		state.stableDirection = nextDirection;
	}

	const stableDirection = state.stableDirection;

	if (stableDirection === selectionMethod) {
		if (state.selectionStartTime == null) {
			state.selectionStartTime = now;
			state.selectionTriggered = false;
			state.briefSelectionArmed = false;
		}
	} else if (state.selectionStartTime != null) {
		const heldMs = now - state.selectionStartTime;
		state.briefSelectionArmed =
			selectionMethod !== DIRECTIONS.CENTER &&
			heldMs >= selectionReleaseMin &&
			heldMs < selectionDwell;
		state.selectionStartTime = null;
		state.selectionTriggered = false;
	}

	if (stableDirection === selectionMethod) {
		const canSelect =
			state.selectionStartTime != null &&
			!state.selectionTriggered &&
			now - state.selectionStartTime >= selectionDwell;
		if (canSelect && now - state.lastCommandTime >= commandDelay) {
			command = "FORWARD";
			state.selectionTriggered = true;
			state.lastCommandTime = now;
			reason = "SELECTION_DWELL";
		}
	}

	if (!command && stableDirection === DIRECTIONS.CENTER) {
		state.navLock = null;
		if (state.briefSelectionArmed && selectionMethod !== DIRECTIONS.CENTER) {
			if (now - state.lastCommandTime >= commandDelay) {
				command = selectionMethod;
				state.lastCommandTime = now;
				state.navLock = selectionMethod;
				reason = "RELEASE_TO_MOVE";
			}
			state.briefSelectionArmed = false;
		}
	}

	if (!command && stableDirection !== DIRECTIONS.CENTER && stableDirection !== selectionMethod) {
		if (now - state.lastCommandTime < commandDelay) {
			reason = "COMMAND_DELAY";
		} else if (!repeatEnabled && state.navLock === stableDirection) {
			reason = "NAV_LOCKED";
		} else if (
			repeatEnabled &&
			state.navLock === stableDirection &&
			now - state.lastCommandTime < repeatDelay
		) {
			reason = "REPEAT_DELAY";
		} else {
			command = stableDirection;
			state.lastCommandTime = now;
			state.navLock = stableDirection;
			reason = "EMIT";
		}
	}

	if (!command && reason === "NO_COMMAND") {
		reason = stableDirection === DIRECTIONS.CENTER ? "CENTER" : "HOLDING";
	}

	return {
		command,
		newState: state,
		debug: {
			direction: stableDirection,
			reason,
		},
	};
}
