import {startRenderLoop} from "../webgl/render.js";
import {initBasicState} from "./common.js";
import fragmentShaderSource from "../shaders/raytracingFirstSteps.glsl";

export default {
    title: "Ray Tracing: First Steps",
    init: (gl, sources = {}) => {
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

        // Anmerkung: das ganze Sammeln der Uniform-Locations wird inzwischen
        // innerhalb initBasicState() abgehandelt, war auf Dauer zuviel zu duplizieren...

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
            type: "vec3Input",
            name: "vecDirectionalLight",
            defaultValue: [0.2, -0.4, 0.2],
            min: -10,
            max: 10,
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
            max: 100.,
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
        }]
    })
};

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform4fv(state.location.iMouse, state.iMouse);

    gl.uniform1f(state.location.iLightDirection, state.iLightDirection);

    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
