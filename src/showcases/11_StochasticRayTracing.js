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

        /*

        state.post = standardSetup.init(gl,
            `#version 300 es
precision highp float;
out vec4 frag_color;

uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;
uniform int iPassIndex;
uniform sampler2D iChannel0;

void main() {
    vec2 st = gl_FragCoord.xy / iResolution.xy;
    vec4 data = texture(iChannel0, st);
    frag_color = vec4(data.rgb, 1.);
}
        `)
        state.post.location.previousRender = gl.getUniformLocation(state.post.program, "iChannel0");
        state.post.location.passIndex = gl.getUniformLocation(state.post.program, "iPassIndex");
        state.post.location.iFrame = gl.getUniformLocation(state.post.program, "iFrame");
        state.frameIndex = 0;

        // <-- hint: locations are PER PROGRAM

         */

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
    // const [write, read] = state.framebuffer;

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
    // gl.viewport(0, 0, ...state.resolution);
    // gl.clearColor(0,0,0,0);
    // gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(state.location.previousRender, 0);
    gl.uniform1i(state.location.passIndex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.uniform1i(state.location.passIndex, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // state.stopSignal = true;

    // const post = state.post;
    // gl.useProgram(post.program);
    // gl.uniform1f(gl.getUniformLocation(state.post.program, "iTime"), state.time);
    // gl.uniform2fv(gl.getUniformLocation(state.post.program, "iResolution"), state.resolution);
    // gl.uniform1i(gl.getUniformLocation(state.post.program, "iFrame"), state.frameIndex);
    // gl.activeTexture(gl.TEXTURE0);
    // gl.bindTexture(gl.TEXTURE_2D, write.texture);
    // gl.uniform1i(gl.getUniformLocation(state.post.program, "iChannel0"), 0);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // gl.drawArrays(gl.TRIANGLES, 0, 6);
    //

//    state.stopSignal = true;
    // const [width, height] = state.resolution;
    // const floatSize = width * height * 4;
    // const data = new Float32Array(floatSize);
    // gl.bindTexture(gl.TEXTURE_2D, read.texture);
    // gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, data);
    // console.log("CHECK IMAGE", data, floatSize, gl, gl.drawingBufferFormat === gl.RGBA8);
}
