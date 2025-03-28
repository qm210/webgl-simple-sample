import standardSetup from "./3_SimpleGeometry.js";
import {startRenderLoop} from "../webgl/render.js";
import {createFramebufferWithTexture} from "../webgl/helpers.js";

import fragmentShaderSource from "../shaders/stochasticRayTracing.glsl";

// Hint: this example uses multiple outputs, which is why we need WebGL2.
// Older versions could hope for the WEBGL_draw_buffers extension for WebGL,
// but why bother with that when your browser could really just have WebGL2?

export default {
    title: "Stochastic Ray Tracing",
    init: (gl) => {
        const state = standardSetup.init(gl, fragmentShaderSource);

        if (!state.program) {
            return state;
        }

        state.framebuffer = createFramebufferWithTexture(gl, {
            width: gl.drawingBufferWidth,
            height: gl.drawingBufferHeight,
            colorAttachment: gl.COLOR_ATTACHMENT1
        });

        state.location.iFrame = gl.getUniformLocation(state.program, "iFrame");
        state.location.texture = gl.getUniformLocation(state.program, "iFramebufferTexture");

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
    }
    ]
};

function render(gl, state) {
    state.frameIndex = (state.frameIndex ?? -1) + 1;

    gl.useProgram(state.program);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1i(state.location.iFrame, state.frameIndex);

    // draw on screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
