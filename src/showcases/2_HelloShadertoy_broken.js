import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

import vertexShaderSource from "../shaders/basicVertex.glsl";
import fragmentShaderSource from "../shaders/fragmentShadertoyAsIs.glsl";


export default {
    title: "Hello Shadertoy (broken)",
    init: (gl) => {
        createStaticVertexBuffer(
            gl,
            [-1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1]
        );

        const state = compile(gl, vertexShaderSource, fragmentShaderSource);

        // ... how does that relate to the vertex buffer?
        initVertices(gl, state, "aPosition");

        return state;
    },
    generateControls: (gl, state) => [{
        type: "renderButton",
        title: "Render",
        onClick: () => {
            gl.useProgram(state.program);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }]
}
