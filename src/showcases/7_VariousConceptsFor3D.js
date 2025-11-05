import {startRenderLoop} from "../webgl/render.js";
import {initBasicState} from "./common.js";
import {createTextureFromImage} from "../webgl/helpers.js";
import fragmentShaderSource from "../shaders/raymarchingPlusVariousConcepts.glsl";
import imageFrame from "../textures/frame.png";
import imageSpace from "../textures/hubble_extreme_deep_field.jpg";
import imageRock from "../textures/Rock032_1K-JPG_Color.jpg";

export default {
    title: "Various 3D Concepts",
    init: (gl, sources = {}) => {
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

        state.textureFrame = createTextureFromImage(gl, imageFrame, {
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
        });
        state.textureSpace = createTextureFromImage(gl, imageSpace, {
            wrapS: gl.REPEAT,
            wrapT: gl.REPEAT,
            minFilter: gl.LINEAR,
        });
        state.textureRock = createTextureFromImage(gl, imageRock, {
            wrapS: gl.REPEAT,
            wrapT: gl.REPEAT,
            minFilter: gl.LINEAR,
        });

        state.location.texFrame = gl.getUniformLocation(state.program, "texFrame");
        state.location.texSpace = gl.getUniformLocation(state.program, "texSpace");
        state.location.texRock = gl.getUniformLocation(state.program, "texRock");
        state.location.iCamOffset = gl.getUniformLocation(state.program, "iCamOffset");
        state.location.iCamLookOffset = gl.getUniformLocation(state.program, "iCamLookOffset");
        state.location.iCamRoll = gl.getUniformLocation(state.program, "iCamRoll");
        state.location.iCamFocalLength = gl.getUniformLocation(state.program, "iCamFocalLength");
        state.location.iPathSpeed = gl.getUniformLocation(state.program, "iPathSpeed");
        state.location.iPathOffset = gl.getUniformLocation(state.program, "iPathOffset");
        state.location.vecDirectionalLight = gl.getUniformLocation(state.program, "vecDirectionalLight");
        state.location.iLightPointPaletteColor = gl.getUniformLocation(state.program, "iLightPointPaletteColor");
        state.location.iLightSourceMix = gl.getUniformLocation(state.program, "iLightSourceMix");
        state.location.iDiffuseAmount = gl.getUniformLocation(state.program, "iDiffuseAmount");
        state.location.iSpecularAmount = gl.getUniformLocation(state.program, "iSpecularAmount");
        state.location.iSpecularExponent = gl.getUniformLocation(state.program, "iSpecularExponent");
        state.location.iBacklightAmount = gl.getUniformLocation(state.program, "iBacklightAmount");
        state.location.iSubsurfaceAmount = gl.getUniformLocation(state.program, "iSubsurfaceAmount");
        state.location.iAmbientOcclusionScale = gl.getUniformLocation(state.program, "iAmbientOcclusionScale");
        state.location.iAmbientOcclusionStep = gl.getUniformLocation(state.program, "iAmbientOcclusionStep");
        state.location.iAmbientOcclusionSamples = gl.getUniformLocation(state.program, "iAmbientOcclusionSamples");
        state.location.iToneMapExposure = gl.getUniformLocation(state.program, "iToneMapExposure");
        state.location.iToneCompressedGain = gl.getUniformLocation(state.program, "iToneCompressedGain");
        state.location.iGammaExponent = gl.getUniformLocation(state.program, "iGammaExponent");
        state.location.iFree0 = gl.getUniformLocation(state.program, "iFree0");
        state.location.iFree1 = gl.getUniformLocation(state.program, "iFree1");
        state.location.iFree2 = gl.getUniformLocation(state.program, "iFree2");
        state.location.iFree3 = gl.getUniformLocation(state.program, "iFree3");
        state.location.iFree4 = gl.getUniformLocation(state.program, "iFree4");
        state.location.iFree5 = gl.getUniformLocation(state.program, "iFree5");
        state.location.vecFree0 = gl.getUniformLocation(state.program, "vecFree0");
        state.location.vecFree1 = gl.getUniformLocation(state.program, "vecFree1");
        state.location.vecFree2 = gl.getUniformLocation(state.program, "vecFree2");

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
        uniforms: defineUniformControlsBelow()
    })
};

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform4fv(state.location.iMouse, state.iMouse);

    gl.uniform3fv(state.location.iCamOffset, state.iCamOffset);
    gl.uniform3fv(state.location.iCamLookOffset, state.iCamLookOffset);
    gl.uniform1f(state.location.iCamRoll, state.iCamRoll);
    gl.uniform1f(state.location.iCamFocalLength, state.iCamFocalLength);
    gl.uniform3fv(state.location.vecDirectionalLight, state.vecDirectionalLight);
    gl.uniform1f(state.location.iLightSourceMix, state.iLightSourceMix);
    gl.uniform1f(state.location.iLightPointPaletteColor, state.iLightPointPaletteColor);
    gl.uniform1f(state.location.iPathSpeed, state.iPathSpeed);
    gl.uniform1f(state.location.iPathOffset, state.iPathOffset);
    gl.uniform1f(state.location.iDiffuseAmount, state.iDiffuseAmount);
    gl.uniform1f(state.location.iSpecularAmount, state.iSpecularAmount);
    gl.uniform1f(state.location.iSpecularExponent, state.iSpecularExponent);
    gl.uniform1f(state.location.iBacklightAmount, state.iBacklightAmount);
    gl.uniform1f(state.location.iSubsurfaceAmount, state.iSubsurfaceAmount);
    gl.uniform1f(state.location.iAmbientOcclusionScale, state.iAmbientOcclusionScale);
    gl.uniform1f(state.location.iAmbientOcclusionStep, state.iAmbientOcclusionStep);
    gl.uniform1f(state.location.iAmbientOcclusionSamples, state.iAmbientOcclusionSamples);
    gl.uniform1f(state.location.iToneMapExposure, state.iToneMapExposure);
    gl.uniform1f(state.location.iToneCompressedGain, state.iToneCompressedGain);
    gl.uniform1f(state.location.iGammaExponent, state.iGammaExponent);

    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);
    gl.uniform1f(state.location.iFree5, state.iFree5);
    gl.uniform3fv(state.location.vecFree0, state.vecFree0);
    gl.uniform3fv(state.location.vecFree1, state.vecFree1);
    gl.uniform3fv(state.location.vecFree2, state.vecFree2);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.textureFrame);
    gl.uniform1i(state.location.texFrame, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.textureSpace);
    gl.uniform1i(state.location.texSpace, 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.textureRock);
    gl.uniform1i(state.location.texRock, 2);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function defineUniformControlsBelow() {
    return [{
        type: "cursorInput",
        name: "iCamOffset",
        keys: ["w", "a", "s", "d", "r", "f", "q"],
        defaultValue: [0, 0, 0],
        step: 0.25,
    }, {
        type: "vec3Input",
        name: "iCamLookOffset",
        defaultValue: [0, 0, 0],
        min: -2,
        max: +2,
    }, {
        type: "floatInput",
        name: "iCamRoll",
        defaultValue: 0,
        min: -6.283,
        max: +6.283,
    }, {
        type: "floatInput",
        name: "iCamFocalLength",
        defaultValue: 2.5,
        min: 0.001,
        max: 20,
    }, {
        type: "vec3Input",
        name: "vecDirectionalLight",
        defaultValue: [-0.2, 1.4, -0.4],
        min: -2,
        max: 2,
    }, {
        type: "floatInput",
        name: "iPathSpeed",
        defaultValue: 0,
        min: 0.,
        max: 2.,
    }, {
        type: "floatInput",
        name: "iPathOffset",
        defaultValue: 0,
        min: 0.,
        max: 12.,
    }, {
        type: "floatInput",
        name: "iLightSourceMix",
        defaultValue: 0,
        min: -2,
        max: 3,
    }, {
        type: "floatInput",
        name: "iLightPointPaletteColor",
        defaultValue: 0,
        min: 0.,
        max: 10.,
    }, {
        type: "floatInput",
        name: "iDiffuseAmount",
        defaultValue: 1,
        min: 0.,
        max: 10.,
    }, {
        type: "floatInput",
        name: "iSpecularAmount",
        defaultValue: 1,
        min: 0.,
        max: 10.,
    }, {
        type: "floatInput",
        name: "iSpecularExponent",
        defaultValue: 21,
        min: -10.,
        max: 100.,
    }, {
        type: "floatInput",
        name: "iBacklightAmount",
        defaultValue: 0.55,
        min: 0.,
        max: 10.,
    }, {
        type: "floatInput",
        name: "iSubsurfaceAmount",
        defaultValue: 0.25,
        min: 0.,
        max: 10.,
    }, {
        type: "floatInput",
        name: "iAmbientOcclusionSamples",
        defaultValue: 5,
        min: 0.,
        max: 100.,
        step: 1.
    }, {
        type: "floatInput",
        name: "iAmbientOcclusionStep",
        defaultValue: 0.12,
        min: 0.,
        max: 2.,
    }, {
        type: "floatInput",
        name: "iAmbientOcclusionScale",
        defaultValue: 0.95,
        min: 0.,
        max: 1.,
    }, {
        type: "floatInput",
        name: "iToneMapExposure",
        defaultValue: 1,
        min: 0.,
        max: 10.,
    }, {
        type: "floatInput",
        name: "iToneCompressedGain",
        defaultValue: -1,
        min: 0.,
        max: 2.,
    }, {
        type: "floatInput",
        name: "iGammaExponent",
        defaultValue: 2.2,
        min: 0.,
        max: 10.,
    }, {
        type: "floatInput",
        name: "iFree0",
        defaultValue: 0,
        min: -9.99,
        max: +9.99,
    }, {
        type: "floatInput",
        name: "iFree1",
        defaultValue: 0,
        min: -9.99,
        max: +9.99,
    }, {
        type: "floatInput",
        name: "iFree2",
        defaultValue: 0,
        min: -9.99,
        max: +9.99,
    }, {
        type: "floatInput",
        name: "iFree3",
        defaultValue: 0,
        min: -9.99,
        max: +9.99,
    }, {
        type: "floatInput",
        name: "iFree4",
        defaultValue: 0,
        min: -9.99,
        max: +9.99,
    }, {
        type: "floatInput",
        name: "iFree5",
        defaultValue: 0,
        min: -9.99,
        max: +9.99,
    } , {
        type: "vec3Input",
        name: "vecFree0",
        defaultValue: [0, 0, 0],
        min: -9.99,
        max: +9.99,
    }, {
        type: "vec3Input",
        name: "vecFree1",
        defaultValue: [0, 0, 0],
        min: -9.99,
        max: +9.99,
    }, {
        type: "vec3Input",
        name: "vecFree2",
        defaultValue: [0, 0, 0],
        min: -9.99,
        max: +9.99,
    }];
}