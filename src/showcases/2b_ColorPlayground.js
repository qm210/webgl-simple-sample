import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

import vertexShaderSource from "../shaders/playground.vertex.glsl";
import fragmentShaderSource from "../shaders/geometryPlayground.glsl";


export default {
    title: "Fragment Shader Playground",
    init: (gl) => {
        createStaticVertexBuffer(
            gl,
            [-1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1]
        );

        const state = compile(gl, vertexShaderSource, fragmentShaderSource);
        if (!state.program) {
            return state;
        }

        initVertices(gl, state, "aPosition");

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        state.location.iTime = gl.getUniformLocation(state.program, "iTime");
        state.location.iResolution = gl.getUniformLocation(state.program, "iResolution");
        state.location.iWhatever = gl.getUniformLocation(state.program, "iWhatever");
        state.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];

        console.log(state);

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
    }, {
        type: "floatInput",
        name: "iWhatever",
        defaultValue: 1.00,
        min: 0,
        max: 10.,
    }]
}

function renderLoop(gl, state, elements) {
    state.time = 0.001 * (performance.now() - state.startTime);

    gl.useProgram(state.program);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1f(state.location.iWhatever, state.iWhatever)

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    elements.iTime.innerHTML = state.time.toFixed(2) + " sec";

    requestAnimationFrame(() => renderLoop(gl, state, elements))
}
