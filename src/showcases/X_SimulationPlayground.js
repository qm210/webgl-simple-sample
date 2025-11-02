import {startRenderLoop} from "../webgl/render.js";
import {createFramebufferWithTexture, createTextureFromImage, takePingPongFramebuffers} from "../webgl/helpers.js";

import fragmentShaderSource from "../shaders/xSimulationPlayground.glsl";
import {initBasicState} from "./common.js";
import schnoergl210 from "../textures/210_schnoerkel.png";

export default {
    title: "Advanced Playground",
    init: (gl, sources = {}) => {
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

        state.framebuffer = [0, 1].map(() =>
            createFramebufferWithTexture(gl, {
                width: gl.drawingBufferWidth,
                height: gl.drawingBufferHeight,
                colorAttachment: gl.COLOR_ATTACHMENT0,
                // Diese Formate werden später wichtig, können hier aber auf dem Default bleiben:
                // internalFormat: gl.RGBA,
                // dataFormat: gl.RGBA,
                // dataType: gl.UNSIGNED_BYTE,
            })
        );

        state.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];
        state.frameIndex = 0;

        for (const fb of state.framebuffer) {
            // for the second, i.e. layout(location=1) out ...
            fb.extraOutTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, fb.extraOutTexture);
            // NOTE: does gl.RGBA32F even work? maybe gl.RGBA16F
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, ...state.resolution, 0, gl.RGBA, gl.FLOAT, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

            gl.bindFramebuffer(gl.FRAMEBUFFER, fb.fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, fb.extraOutTexture, 0);
            fb.attachments.push(gl.COLOR_ATTACHMENT1);
            gl.drawBuffers(fb.attachments);

            const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (status !== gl.FRAMEBUFFER_COMPLETE) {
                console.error(fb, status);
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }

        // random reminder: there is textureSize(). should be written somewhere useful.

        state.location.iTime = gl.getUniformLocation(state.program, "iTime");
        state.location.iResolution = gl.getUniformLocation(state.program, "iResolution");
        state.location.prevImage = gl.getUniformLocation(state.program, "iPrevImage");
        state.location.prevVelocity = gl.getUniformLocation(state.program, "iPrevVelocity");
        state.location.passIndex = gl.getUniformLocation(state.program, "iPassIndex");
        state.location.iFrame = gl.getUniformLocation(state.program, "iFrame");

        state.location.iNoiseLevel = gl.getUniformLocation(state.program, "iNoiseLevel");
        state.location.iNoiseFreq = gl.getUniformLocation(state.program, "iNoiseFreq");
        state.location.iNoiseOffset = gl.getUniformLocation(state.program, "iNoiseOffset");
        state.location.iFractionSteps = gl.getUniformLocation(state.program, "iFractionSteps");
        state.location.iFractionScale = gl.getUniformLocation(state.program, "iFractionScale");
        state.location.iFractionAmplitude = gl.getUniformLocation(state.program, "iFractionAmplitude");
        state.location.iCloudMorph = gl.getUniformLocation(state.program, "iCloudMorph");
        state.location.iCloudVelX = gl.getUniformLocation(state.program, "iCloudVelX");
        state.location.iFree0 = gl.getUniformLocation(state.program, "iFree0");
        state.location.iFree1 = gl.getUniformLocation(state.program, "iFree1");
        state.location.iFree2 = gl.getUniformLocation(state.program, "iFree2");

        state.dream210logo = createTextureFromImage(gl, schnoergl210, {
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            minFilter: gl.NEAREST,
            magFilter: gl.NEAREST,
        });
        state.location.iDream210 = gl.getUniformLocation(state.program, "iDream210");

        gl.useProgram(state.program);

        return state;
    },
    generateControls: (gl, state, elements) => ({
        onRender: () => {
            startRenderLoop(
                state => render(gl, state),
                state,
                elements
            );
        },
        uniforms: [{
            type: "label",
            name: "iTime",
        }, {
            type: "floatInput",
            name: "iNoiseLevel",
            defaultValue: 1,
            min: 0.,
            max: 2.,
        }, {
            type: "floatInput",
            name: "iNoiseFreq",
            defaultValue: 1,
            min: 0.01,
            max: 10.,
        }, {
            type: "floatInput",
            name: "iNoiseOffset",
            defaultValue: 0,
            min: -1,
            max: 1,
        }, {
            type: "floatInput",
            name: "iFractionSteps",
            defaultValue: 1,
            min: 1,
            max: 10.,
            step: 1,
        }, {
            type: "floatInput",
            name: "iFractionScale",
            defaultValue: 2.,
            min: 0.01,
            max: 10.,
        }, {
            type: "floatInput",
            name: "iFractionAmplitude",
            defaultValue: 0.5,
            min: 0.01,
            max: 2.,
        }, {
            type: "floatInput",
            name: "iCloudMorph",
            defaultValue: 0,
            min: 0,
            max: 2,
        }, {
            type: "floatInput",
            name: "iCloudVelX",
            defaultValue: 0,
            min: -2.,
            max: 2,
        }, {
            type: "vec3Input",
            name: "iFree0",
            defaultValue: [0, 0, 0],
            min: -9.99,
            max: +9.99,
        }, {
            type: "vec3Input",
            name: "iFree1",
            defaultValue: [0, 0, 0],
            min: -9.99,
            max: +9.99,
        }, {
            type: "vec3Input",
            name: "iFree2",
            defaultValue: [0, 0, 0],
            min: -9.99,
            max: +9.99,
        }]
    })
};

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1i(state.location.iFrame, state.frameIndex);

    gl.uniform1f(state.location.iNoiseLevel, state.iNoiseLevel);
    gl.uniform1f(state.location.iNoiseFreq, state.iNoiseFreq);
    gl.uniform1f(state.location.iNoiseOffset, state.iNoiseOffset);
    gl.uniform1i(state.location.iFractionSteps, Math.floor(state.iFractionSteps));
    gl.uniform1f(state.location.iFractionScale, state.iFractionScale);
    gl.uniform1f(state.location.iFractionAmplitude, state.iFractionAmplitude);
    gl.uniform1f(state.location.iCloudMorph, state.iCloudMorph);
    gl.uniform1f(state.location.iCloudVelX, state.iCloudVelX);
    gl.uniform3fv(state.location.iFree0, state.iFree0);
    gl.uniform3fv(state.location.iFree1, state.iFree1);
    gl.uniform3fv(state.location.iFree2, state.iFree2);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.dream210logo);
    gl.uniform1i(state.location.iDream210, 2);

    let {write, read} = takePingPongFramebuffers(state);

    for (let pass = 0; pass < 3; pass++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
        gl.uniform1i(state.location.passIndex, pass);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, read.texture);
        gl.uniform1i(state.location.prevImage, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, read.extraOutTexture);
        gl.uniform1i(state.location.prevVelocity, 1);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        [write, read] = [read, write];
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.uniform1i(state.location.passIndex, 3);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
