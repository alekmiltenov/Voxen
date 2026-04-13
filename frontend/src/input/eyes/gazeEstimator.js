const HISTORY_SIZE = 5;
const ALPHA = 0.5;

const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];

export function createGazeEstimator() {
	const state = {
		historyX: new Array(HISTORY_SIZE),
		historyY: new Array(HISTORY_SIZE),
		tempX: new Array(HISTORY_SIZE),
		tempY: new Array(HISTORY_SIZE),
		count: 0,
		nextIndex: 0,
		smoothX: 0,
		smoothY: 0,
	};

	return {
		estimate(landmarks) {
			return estimateIrisGaze(landmarks, state);
		},
	};
}

export function estimateIrisGaze(landmarks, state) {
	const raw = estimateRawIrisGaze(landmarks);

	const writeIndex = state.nextIndex;
	state.historyX[writeIndex] = raw.x;
	state.historyY[writeIndex] = raw.y;
	state.nextIndex = (writeIndex + 1) % HISTORY_SIZE;
	if (state.count < HISTORY_SIZE) state.count += 1;

	for (let i = 0; i < state.count; i += 1) {
		state.tempX[i] = state.historyX[i];
		state.tempY[i] = state.historyY[i];
	}

	const medX = median(state.tempX, state.count);
	const medY = median(state.tempY, state.count);

	const smoothX = ALPHA * medX + (1 - ALPHA) * state.smoothX;
	const smoothY = ALPHA * medY + (1 - ALPHA) * state.smoothY;

	state.smoothX = smoothX;
	state.smoothY = smoothY;

	return { x: smoothX, y: smoothY };
}

export function estimateRawIrisGaze(landmarks) {
	const leftIris = avgPts(landmarks, LEFT_IRIS_INDICES);
	const rightIris = avgPts(landmarks, RIGHT_IRIS_INDICES);

	const leftOuter = landmarks[33];
	const leftInner = landmarks[133];
	const rightInner = landmarks[362];
	const rightOuter = landmarks[263];

	const leftX = normSigned(leftIris.x, leftOuter.x, leftInner.x);
	const rightX = normSigned(rightIris.x, rightInner.x, rightOuter.x);
	const eyeX = (leftX + rightX) / 2;

	const leftMid = mid(leftOuter, leftInner);
	const rightMid = mid(rightInner, rightOuter);

	const leftWidth = Math.max(Math.abs(leftInner.x - leftOuter.x), 1e-6);
	const rightWidth = Math.max(Math.abs(rightOuter.x - rightInner.x), 1e-6);

	const irisYOffset =
		((leftIris.y - leftMid.y) / leftWidth + (rightIris.y - rightMid.y) / rightWidth) / 2;

	const bothEyes = mid(leftMid, rightMid);
	const nose = landmarks[1];
	const faceLeft = landmarks[234];
	const faceRight = landmarks[454];
	const faceTop = landmarks[10];
	const faceBottom = landmarks[152];

	const faceWidth = Math.max(Math.abs(faceRight.x - faceLeft.x), 1e-6);
	const faceHeight = Math.max(Math.abs(faceBottom.y - faceTop.y), 1e-6);

	const yaw = (nose.x - bothEyes.x) / faceWidth;
	const pitch = (nose.y - bothEyes.y) / faceHeight;

	const correctedX = eyeX - yaw * 0.7;
	const correctedY = irisYOffset * 4.0 + pitch * 2.5;

	return {
		x: clamp(-correctedX * 6.0, -4, 4),
		y: clamp(correctedY * 5.0, -4, 4),
	};
}

export function avgPts(landmarks, indices) {
	let x = 0;
	let y = 0;
	for (let i = 0; i < indices.length; i += 1) {
		const p = landmarks[indices[i]];
		x += p.x;
		y += p.y;
	}
	return { x: x / indices.length, y: y / indices.length };
}

export function mid(a, b) {
	return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function normSigned(value, start, end) {
	const low = Math.min(start, end);
	const high = Math.max(start, end);
	return ((value - low) / Math.max(high - low, 1e-6) - 0.5) * 2;
}

export function clamp(value, low, high) {
	return Math.max(low, Math.min(high, value));
}

export function median(values, length = values.length) {
	if (!length) return 0;

	for (let i = 1; i < length; i += 1) {
		const current = values[i];
		let j = i - 1;
		while (j >= 0 && values[j] > current) {
			values[j + 1] = values[j];
			j -= 1;
		}
		values[j + 1] = current;
	}

	const middle = Math.floor(length / 2);
	return length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
