import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

import vertexShaderSource from "../shaders/basic.vertex.glsl";
import fragmentShaderSource from "../shaders/circles.glsl";


export default {
    title: "Simple Geometry",
    init: (gl) => {
        createStaticVertexBuffer(
            gl,
            [-1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1]
        );

        const state = compile(gl, vertexShaderSource, fragmentShaderSource);
        if (!state.program) {
            // remember: need to exist because otherwise we cannot display any errors...
            return state;
        }

        initVertices(gl, state, "aPosition");

        // oh hey, look at this! (optional)
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        state.location.iTime = gl.getUniformLocation(state.program, "iTime");
        state.location.iResolution = gl.getUniformLocation(state.program, "iResolution");

        // custom field, why not add right here.
        state.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];

        return state;
    },
    generateControls: (gl, state, elements) => [{
        type: "renderButton",
        title: "Render",
        onClick: () => {
            cancelAnimationFrame(state.animationFrame);
            state.startTime = performance.now();
            state.animationFrame = requestAnimationFrame(
                () => renderLoop(gl, state, elements)
            )
        }
    }, {
        type: "label",
        name: "iTime",
    }]
};

function renderLoop(gl, state, elements) {
    state.time = 0.001 * (performance.now() - state.startTime);

    render(gl, state);

    elements.iTime.innerHTML = state.time.toFixed(2) + " sec";
    requestAnimationFrame(() => renderLoop(gl, state, elements))
}

function render(gl, state) {
    gl.useProgram(state.program);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}