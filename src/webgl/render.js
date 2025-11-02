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

export function startRenderLoop (renderFunction, state, elements) {
    cancelAnimationFrame(state.animationFrame);
    state.startTime = null;
    state.timeRunning = true;
    state.frameIndex = -1;
    state.stopSignal = false;
    state.fps = null;
    state.animation = (timestamp) =>
        runLoop(renderFunction, state, elements, timestamp);
    state.animationFrame = requestAnimationFrame(state.animation);
}

function runLoop(renderFunction, state, elements, timestamp) {
    if (state.startTime === null) {
        state.startTime = timestamp;
    }
    if (state.timeRunning) {
        state.time = 0.001 * (timestamp - state.startTime);
        state.frameIndex = state.frameIndex + 1;
        doFpsMeasurement(state);
    }

    renderFunction(state);

    elements.iTime.value.textContent = state.time.toFixed(2) + " sec";
    elements.fps.textContent = "FPS: " + state.fps;

    if (state.stopSignal) {
        resetFpsMeasurement(state);
        return;
    }

    requestAnimationFrame(state.animation);
}

const measureFps = {
    frames: null,
    measureAtTime: null,
    durationSeconds: 1,
}

function resetFpsMeasurement(state) {
    state.fps = null;
    measureFps.frames = null;
    measureFps.measureAtTime = null;
}

function doFpsMeasurement(state) {
    if (measureFps.measureAtTime === null) {
        measureFps.measureAtTime = state.time + measureFps.durationSeconds;
        measureFps.frames = 0;
    } else {
        measureFps.frames++;
        if (state.time > measureFps.measureAtTime) {
            state.fps = measureFps.frames / measureFps.durationSeconds;
            measureFps.measureAtTime = null;
        }
    }
}

export function shiftTime(state, seconds) {
    state.time += seconds;
    state.startTime -= 1000 * seconds;
}
