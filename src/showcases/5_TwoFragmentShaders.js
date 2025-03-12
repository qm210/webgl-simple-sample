import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";
import simpleGeometrySetup from "./3_SimpleGeometry.js";

// as a base fragment shader, this uses what we had in 4_More2DGeometry.js,
// but now there's an additional fragment shader

import vertexShaderSource from "../shaders/basic.vertex.glsl";
import fragmentShaderSource1 from "../shaders/starAndCircleGeometry.glsl";
import fragmentShaderSource2 from "../shaders/starAndCircleGeometry.glsl";
import {compileMultipleFragments} from "../webgl/advancedSetup.js";

export default {
    title: "Example of Two Fragment Shaders",
    init: (gl) => {
        createStaticVertexBuffer(
            gl,
            [-1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1]
        );

        const state = compileMultipleFragments(
            gl,
            vertexShaderSource,
            fragmentShaderSource1,
            fragmentShaderSource2,
        );
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
    generateControls:
        simpleGeometrySetup.generateControls
};
