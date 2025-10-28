import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

const basicVertexShaderSource =
    `#version 300 es

    in vec4 aPosition;
    
    void main() {
        gl_Position = aPosition;
    }`;

export function initBasicState(gl, sources) {
    /**
     *  The common WebGL initialization code for a showcase
     *  with our super-basic vertex shader (rectangle from 2 triangles)
     *  and fragment shader uniforms {iTime, iResolution, iMouse}
     *  but no textures, extra frame buffers etc.
     */
    createStaticVertexBuffer(
        gl,
        [-1, -1, +1, -1, -1, 1, -1, +1, +1, -1, +1, +1]
    );

    sources.vertex ??= basicVertexShaderSource;
    const state = compile(gl, sources);
    if (!state.program) {
        return state;
    }

    initVertices(gl, state, "aPosition");

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    state.location.iTime = gl.getUniformLocation(state.program, "iTime");
    state.location.iResolution = gl.getUniformLocation(state.program, "iResolution");
    state.location.iMouse = gl.getUniformLocation(state.program, "iMouse");

    gl.useProgram(state.program);

    return state;
}