
const DIRECTIONS = {
	LEFT: "LEFT",
	RIGHT: "RIGHT",
	UP: "UP",
	DOWN: "DOWN",
	CENTER: "CENTER",
};

const DEFAULTS = {
	cnnMinConfidence: 0.45,
	commandDelay: 120,
	selectionMethod: "DOWN",
	selectionDwell: 650,
	selectionReleaseMin: 80,
	centerSelectEnabled: false,
	centerSelectMinConfidence: 0.85,
};

function normalizeDirection(name) {
	const normalized = String(name || "").trim().toUpperCase();
	return normalized || DIRECTIONS.CENTER;
}

function normalizeNumber(value, fallback, min = Number.NEGATIVE_INFINITY) {
	const next = Number(value);
	if (!Number.isFinite(next)) return fallback;
	return Math.max(min, next);
}

function createInitialState() {
	return {
		lastCommandTime: 0,
		selectionStartTime: null,
		selectionTriggered: false,
		briefSelectionArmed: false,
		pendingNavDirection: null,
		navLock: null,
	};
}

function normalizeConfig(config = {}) {
	return {
		cnnMinConfidence: normalizeNumber(
			config?.cnnMinConfidence,
			DEFAULTS.cnnMinConfidence,
			0
		),
		commandDelay: normalizeNumber(config?.commandDelay, DEFAULTS.commandDelay, 0),
		selectionMethod: normalizeDirection(config?.selectionMethod || DEFAULTS.selectionMethod),
		selectionDwell: normalizeNumber(
			config?.selectionDwell,
			DEFAULTS.selectionDwell,
			0
		),
		selectionReleaseMin: normalizeNumber(
			config?.selectionReleaseMin,
			DEFAULTS.selectionReleaseMin,
			0
		),
		centerSelectEnabled: Boolean(config?.centerSelectEnabled),
		centerSelectMinConfidence: normalizeNumber(
			config?.centerSelectMinConfidence,
			DEFAULTS.centerSelectMinConfidence,
			0
		),
	};
}

function reduceCnnInput(input, state, config) {
	const now = Number.isFinite(input?.timestamp) ? Number(input.timestamp) : Date.now();
	const confidence = Number.isFinite(Number(input?.confidence)) ? Number(input.confidence) : 0;

	const requestedDirection = normalizeDirection(input?.name);
	const isValid = confidence >= config.cnnMinConfidence;
	const direction = isValid ? requestedDirection : DIRECTIONS.CENTER;

	const nextState = {
		...createInitialState(),
		...(state || {}),
	};

	const commandDelayPassed = now - nextState.lastCommandTime >= config.commandDelay;

	const buildDebug = (overrides = {}) => ({
		direction,
		confidence,
		isStable: true,
		stableFrames: 0,
		selectionMethod: config.selectionMethod,
		selectionStartMs: nextState.selectionStartTime || 0,
		selectionDwell: config.selectionDwell,
		progress: 0,
		...overrides,
	});

	if (direction === config.selectionMethod) {
		if (nextState.selectionStartTime == null) {
			nextState.selectionStartTime = now;
			nextState.selectionTriggered = false;
		}

		const heldMs = now - nextState.selectionStartTime;
		const selectionDwell = config.selectionDwell;
		const progress = Math.max(0, Math.min(1, heldMs / Math.max(selectionDwell, 1)));

		if (
			!nextState.selectionTriggered &&
			heldMs >= selectionDwell &&
			commandDelayPassed
		) {
			nextState.selectionTriggered = true;
			nextState.lastCommandTime = now;
			nextState.navLock = config.selectionMethod;
			nextState.pendingNavDirection = null;

			return {
				command: "FORWARD",
				newState: nextState,
				debug: buildDebug({
					selectionStartMs: nextState.selectionStartTime || 0,
					progress,
					reason: "SELECTION_DWELL",
				}),
			};
		}

		return {
			command: null,
			newState: nextState,
			debug: buildDebug({
				selectionStartMs: nextState.selectionStartTime || 0,
				progress,
				reason: "SELECTION_HOLD",
			}),
		};
	}

	let command = null;
	let reason = "HOLDING";

	if (direction === DIRECTIONS.CENTER) {
		if (nextState.selectionStartTime != null) {
			const heldMs = now - nextState.selectionStartTime;
			nextState.briefSelectionArmed =
				heldMs >= config.selectionReleaseMin && heldMs < config.selectionDwell;
		} else {
			nextState.briefSelectionArmed = false;
		}

		if (nextState.briefSelectionArmed && commandDelayPassed) {
			command = config.selectionMethod;
			nextState.lastCommandTime = now;
			nextState.navLock = config.selectionMethod;
			nextState.pendingNavDirection = config.selectionMethod;
			nextState.briefSelectionArmed = false;
			reason = "RELEASE_TO_MOVE";
		}

		nextState.navLock = null;
		nextState.selectionStartTime = null;
		nextState.selectionTriggered = false;
		nextState.pendingNavDirection = null;
		nextState.briefSelectionArmed = false;

		if (!config.centerSelectEnabled) {
			if (!command) reason = isValid ? "CENTER" : "LOW_CONFIDENCE";
		} else if (confidence < config.centerSelectMinConfidence) {
			if (!command) reason = "CENTER_LOW_CONFIDENCE";
		} else if (!commandDelayPassed) {
			if (!command) reason = "COMMAND_DELAY";
		} else {
			if (!command) {
				command = "FORWARD";
				nextState.lastCommandTime = now;
				reason = "CENTER_SELECT";
			}
		}
	} else if (!commandDelayPassed) {
		nextState.selectionStartTime = null;
		nextState.selectionTriggered = false;
		nextState.briefSelectionArmed = false;
		nextState.pendingNavDirection = null;
		reason = "COMMAND_DELAY";
	} else if (nextState.navLock === direction && direction !== config.selectionMethod) {
		nextState.selectionStartTime = null;
		nextState.selectionTriggered = false;
		nextState.briefSelectionArmed = false;
		nextState.pendingNavDirection = null;
		return {
			command: null,
			newState: nextState,
			debug: buildDebug({
				reason: "NAV_LOCKED",
			}),
		};
	} else {
		nextState.selectionStartTime = null;
		nextState.selectionTriggered = false;
		nextState.briefSelectionArmed = false;
		nextState.pendingNavDirection = null;
		command = direction;
		nextState.navLock = direction;
		nextState.lastCommandTime = now;
		reason = "EMIT";
	}

	return {
		command,
		newState: nextState,
		debug: buildDebug({
			reason,
		}),
	};
}

export function createCnnProcessor(config = {}) {
	const normalizedConfig = normalizeConfig(config);
	let state = createInitialState();

	return {
		process(input) {
			const result = reduceCnnInput(input, state, normalizedConfig);
			state = result.newState;
			return {
				command: result.command,
				debug: result.debug,
			};
		},
	};
}

export function processCNN(input, state, config) {
	const normalizedConfig = normalizeConfig(config);
	return reduceCnnInput(input, state, normalizedConfig);
}

export default createCnnProcessor;
