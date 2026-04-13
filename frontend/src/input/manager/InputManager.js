import { processEyes } from "../eyes/eyesProcessor";
import { processCNN } from "../cnn/cnnProcessor";
import { processHead } from "../head/headProcessor";
import { createFastDirectionalState } from "../shared/timingUtils";

export class InputManager {
	constructor(dispatch, mode) {
		this.dispatch = typeof dispatch === "function" ? dispatch : () => {};
		this.mode = mode;

		this.eyesState = createFastDirectionalState();
		this.cnnState = createFastDirectionalState();
		this.headState = {
			lastCommandTime: 0,
			holdCmd: null,
			holdStart: 0,
			selectionTriggered: false,
		};
	}

	setMode(mode) {
		this.mode = mode;
	}

	handleEyes(input, config) {
		if (this.mode !== "eyes") return;

		const result = processEyes(input, this.eyesState, config);
		this.eyesState = result?.newState ?? this.eyesState;

		if (result?.command) {
			this.dispatch(result.command);
		}

		return result;
	}

	handleCNN(input, config) {
		if (this.mode !== "cnn") return;

		const result = processCNN(input, this.cnnState, config);
		this.cnnState = result?.newState ?? this.cnnState;

		if (result?.command) {
			this.dispatch(result.command);
		}

		return result;
	}

	handleHead(input, config) {
		if (this.mode !== "head") return;

		const result = processHead(input, this.headState, config);
		this.headState = result?.newState ?? this.headState;

		if (result?.command) {
			this.dispatch(result.command);
		}

		return result;
	}
}

export default InputManager;
