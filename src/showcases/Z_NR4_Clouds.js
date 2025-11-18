import {startRenderLoop} from "../webgl/render.js";
import {initBasicState} from "./common.js";
import fragmentShaderSource from "../shaders/specific/nr4_clouds.glsl";
import {createPingPongFramebuffersWithTexture, updateResolutionInState} from "../webgl/helpers.js";

export default {
    title: "NR4's Clouds",
    init: (gl, sources = {}) => {
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

        const {width, height} = updateResolutionInState(state, gl);
        state.framebuffer =
            createPingPongFramebuffersWithTexture(gl, {
                width,
                height,
                colorAttachment: gl.COLOR_ATTACHMENT0,
                internalFormat: gl.RGBA32F,
                dataFormat: gl.RGBA,
                dataType: gl.FLOAT,
            });
        state.passIndex = 0;

        state.debugOption = 0;
        state.accumulate = false;

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
            type: "float",
            name: "iCloudYDisplacement",
            defaultValue: -12.43,
            min: -20,
            max: 10,
        }, {
            type: "float",
            name: "iCloudLayerDistance",
            defaultValue: 4.46,
            min: 0.,
            max: 10,
        }, {
            type: "float",
            name: "iCloudSeed",
            defaultValue: 11.07,
            min: 0,
            max: 100,
        }, {
            type: "float",
            name: "iSkyQuetschung",
            defaultValue: 0.72,
            min: 0,
            max: 10,
        }, {
            type: "float",
            name: "iSampleCount",
            defaultValue: 1,
            min: 1,
            max: 20,
            step: 1,
        }, {
            type: "int",
            name: "iCloudLayerCount",
            defaultValue: 60,
            min: 1,
            max: 200,
        }, {
            type: "int",
            name: "iCloudLightCount",
            defaultValue: 6,
            min: 1,
            max: 100,
        }, {
            type: "float",
            name: "iCloudAbsorptionCoeff",
            defaultValue: 0.9,
            min: 0,
            max: 10,
        }, {
            type: "float",
            name: "iCloudAnisoScattering",
            defaultValue: 0.3,
            min: 0,
            max: 2,
        }, {
            type: "vec3",
            name: "vecSunPosition",
            defaultValue: [1, 0, 0],
            min: -10,
            max: 10,
        }, {
            type: "button",
            name: "toggleAccumulate",
            label: "Accumulate: Off",
            onClick: (button) => {
                state.framebuffer.fb.forEach(fb => {
                    gl.bindFramebuffer(gl.FRAMEBUFFER, fb.fbo);
                    gl.viewport(0, 0, fb.width, fb.height);
                    gl.clearColor(0, 0, 0, 0);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                });
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                state.frameIndex = 0;

                state.debugOption = state.debugOption ^ 1;
                state.accumulate = (state.debugOption & 1) !== 0;
                button.textContent = "Accumulate: " + (state.accumulate ? "On" : "Off");
            }
        }, {
            type: "button",
            name: "debugOption",
            label: "Use FBM A",
            onClick: (button) => {
                state.debugOption = state.debugOption ^ 2;
                const useFbmB = (state.debugOption & 2) !== 0;
                button.textContent = "Use FBM " + (useFbmB ? "B" : "A");
                console.log("Debug Option:", state.debugOption);
            }
        }, {
            type: "float",
            name: "iFree0",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree1",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree2",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree3",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree4",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }]
    })
};

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform1i(state.location.iFrame, state.frameIndex);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform4fv(state.location.iMouse, state.iMouse);
    gl.uniform4fv(state.location.iMouseDrag, state.iMouseDrag);
    gl.uniform1f(state.location.iMouseWheel, state.iMouseWheel);
    gl.uniform1i(state.location.passIndex, state.passIndex);

    gl.uniform1f(state.location.iCloudYDisplacement, state.iCloudYDisplacement);
    gl.uniform1f(state.location.iCloudLayerDistance, state.iCloudLayerDistance);
    gl.uniform1f(state.location.iCloudSeed, state.iCloudSeed);
    gl.uniform1f(state.location.iSkyQuetschung, state.iSkyQuetschung);
    gl.uniform1i(state.location.iSampleCount, state.iSampleCount);
    gl.uniform1i(state.location.iCloudLayerCount, state.iCloudLayerCount);
    gl.uniform1i(state.location.iCloudLightCount, state.iCloudLightCount);
    gl.uniform1f(state.location.iCloudAbsorptionCoeff, state.iCloudAbsorptionCoeff);
    gl.uniform1f(state.location.iCloudAnisoScattering, state.iCloudAnisoScattering);
    gl.uniform3fv(state.location.vecSunPosition, state.vecSunPosition);

    gl.uniform1i(state.location.debugOption, state.debugOption);
    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);

    // there's only one texture (prevImage), so this stays the same
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(state.location.prevImage, 0);

    let [write, read] = state.framebuffer.currentWriteAndRead();
    gl.uniform1i(state.location.passIndex, 0);
    if (state.accumulate)
    {
        state.framebuffer.doPingPong();
        gl.bindFramebuffer(gl.FRAMEBUFFER, write.fbo);
        gl.bindTexture(gl.TEXTURE_2D, read.texture);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.uniform1i(state.location.passIndex, 1);
        [, read] = state.framebuffer.currentWriteAndRead();
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
