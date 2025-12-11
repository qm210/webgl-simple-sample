/**
 * This is our basic structure to call a render function repeatedly
 * and have the time value displayed on our main page
 *
 * in general, your render Function should
 *  - call useProgram()
 *  - set uniforms
 *  - call a drawing function like drawArrays()
 *
 *  this does not support advanced stuff like custom framebuffers etc. yet
 *
 * @param renderFunction - pass your actual render function
 * @param state
 * @param elements
 */

export function startRenderLoop(renderFunction, state, elements) {
    if (!state.program) {
        console.error("Cannot startRenderLoop() with no-shader-program-at-all!");
        return;
    }
    cancelAnimationFrame(state.play.animationFrame);
    state.play.running ??= true;
    state.iFrame = -1;
    state.play.previous.timestamp = null;
    state.play.dt = 0;
    state.play.fps = null;
    state.play.signal.reset = false;
    state.play.signal.stop = false;
    state.play.signal.reachedStop = false;
    state.play.signal.takeRenderTime = false;
    state.play.animate = (timestamp) =>
        runLoop(renderFunction, state, elements, timestamp);
    state.play.animationFrame = requestAnimationFrame(state.play.animate);
}

function runLoop(renderFunction, state, elements, timestamp) {
    if (state.play.signal.reset) {
        resetLoop(state);
    }

    state.play.dt = 0;
    if (state.play.running) {
        if (state.play.previous.timestamp === null) {
            state.play.previous.timestamp = timestamp;
        } else {
            state.play.previous.time = state.time;
        }
        state.play.dt = 0.001 * (timestamp - state.play.previous.timestamp);
        state.time += state.play.dt
        state.iFrame = state.iFrame + 1;
        doFpsMeasurement(state);

        if (state.play.loop.active) {
            const lastSecond = state.play.loop.end ?? state.play.range.max;
            if (state.time > lastSecond) {
                state.time = state.play.loop.start ?? 0;
                state.iFrame = 0;
                // Keine bessere Idee für den Frame-Index...
                // Wegnullen vermutlich besser als einfach zu ignorieren.
            }
        }

        state.play.previous.timestamp = timestamp;
    }

    if (state.play.signal.takeRenderTime) {
        console.time("render");
    }

    renderFunction(state);

    if (state.play.signal.takeRenderTime) {
        console.timeEnd("render");
        state.play.signal.takeRenderTime = false;
    }

    elements.controlBar.time.update();
    elements.fps.display.textContent = state.play.fps;

    if (state.play.signal.stop) {
        state.play.reachedStop = true;
        resetFpsMeasurement(state);
        return;
    }

    requestAnimationFrame(state.play.animate);
}

export function resetLoop(state) {
    state.play.previous.timestamp = null;
    state.play.signal.reset = false;
    state.play.signal.stop = false;
    state.play.reachedStop = false;
    state.play.running = true;
    state.time = 0;
    state.iFrame = -1;
}

const createFpsAverager = (sampleSize) => ({
    samples: Array(sampleSize).fill(0),
    index: 0,
    taken: 0,
    sum: 0,
    fps: null,
});

const fpsMeter = {
    current: null,
    last: {
        time: null,
        frame: null,
    },
    avg: createFpsAverager(100)
};

function resetFpsMeasurement(state) {
    state.play.fps = null;
    fpsMeter.last = {
        time: null,
        frame: null,
    };
    fpsMeter.avg = createFpsAverager(fpsMeter.avg.samples.length);
}

function doFpsMeasurement(state) {
    if (fpsMeter.last.time !== null) {
        fpsMeter.current =
            (state.iFrame - fpsMeter.last.frame) /
            (state.time - fpsMeter.last.time);
        fpsMeter.avg.sum -= fpsMeter.avg.samples[fpsMeter.avg.index];
        fpsMeter.avg.samples[fpsMeter.avg.index] = fpsMeter.current;
        fpsMeter.avg.sum += fpsMeter.current;
        if (fpsMeter.avg.taken < fpsMeter.avg.samples.length) {
            fpsMeter.avg.taken++;
        }
        fpsMeter.avg.index = (fpsMeter.avg.index + 1) % fpsMeter.avg.taken;
        fpsMeter.avg.fps = fpsMeter.avg.sum / fpsMeter.avg.taken;
    }
    fpsMeter.last.time = state.time;
    fpsMeter.last.frame = state.iFrame;

    state.play.fps = (fpsMeter.avg.fps ?? fpsMeter.current)
        ?.toFixed(1) ?? "?";
}

export function whilePausingRendering(state, callFunction) {
    state.play.signal.stop = true;
    let safetyIndex = 0;
    while (!state.play.reachedStop) {
        safetyIndex++;
        if (safetyIndex > 10000) {
            console.error("whilePausingRendering() / runLoop() broken, Stop Signal never reached!");
            break;
        }
    }
    callFunction();
    const continueAt = 0.001 * performance.now();
    state.play.previous.timestamp += continueAt - state.time;
    state.play.signal.stop = state.play.reachedStop = false;
    state.animationFrame = requestAnimationFrame(state.play.animate);
}
