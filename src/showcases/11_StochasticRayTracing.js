import standardSetup from "./3_SimpleGeometry.js";
import {startRenderLoop} from "../webgl/render.js";
import {createFramebufferWithTexture} from "../webgl/helpers.js";
import {takePingPongFramebuffers} from "./10_FramebufferPingPong.js";

// dieses Beispiel basiert auf dem bekannten "Ray Tracing In One Weekend" von Peter Shirley
// https://raytracing.github.io/books/RayTracingInOneWeekend.html#wherenext?
// bzw. seiner Shader-Toy-Implementierung, big credits an "reinder":
import fragmentShaderSource from "../shaders/stochasticRayTracing_fromTheBook.glsl";

export default {
    title: "Stochastic Ray Tracing",
    init: (gl) => {
        const state = standardSetup.init(gl, fragmentShaderSource);

        if (!state.program) {
            return state;
        }

        state.framebuffer = [0, 1].map(() =>
            createFramebufferWithTexture(gl, {
                width: gl.drawingBufferWidth,
                height: gl.drawingBufferHeight,
                colorAttachment: gl.COLOR_ATTACHMENT0,
                internalFormat: gl.RGBA16F,
                dataFormat: gl.RGBA,
                dataType: gl.FLOAT,
            })
        );

        state.location.previousRender = gl.getUniformLocation(state.program, "iChannel0");
        state.location.passIndex = gl.getUniformLocation(state.program, "iPassIndex");
        state.location.iFrame = gl.getUniformLocation(state.program, "iFrame");
        state.frameIndex = 0;

        gl.useProgram(state.program);

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
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1i(state.location.iFrame, state.frameIndex);

    const {write, read} = takePingPongFramebuffers(state);

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(state.location.previousRender, 0);
    gl.uniform1i(state.location.passIndex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.uniform1i(state.location.passIndex, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
