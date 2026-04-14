import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import InputManager from "../input/manager/InputManager";
import { useEyeTracking } from "../input/eyes/useEyeTracking";

const BACKEND_SERVER = "http://localhost:8000";
const HEAD_SERVER = BACKEND_SERVER;

const getInitialCenterBuffer = () => {
	try {
		const saved = localStorage.getItem("centerBuffer");
		return saved ? parseFloat(saved) : 0.05;
	} catch {
		return 0.05;
	}
};

const getInitialCommandDelay = () => {
	try {
		const saved = localStorage.getItem("eyeCommandDelay");
		return saved ? parseFloat(saved) : 120;
	} catch {
		return 120;
	}
};

const getInitialYBias = () => {
	try {
		const saved = localStorage.getItem("eyeYBias");
		return saved ? parseFloat(saved) : 0;
	} catch {
		return 0;
	}
};

const getInitialEyeHoldRepeatEnabled = () => {
	try {
		return localStorage.getItem("eyeHoldRepeatEnabled") === "1";
	} catch {
		return false;
	}
};

const getInitialEyeHoldRepeatDelay = () => {
	try {
		const saved = localStorage.getItem("eyeHoldRepeatDelay");
		return saved ? parseFloat(saved) : 180;
	} catch {
		return 180;
	}
};

const getSelectionMethod = () => {
	try {
		const saved = (localStorage.getItem("eyeSelectionMethod") || "right").toLowerCase();
		if (saved === "closed") return "center";
		if (["left", "right", "up", "down", "center"].includes(saved)) return saved;
		return "right";
	} catch {
		return "right";
	}
};

const getSelectionDwell = () => {
	try {
		const saved = localStorage.getItem("eyeSelectionDwell");
		return saved ? parseInt(saved, 10) : 650;
	} catch {
		return 650;
	}
};

const getHeadSelectionMethod = () => {
	try {
		const saved = String(localStorage.getItem("headSelectionMethod") || "down").toLowerCase();
		if (saved === "forward" || saved === "back") return "DOWN";
		if (["left", "right", "up", "down", "center"].includes(saved)) return saved.toUpperCase();
		return "DOWN";
	} catch {
		return "DOWN";
	}
};

const getInitialCenterSelectMinConfidence = () => {
	try {
		const saved = parseFloat(localStorage.getItem("cnnCenterSelectMinConfidence") || "");
		return Number.isFinite(saved) ? Math.max(0.55, Math.min(0.99, saved)) : 0.85;
	} catch {
		return 0.85;
	}
};

const getInitialCenterSelectNoiseDelta = () => {
	try {
		const saved = parseFloat(localStorage.getItem("cnnCenterSelectNoiseDelta") || "");
		return Number.isFinite(saved) ? Math.max(0.01, Math.min(0.2, saved)) : 0.06;
	} catch {
		return 0.06;
	}
};

const InputControlContext = createContext(null);

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const normalizeSelectionMethod = (value, fallback = "DOWN") => {
	const normalized = String(value || "").toUpperCase();
	if (normalized === "FORWARD" || normalized === "BACK") return "DOWN";
	if (["LEFT", "RIGHT", "UP", "DOWN", "CENTER"].includes(normalized)) return normalized;
	return fallback;
};

const buildDefaultControlConfig = () => ({
	eyes: {
		selectionMethod: getSelectionMethod(),
		selectionDwell: getSelectionDwell(),
		selectionReleaseMin: 80,
		commandDelay: getInitialCommandDelay(),
		repeatEnabled: getInitialEyeHoldRepeatEnabled(),
		repeatDelay: getInitialEyeHoldRepeatDelay(),
		debounceMs: 200,
		minStableFrames: 2,
		directionDebounceMs: 80,
		center: { x: 0, y: 0 },
		yBias: getInitialYBias(),
		centerBuffer: getInitialCenterBuffer(),
	},
	cnn: {
		cnnMinConfidence: 0.45,
		minStableFrames: 2,
		commandDelay: 120,
		centerSelectEnabled: false,
		centerSelectMinConfidence: getInitialCenterSelectMinConfidence(),
		centerSelectMinStableFrames: 2,
		centerSelectNoiseDelta: getInitialCenterSelectNoiseDelta(),
	},
	head: {
		selectionMethod: getHeadSelectionMethod(),
		selectionDwell: 650,
		selectionReleaseMin: 80,
		commandDelay: 120,
		repeatEnabled: false,
		repeatDelay: 180,
		debounceMs: 200,
		minStableFrames: 2,
		directionDebounceMs: 80,
	},
});

