import {startRenderLoop} from "../webgl/render.js";
import {initBasicState} from "./common.js";
import fragmentShaderSource from "../shaders/raytracingPlusVolumetricMarching.glsl";

export default {
    title: "Ray Tracing: First Steps",
    init: (gl, sources = {}) => {
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

        // Anmerkung: das ganze Sammeln der Uniform-Locations wird inzwischen
        // innerhalb initBasicState() abgehandelt, war auf Dauer zuviel zu duplizieren.
        // Hier kommt also noch, was wir darüber hinaus initialisieren müssen (Texturen, Framebuffer, Sonstiges)

        state.modeDebugRendering = 0;

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
            type: "floatInput",
            name: "iFieldOfViewDegrees",
            defaultValue: 20,
            min: 0.01,
            max: 180,
        }, {
            type: "floatInput",
            name: "iSceneRotation",
            defaultValue: 0,
            min: 0.,
            max: 6.28,
        }, {
            type: "floatInput",
            name: "iScenePitch",
            defaultValue: 0,
            min: -0.5,
            max: 0.5,
        }, {
            type: "vec3Input",
            name: "vecDirectionalLight",
            defaultValue: [0.2, -0.4, 0.2],
            min: -10,
            max: 10,
        }, {
            type: "floatInput",
            name: "iDiffuseAmount",
            defaultValue: 2.2,
            min: 0.,
            max: 10.,
        }, {
            type: "floatInput",
            name: "iSpecularAmount",
            defaultValue: 3.,
            min: 0.,
            max: 10.,
        }, {
            type: "floatInput",
            name: "iSpecularExponent",
            defaultValue: 21,
            min: 0.01,
            max: 100.,
        }, {
            type: "floatInput",
            name: "iHalfwaySpecularMixing",
            defaultValue: 0,
            min: 0.,
            max: 1.,
        }, {
            type: "floatInput",
            name: "iShadowSharpness",
            defaultValue: 8.,
            min: 0.,
            max: 20.,
        }, {
            type: "vec3Input",
            name: "vecSkyColor",
            defaultValue: [0.4, 0.6, 1],
            min: 0,
            max: 1,
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
            max: 20.,
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
            name: "iAmbientOcclusionIterations",
            defaultValue: 5,
            min: 0.,
            max: 100.,
            step: 1.
        }, {
            type: "floatInput",
            name: "iShadowCastIterations",
            defaultValue: 80,
            min: 1,
            max: 200,
            step: 1,
        }, {
            type: "floatInput",
            name: "iRayMarchingIterations",
            defaultValue: 70,
            min: 1,
            max: 200,
            step: 1,
        }, {
            type: "floatInput",
            name: "iRayTracingIterations",
            defaultValue: 1,
            min: 1,
            max: 20,
            step: 1,
        }, {
            type: "button",
            name: "modeDebugRendering",
            label: "Render Debug Values",
            onClick: (button) => {
                state.modeDebugRendering = (state.modeDebugRendering + 1) % 6;
                button.textContent =
                    state.modeDebugRendering === 1
                    ? "Rendering: #bounces / maximum"
                    : state.modeDebugRendering === 2
                    ? "Rendering: #steps / maximum (last marching)"
                    : state.modeDebugRendering === 3
                    ? "Rendering: Marching Distance / maximum"
                    : state.modeDebugRendering === 4
                    ? "Rendering: Remaining Throughput"
                    : state.modeDebugRendering === 5
                    ? "Rendering: #steps volumetric / maximum"
                    : "Rendering: fragColor";
            }
        }, {
            type: "floatInput",
            name: "iMetalReflectance",
            defaultValue: 0.8,
            min: 0.,
            max: 1.,
        }, {
            type: "floatInput",
            name: "iEtaGlassRefraction",
            defaultValue: 1.5,
            min: 0.01,
            max: 10.,
        }, {
            type: "floatInput",
            name: "iCloudsMaxDensity",
            defaultValue: 0.,
            min: 0.0,
            max: 2.,
        }, {
            type: "floatInput",
            name: "iCloudsScaleFactor",
            defaultValue: 0.17,
            min: 0.001,
            max: 2.,
        }, {
            type: "floatInput",
            name: "iCloudsAbsorptionCoeff",
            defaultValue: 0.5,
            min: -1.,
            max: 1.,
        }, {
            type: "floatInput",
            name: "iVolumetricStepIterations",
            defaultValue: 128,
            min: 1,
            max: 1000,
            step: 1
        }, {
            type: "floatInput",
            name: "iVolumetricMarchStep",
            defaultValue: 0.1,
            min: 0.001,
            max: 1,
        }, {
            type: "floatInput",
            name: "iVolumetricAlphaThreshold",
            defaultValue: 0.95,
            min: 0.01,
            max: 1.,
        }, {
            type: "floatInput",
            name: "iGammaCorrection",
            defaultValue: 2.2,
            min: 0.,
            max: 4.,
        }, {
            type: "floatInput",
            name: "iNoiseLevel",
            defaultValue: 0.,
            min: 0.,
            max: 0.5,
        }, {
            type: "floatInput",
            name: "iNoiseFreq",
            defaultValue: 1,
            min: 0.001,
            max: 0.5,
            step: 0.001,
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
            max: 20.,
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
            name: "iCalcNormalEpsilon",
            defaultValue: 0.0005,
            min: 0.00001,
            max: 0.1,
            step: 0.00001,
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
        }]
    })
};

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform4fv(state.location.iMouse, state.iMouse);
    gl.uniform2fv(state.location.iMouseDrag, state.iMouseDrag);
    gl.uniform1f(state.location.iFieldOfViewDegrees, state.iFieldOfViewDegrees);
    gl.uniform1f(state.location.iSceneRotation, state.iSceneRotation);
    gl.uniform1f(state.location.iScenePitch, state.iScenePitch);
    gl.uniform1i(state.location.iRayTracingIterations, state.iRayTracingIterations);
    gl.uniform1i(state.location.iRayMarchingIterations, state.iRayMarchingIterations);
    gl.uniform1i(state.location.iVolumetricStepIterations, state.iVolumetricStepIterations);
    gl.uniform1f(state.location.iVolumetricMarchStep, state.iVolumetricMarchStep);
    gl.uniform1f(state.location.iVolumetricAlphaThreshold, state.iVolumetricAlphaThreshold);
    gl.uniform3fv(state.location.vecDirectionalLight, state.vecDirectionalLight);
    gl.uniform1f(state.location.iDiffuseAmount, state.iDiffuseAmount);
    gl.uniform1f(state.location.iSpecularAmount, state.iSpecularAmount);
    gl.uniform1f(state.location.iSpecularExponent, state.iSpecularExponent);
    gl.uniform1f(state.location.iHalfwaySpecularMixing, state.iHalfwaySpecularMixing);
    gl.uniform1f(state.location.iShadowSharpness, state.iShadowSharpness);
    gl.uniform1f(state.location.iBacklightAmount, state.iBacklightAmount);
    gl.uniform3fv(state.location.vecSkyColor, state.vecSkyColor);
    gl.uniform1f(state.location.iSubsurfaceAmount, state.iSubsurfaceAmount);
    gl.uniform1f(state.location.iAmbientOcclusionScale, state.iAmbientOcclusionScale);
    gl.uniform1f(state.location.iAmbientOcclusionStep, state.iAmbientOcclusionStep);
    gl.uniform1f(state.location.iAmbientOcclusionIterations, state.iAmbientOcclusionIterations);
    gl.uniform1i(state.location.iShadowCastIterations, state.iShadowCastIterations);
    gl.uniform1f(state.location.iMetalReflectance, state.iMetalReflectance);
    gl.uniform1f(state.location.iEtaGlassRefraction, state.iEtaGlassRefraction);
    gl.uniform1f(state.location.iCloudsMaxDensity, state.iCloudsMaxDensity);
    gl.uniform1f(state.location.iCloudsScaleFactor, state.iCloudsScaleFactor);
    gl.uniform1f(state.location.iCloudsAbsorptionCoeff, state.iCloudsAbsorptionCoeff);
    gl.uniform1f(state.location.iGammaCorrection, state.iGammaCorrection);
    gl.uniform1f(state.location.iNoiseLevel, state.iNoiseLevel);
    gl.uniform1f(state.location.iNoiseFreq, state.iNoiseFreq);
    gl.uniform1f(state.location.iNoiseOffset, state.iNoiseOffset);
    gl.uniform1i(state.location.iFractionSteps, state.iFractionSteps);
    gl.uniform1f(state.location.iFractionScale, state.iFractionScale);
    gl.uniform1f(state.location.iFractionAmplitude, state.iFractionAmplitude);
    gl.uniform1f(state.location.iCalcNormalEpsilon, state.iCalcNormalEpsilon);
    gl.uniform1i(state.location.modeDebugRendering, state.modeDebugRendering);
    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
