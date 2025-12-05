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
    elements.fps.display.textContent = state.fps;

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

const fpsMeter = {
    frames: null,
    measureAtTime: null,
    durationSeconds: 1,
    measuredFps: null,
    direct: {
        lastTime: null,
        lastFrame: null,
        fps: null,
    }
};

function resetFpsMeasurement(state) {
    state.fps = null;
    fpsMeter.frames = null;
    fpsMeter.measureAtTime = null;
    fpsMeter.measuredFps = null;
    fpsMeter.direct.lastTime = null;
    fpsMeter.direct.lastFrame = null;
    // fpsMeter.direct.fps = null;
}

function doFpsMeasurement(state) {
    // counting method
    if (fpsMeter.measureAtTime === null) {
        fpsMeter.measureAtTime = state.time + fpsMeter.durationSeconds;
        fpsMeter.frames = 0;
    } else {
        fpsMeter.frames++;
        if (state.time > fpsMeter.measureAtTime) {
            fpsMeter.measuredFps = fpsMeter.frames / fpsMeter.durationSeconds;
            fpsMeter.measureAtTime = null;
        }
    }
    // direct rate
    if (fpsMeter.direct.lastTime !== null) {
        fpsMeter.direct.fps =
            (state.iFrame - fpsMeter.direct.lastFrame)
            / (state.time - fpsMeter.direct.lastTime);
    }
    fpsMeter.direct.lastTime = state.time;
    fpsMeter.direct.lastFrame = state.iFrame;

    state.fps = 0;
    let weight = 0;
    if (fpsMeter.direct.fps !== null) {
        state.fps += 0.33 * fpsMeter.direct.fps;
        weight += 0.5;
    }
    if (fpsMeter.measuredFps !== null) {
        state.fps += fpsMeter.measuredFps;
        weight += 1;
    }
    state.fps = weight > 0 ? (state.fps / weight).toFixed(0) : "?";
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