const mergeControlConfig = (defaults, saved) => ({
	...defaults,
	eyes: {
		...defaults.eyes,
		...(isPlainObject(saved?.eyes) ? saved.eyes : {}),
	},
	cnn: {
		...defaults.cnn,
		...(isPlainObject(saved?.cnn) ? saved.cnn : {}),
	},
	head: {
		...defaults.head,
		...(isPlainObject(saved?.head) ? saved.head : {}),
		selectionMethod: normalizeSelectionMethod(saved?.head?.selectionMethod, defaults.head.selectionMethod),
	},
});

export function InputControlProvider({ children }) {
	const [mode, setMode] = useState(() => {
		try {
			return localStorage.getItem("controlMode") || "off";
		} catch {
			return "off";
		}
	});

	const enabled = mode !== "off";

	const [holdDuration, setHoldDuration] = useState(500);
	const [sensorSettings, setSensorSettings] = useState({
		alpha: 0.5,
		threshold: 1.5,
		deadzone: 1.0,
	});

	const [eyeDebug, setEyeDebug] = useState(null);
	const [headDebug, setHeadDebug] = useState(null);

	const [cnnReady, setCnnReady] = useState(false);
	const [gazeLabel, setGazeLabel] = useState("—");
	const [cnnDebug, setCnnDebug] = useState(null);
	const [controlConfig, setControlConfig] = useState(() => {
		const defaults = buildDefaultControlConfig();
		try {
			const saved = localStorage.getItem("controlConfig");
			if (!saved) return defaults;
			return mergeControlConfig(defaults, JSON.parse(saved));
		} catch {
			return defaults;
		}
	});

	const modeRef = useRef(mode);
	const handlerRef = useRef(null);
	const autoCenterDoneRef = useRef(false);

	const centerRef = useRef(controlConfig.eyes.center || { x: 0, y: 0 });
	const eyesConfigRef = useRef(controlConfig.eyes);
	const cnnConfigRef = useRef(controlConfig.cnn);
	const headConfigRef = useRef(controlConfig.head);

	const dispatch = useCallback((cmd) => {
		if (modeRef.current === "off") return;
		if (!cmd || typeof handlerRef.current !== "function") return;
		handlerRef.current(cmd);
	}, []);

	const inputManagerRef = useRef(null);
	if (!inputManagerRef.current) {
		inputManagerRef.current = new InputManager(dispatch, modeRef.current);
	}

	const updateEyesConfig = useCallback((partial) => {
		setControlConfig((prev) => ({
			...prev,
			eyes: {
				...prev.eyes,
				...partial,
			},
		}));
	}, []);

	const updateCnnConfig = useCallback((partial) => {
		setControlConfig((prev) => ({
			...prev,
			cnn: {
				...prev.cnn,
				...partial,
			},
		}));
	}, []);

	const updateHeadConfig = useCallback((partial) => {
		setControlConfig((prev) => ({
			...prev,
			head: {
				...prev.head,
				...partial,
				selectionMethod: normalizeSelectionMethod(partial?.selectionMethod ?? prev.head.selectionMethod),
			},
		}));
	}, []);

	useEffect(() => {
		modeRef.current = mode;
		inputManagerRef.current?.setMode(mode);
		try {
			localStorage.setItem("controlMode", mode);
		} catch {
			// ignore storage errors
		}
	}, [mode]);

	useEffect(() => {
		const id = setTimeout(() => {
			try {
				localStorage.setItem("controlConfig", JSON.stringify(controlConfig));
			} catch {
				// ignore storage errors
			}
		}, 200);

		return () => clearTimeout(id);
	}, [controlConfig]);

	useEffect(() => {
		eyesConfigRef.current = controlConfig.eyes;
		centerRef.current = controlConfig.eyes.center || centerRef.current;
	}, [controlConfig.eyes]);

	useEffect(() => {
		cnnConfigRef.current = controlConfig.cnn;
	}, [controlConfig.cnn]);

	useEffect(() => {
		headConfigRef.current = controlConfig.head;
	}, [controlConfig.head]);

	const register = useCallback((fn) => {
		handlerRef.current = fn;
	}, []);

	const unregister = useCallback(() => {
		handlerRef.current = null;
	}, []);

	const setControlMode = useCallback((newMode) => {
		setMode(newMode);
	}, []);

	const setYBias = useCallback((value) => {
		const next = Number(value) || 0;
		updateEyesConfig({ yBias: next });
		try {
			localStorage.setItem("eyeYBias", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setCenterBuffer = useCallback((value) => {
		const next = Number(value) || 0;
		updateEyesConfig({ centerBuffer: next });
		try {
			localStorage.setItem("centerBuffer", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setCommandDelay = useCallback((value) => {
		const next = Number(value) || 0;
		updateEyesConfig({ commandDelay: next });
		try {
			localStorage.setItem("eyeCommandDelay", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setEyeHoldRepeatEnabled = useCallback((enabledValue) => {
		const next = !!enabledValue;
		updateEyesConfig({ repeatEnabled: next });
		try {
			localStorage.setItem("eyeHoldRepeatEnabled", next ? "1" : "0");
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setEyeHoldRepeatDelay = useCallback((value) => {
		const next = Number(value) || 180;
		updateEyesConfig({ repeatDelay: next });
		try {
			localStorage.setItem("eyeHoldRepeatDelay", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateEyesConfig]);

	const setCenterSelectMinConfidence = useCallback((value) => {
		const next = Math.max(0.55, Math.min(0.99, Number(value) || 0.85));
		updateCnnConfig({ centerSelectMinConfidence: next });
		try {
			localStorage.setItem("cnnCenterSelectMinConfidence", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateCnnConfig]);

	const setCenterSelectNoiseDelta = useCallback((value) => {
		const next = Math.max(0.01, Math.min(0.2, Number(value) || 0.06));
		updateCnnConfig({ centerSelectNoiseDelta: next });
		try {
			localStorage.setItem("cnnCenterSelectNoiseDelta", String(next));
		} catch {
			// ignore storage errors
		}
	}, [updateCnnConfig]);

	const { eyeReady, eyeCentered, eyeTracking, recenterEyes } = useEyeTracking({
		mode,
		inputManagerRef,
		eyesConfigRef,
		updateEyesConfig,
		setEyeDebug,
		centerRef,
		autoCenterDoneRef,
	});

	useEffect(() => {
		if (mode !== "cnn") {
			setCnnReady(false);
			setGazeLabel("—");
			setCnnDebug(null);
			return;
		}

		let ws;
		let reconnectTimer;

		const connectWs = () => {
			const wsUrl = "ws://localhost:8000/ws/predict";
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				setCnnReady(true);
			};

			ws.onmessage = (event) => {
				try {
					const cnnConfig = cnnConfigRef.current;
					const data = JSON.parse(event.data);
					const name = String(data?.name || "").toUpperCase();
					const confidence = Number(data?.confidence);
					if (name) {
						const confidenceText = Number.isFinite(confidence) ? confidence.toFixed(2) : "0.00";
						setGazeLabel(`${name} (${confidenceText})`);
					}

					const result = inputManagerRef.current?.handleCNN(
						{
							name: data.name,
							confidence: data.confidence,
							timestamp: Date.now(),
						},
						cnnConfig
					);
					const processorDebug = result?.debug || {};
					const fallbackSelectionMethod = String(cnnConfig?.selectionMethod || "RIGHT").toUpperCase();

					setCnnDebug({
						...processorDebug,
						direction: String(processorDebug.direction || "NONE").toUpperCase(),
						confidence: Number.isFinite(Number(processorDebug.confidence)) ? Number(processorDebug.confidence) : 0,
						isStable: Boolean(processorDebug.isStable),
						stable: Boolean(processorDebug.isStable),
						stableFrames: Number(processorDebug.stableFrames || 0),
						reason: String(processorDebug.reason || "HOLDING"),
						selectionMethod: String(processorDebug.selectionMethod || fallbackSelectionMethod).toUpperCase(),
						selectionStartMs: Math.max(0, Number(processorDebug.selectionStartMs || 0)),
						selectionDwell: Math.max(0, Number(processorDebug.selectionDwell || cnnConfig?.selectionDwell || 0)),
						progress: Math.max(0, Math.min(1, Number(processorDebug.progress || 0))),
					});
				} catch {
					// ignore malformed frame
				}
			};

			ws.onerror = () => {
				setCnnReady(false);
			};

			ws.onclose = () => {
				setCnnReady(false);
				setGazeLabel("—");
				if (modeRef.current === "cnn") {
					reconnectTimer = setTimeout(connectWs, 2000);
				}
			};
		};

		connectWs();

		return () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (ws) ws.close();
		};
	}, [mode]);

	useEffect(() => {
		if (mode !== "head") return;

		if (window.location.hostname !== "localhost") {
			fetch(`${HEAD_SERVER}/head/settings`)
				.then((response) => response.json())
				.then((settings) => {
					setSensorSettings({
						alpha: settings.alpha ?? 0.5,
						threshold: settings.threshold ?? 1.5,
						deadzone: settings.deadzone ?? 1.0,
					});
				})
				.catch(() => {
					// keep defaults
				});
		}

		let ws;
		let reconnectTimer;

		const connect = () => {
			const wsUrl = `${BACKEND_SERVER.replace("http", "ws")}/ws/head`;

			ws = new WebSocket(wsUrl);

			ws.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					console.log("[HEAD FRONTEND]", data);
					const command = data?.command;
					const result = inputManagerRef.current?.handleHead(
						{
							command,
							confidence: data?.confidence,
							timestamp: Date.now(),
							debug: data?.debug,
						},
						headConfigRef.current
					);

					setHeadDebug({
						...result?.debug,
						direction: result?.debug?.direction || command || "NONE",
						confidence: data?.confidence ?? 0,
					});
				} catch {
					// ignore malformed frame
				}
			};

			ws.onclose = () => {
				if (modeRef.current === "head") {
					reconnectTimer = setTimeout(connect, 2000);
				}
			};
		};

		connect();

		return () => {
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (ws) ws.close();
		};
	}, [mode]);

	const updateSensorSettings = useCallback((newSettings) => {
		setSensorSettings(newSettings);
		if (window.location.hostname !== "localhost") {
			fetch(`${HEAD_SERVER}/head/settings`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(newSettings),
			}).catch(() => {
				// ignore update errors
			});
		}
	}, []);

	return (
		<InputControlContext.Provider
			value={{
				mode,
				setControlMode,
				enabled,
				controlConfig,
				updateEyesConfig,
				updateCnnConfig,
				updateHeadConfig,
				register,
				unregister,
				dispatch,
				holdDuration,
				setHoldDuration,
				sensorSettings,
				updateSensorSettings,
				eyeReady,
				eyeCentered,
				eyeTracking,
				eyeDebug,
				headDebug,
				recenterEyes,
				setYBias,
				setCenterBuffer,
				setCommandDelay,
				eyeHoldRepeatEnabled: !!controlConfig.eyes.repeatEnabled,
				setEyeHoldRepeatEnabled,
				eyeHoldRepeatDelay: Number(controlConfig.eyes.repeatDelay || 0),
				setEyeHoldRepeatDelay,
				cnnReady,
				gazeLabel,
				cnnDebug,
				centerSelectMinConfidence: Number(controlConfig.cnn.centerSelectMinConfidence || 0),
				setCenterSelectMinConfidence,
				centerSelectNoiseDelta: Number(controlConfig.cnn.centerSelectNoiseDelta || 0),
				setCenterSelectNoiseDelta,
			}}
		>
			{children}
		</InputControlContext.Provider>
	);
}

export const useInputControl = () => useContext(InputControlContext);

export const useHeadControl = () => {
	const ctx = useContext(InputControlContext);
	return {
		enabled: ctx.enabled,
		register: ctx.register,
		unregister: ctx.unregister,
		toggle: () => ctx.setControlMode(ctx.mode === "off" ? "head" : "off"),
		holdDuration: ctx.holdDuration,
		setHoldDuration: ctx.setHoldDuration,
		sensorSettings: ctx.sensorSettings,
		updateSensorSettings: ctx.updateSensorSettings,
	};
};
