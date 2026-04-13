import { createEyeProcessor } from "./eyeProcessor";

const processorsByConfig = new WeakMap();
let fallbackProcessor = null;
let fallbackConfig = null;

function getProcessor(config) {
	if (config && typeof config === "object") {
		let processor = processorsByConfig.get(config);
		if (!processor) {
			processor = createEyeProcessor(config);
			processorsByConfig.set(config, processor);
		}
		return processor;
	}

	if (!fallbackProcessor || fallbackConfig !== config) {
		fallbackProcessor = createEyeProcessor(config || {});
		fallbackConfig = config;
	}

	return fallbackProcessor;
}

/**
 * Pure eye-tracking decision processor.
 *
 * @param {{ gazeX: number, gazeY: number, timestamp: number }} input
 * @param {{
 *   lastDirection: string,
 *   lastDirectionTime: number,
 *   rawDirection: string,
 *   rawStartTime: number,
 *   stableFrames: number,
 *   navLock: string | null,
 *   lastCommandTime: number
 * }} state
 * @param {{
 *   center: { x: number, y: number },
 *   yBias: number,
 *   centerBuffer: number,
 *   debounceMs: number,
 *   stabilityMs: number,
 *   minStableFrames: number,
 *   commandDelay: number
 * }} config
 */
export function processEyes(input, state, config) {
	const result = getProcessor(config).process(input);
	return result;
}

export default processEyes;
