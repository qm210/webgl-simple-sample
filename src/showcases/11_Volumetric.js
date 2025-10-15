import standardSetup from "./retired/3_SimpleGeometry.js";
import {startRenderLoop} from "../webgl/render.js";

import fragmentShaderSource from "../shaders/spring-2025/volumetricClouds.glsl";
// <-- huge credits to Christopher Wallis for the original
//     https://www.shadertoy.com/view/tsScDG

export default {
    title: "Volumetric Clouds",
    init: (gl) => {
        const state = standardSetup.init(gl, fragmentShaderSource);

        if (!state.program) {
            return state;
        }

        return state;
    },
    generateControls: (gl, state, elements) => [{
        type: "renderButton",
        title: "Render",
        onClick: () => {
            startRenderLoop(
                state => render(gl, state),
                state,
                elements
            );
        }
    }, {
        type: "label",
        name: "iTime",
    }]
};

function render(gl, state) {
    gl.useProgram(state.program);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
