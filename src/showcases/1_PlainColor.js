import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

/**
 * Hint about usage: every showcase file must have a default export like this
 */

import vertexShaderSource from "../shaders/basic.vertex.glsl";
import fragmentShaderSource from "../shaders/singleColor.glsl";


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

        // ... how does that relate to the vertex buffer?
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
