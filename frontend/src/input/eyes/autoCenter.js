function medianInPlace(values, length = values.length) {
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

export function createAutoCenter(frames = 24) {
	const size = Math.max(1, frames | 0);

	const state = {
		bufferX: new Array(size),
		bufferY: new Array(size),
		count: 0,
		index: 0,
		locked: false,
		centerX: 0,
		centerY: 0,
	};

	const scratchX = new Array(size);
	const scratchY = new Array(size);

	return {
		update(gaze) {
			if (state.locked) {
				return {
					ready: true,
					center: { x: state.centerX, y: state.centerY },
				};
			}

			const writeIndex = state.index;
			state.bufferX[writeIndex] = gaze.x;
			state.bufferY[writeIndex] = gaze.y;

			state.index = (writeIndex + 1) % size;
			if (state.count < size) state.count += 1;

			if (state.count < size) {
				return { ready: false };
			}

			for (let i = 0; i < size; i += 1) {
				scratchX[i] = state.bufferX[i];
				scratchY[i] = state.bufferY[i];
			}

			const x = medianInPlace(scratchX, size);
			const y = medianInPlace(scratchY, size);

			state.centerX = x;
			state.centerY = y;
			state.locked = true;

			return {
				ready: true,
				center: { x: state.centerX, y: state.centerY },
			};
		},

		reset() {
			for (let i = 0; i < size; i += 1) {
				state.bufferX[i] = 0;
				state.bufferY[i] = 0;
				scratchX[i] = 0;
				scratchY[i] = 0;
			}
			state.count = 0;
			state.index = 0;
			state.locked = false;
			state.centerX = 0;
			state.centerY = 0;
		},
	};
}
