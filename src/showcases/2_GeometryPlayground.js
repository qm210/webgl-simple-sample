import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

import vertexShaderSource from "../shaders/playground.vertex.glsl";
import fragmentShaderSource from "../shaders/geometryPlayground.glsl";
import {startRenderLoop} from "../webgl/render.js";


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
        state.location.helloThere = gl.getUniformLocation(state.program, "helloThere");
        state.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];

        return state;
    },
    generateControls: (gl, state, elements) => ({
        onRender: () =>
            startRenderLoop(state => render(gl, state), state, elements),
        uniforms: [{
            type: "label",
            name: "iTime",
        }, {
            type: "floatInput",
            name: "helloThere",
            defaultValue: 1.00,
            min: 0,
            max: 10.,
        }]
    })
}

function render(gl, state) {
    gl.useProgram(state.program);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1f(state.location.helloThere, state.helloThere);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
