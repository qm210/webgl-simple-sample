import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

import vertexShaderSource from "../shaders/basic.vertex.glsl";
import fragmentShaderSource from "../shaders/spring-2025/singleColor.glsl";

export default {
    title: "Very simple example",
    init: (gl) => {
        // QUESTION: what the... is this?
        createStaticVertexBuffer(
            gl,
            [-1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1]
        );

        const state = compile(gl, vertexShaderSource, fragmentShaderSource);
        if (!state.program) {
            return state;
        }

        initVertices(gl, state, "aPosition");

        return state;
    },
    generateControls: (gl, state, elements) => [{
        type: "renderButton",
        title: "Render",
        onClick: () => {
            gl.useProgram(state.program);

            // QUESTION: triangles?
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    }]
}
