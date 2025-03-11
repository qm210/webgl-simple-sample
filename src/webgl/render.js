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
    state.startTime = performance.now();
    state.animationFrame = requestAnimationFrame(() =>
        runLoop(renderFunction, state, elements)
    );
}

function runLoop(renderFunction, state, elements) {
    state.time = 0.001 * (performance.now() - state.startTime);

    renderFunction(state);

    elements.iTime.innerHTML = state.time.toFixed(2) + " sec";

    requestAnimationFrame(() =>
        runLoop(renderFunction, state, elements)
    );
}
