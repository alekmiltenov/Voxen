import { useCallback, useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { createGazeEstimator } from "./gazeEstimator";
import { createAutoCenter } from "./autoCenter";

const MODEL_URL =
	"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const EYE_PROCESS_INTERVAL_MS = 33;
const EYE_DEBUG_INTERVAL_MS = 120;

export function useEyeTracking({
	mode,
	inputManagerRef,
	eyesConfigRef,
	updateEyesConfig,
	setEyeDebug,
	centerRef,
	autoCenterDoneRef,
	onAutoCenterCompleted,
}) {
	const [eyeReady, setEyeReady] = useState(false);
	const [eyeCentered, setEyeCentered] = useState(false);
	const [eyeTracking, setEyeTracking] = useState(false);

	const videoRef = useRef(null);
	const streamRef = useRef(null);
	const rafRef = useRef(null);
	const faceLandmarkerRef = useRef(null);
	const lastVideoTimeRef = useRef(-1);
	const lastProcessTimeRef = useRef(0);
	const lastDebugTimeRef = useRef(0);
	const eyeTrackingRef = useRef(false);

	const gazeEstimatorRef = useRef(null);
	const autoCenterRef = useRef(null);

	if (!gazeEstimatorRef.current) {
		gazeEstimatorRef.current = createGazeEstimator();
	}

	if (!autoCenterRef.current) {
		autoCenterRef.current = createAutoCenter(24);
	}

	const recenterEyes = useCallback(() => {
		autoCenterDoneRef.current = false;
		autoCenterRef.current?.reset();
		setEyeCentered(false);
	}, [autoCenterDoneRef]);

	useEffect(() => {
		if (mode !== "eyes") {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
			lastProcessTimeRef.current = 0;
			lastDebugTimeRef.current = 0;
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
			streamRef.current = null;
			if (faceLandmarkerRef.current) {
				faceLandmarkerRef.current.close();
			}
			faceLandmarkerRef.current = null;
			setEyeReady(false);
			setEyeCentered(false);
			eyeTrackingRef.current = false;
			setEyeTracking(false);
			setEyeDebug(null);
			autoCenterDoneRef.current = false;
			autoCenterRef.current?.reset();
			return;
		}

		let cancelled = false;

		const startLoop = (video, faceLandmarker) => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;

			const loop = () => {
				if (cancelled || mode !== "eyes") return;

				if (video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
					lastVideoTimeRef.current = video.currentTime;
					const now = Date.now();
					if (now - lastProcessTimeRef.current < EYE_PROCESS_INTERVAL_MS) {
						rafRef.current = requestAnimationFrame(loop);
						return;
					}
					lastProcessTimeRef.current = now;

					const result = faceLandmarker.detectForVideo(video, performance.now());
					const landmarks = result?.faceLandmarks?.[0];

					if (landmarks) {
						if (!eyeTrackingRef.current) {
							eyeTrackingRef.current = true;
							setEyeTracking(true);
						}
						const gaze = gazeEstimatorRef.current.estimate(landmarks);

						if (!autoCenterDoneRef.current) {
							const autoCenterResult = autoCenterRef.current.update(gaze);
							if (autoCenterResult.ready) {
								centerRef.current = autoCenterResult.center;
								updateEyesConfig({ center: autoCenterResult.center });
								autoCenterDoneRef.current = true;
								onAutoCenterCompleted?.();
								setEyeCentered(true);
							}
						}

						if (autoCenterDoneRef.current) {
							const eyesConfig = eyesConfigRef.current;
							const managerResult = inputManagerRef.current?.handleEyes(
								{
									gazeX: gaze.x,
									gazeY: gaze.y,
									timestamp: now,
								},
								eyesConfig
							);

							if (now - lastDebugTimeRef.current > EYE_DEBUG_INTERVAL_MS) {
								lastDebugTimeRef.current = now;
								const processorDebug = managerResult?.debug || {};
								const fallbackSelectionMethod = String(eyesConfig?.selectionMethod || "RIGHT").toUpperCase();
								setEyeDebug({
									gazeX: gaze.x,
									gazeY: gaze.y,
									centerX: centerRef.current.x,
									centerY: centerRef.current.y,
									centerBuffer: Number(eyesConfig?.centerBuffer || 0),
									direction: String(processorDebug.direction || "CENTER").toUpperCase(),
									reason: String(processorDebug.reason || "NONE"),
									state: processorDebug.state,
									progress: Math.max(0, Math.min(1, Number(processorDebug.progress || 0))),
									selectionMethod: String(processorDebug.selectionMethod || fallbackSelectionMethod).toUpperCase(),
									selectionStartMs: Math.max(0, Number(processorDebug.selectionStartMs || 0)),
									selectionDwell: Math.max(0, Number(processorDebug.selectionDwell || eyesConfig?.selectionDwell || 0)),
									stable: Boolean(processorDebug.isStable),
									rawHeldMs: Number(processorDebug.rawHeldMs || 0),
									stableFrames: Number(processorDebug.stableFrames || 0),
									lastCommandAgo: Number(processorDebug.lastCommandAgo || 0),
								});
							}
						}
					} else {
						if (eyeTrackingRef.current) {
							eyeTrackingRef.current = false;
							setEyeTracking(false);
						}
					}
				}

				rafRef.current = requestAnimationFrame(loop);
			};

			loop();
		};

		const init = async () => {
			try {
				const vision = await FilesetResolver.forVisionTasks(
					"https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
				);
				if (cancelled) return;

				const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
					baseOptions: { modelAssetPath: MODEL_URL },
					runningMode: "VIDEO",
					numFaces: 1,
					outputFaceBlendshapes: false,
					outputFacialTransformationMatrixes: false,
				});
				if (cancelled) return;
				faceLandmarkerRef.current = faceLandmarker;

				let video = videoRef.current;
				if (!video) {
					video = document.createElement("video");
					video.setAttribute("playsinline", "");
					video.muted = true;
					video.style.display = "none";
					document.body.appendChild(video);
					videoRef.current = video;
				}

				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: "user",
						width: { ideal: 1280 },
						height: { ideal: 720 },
						frameRate: { ideal: 30, max: 30 },
					},
					audio: false,
				});
				if (cancelled) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}

				streamRef.current = stream;
				video.srcObject = stream;
				await video.play();
				if (cancelled) return;

				setEyeReady(true);
				startLoop(video, faceLandmarker);
			} catch (error) {
				console.error("MediaPipe eye init failed:", error);
			}
		};

		init();

		return () => {
			cancelled = true;
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			rafRef.current = null;
			lastProcessTimeRef.current = 0;
			lastDebugTimeRef.current = 0;
			eyeTrackingRef.current = false;
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => track.stop());
			}
			streamRef.current = null;
			if (faceLandmarkerRef.current) {
				faceLandmarkerRef.current.close();
			}
			faceLandmarkerRef.current = null;
		};
	}, [
		mode,
		inputManagerRef,
		eyesConfigRef,
		updateEyesConfig,
		setEyeDebug,
		centerRef,
		autoCenterDoneRef,
		onAutoCenterCompleted,
	]);

	return {
		eyeReady,
		eyeCentered,
		eyeTracking,
		recenterEyes,
	};
}