import {startRenderLoop} from "../webgl/render.js";
import {initBasicState} from "./common.js";
import fragmentShaderSource from "../shaders/raymarchingPrimitivesSimplified.glsl";

export default {
    title: "Ray Marching: Primitives",
    init: (gl, sources = {}) => {
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

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
            type: "float",
            name: "iFocalLength",
            defaultValue: 2.5,
            min: 0.001,
            max: 20,
        }, {
            type: "vec3",
            name: "iCameraTargetOffset",
            defaultValue: [0, 0, 0],
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iCameraCenterDistance",
            defaultValue: 4.5,
            min: 0.01,
            max: 10,
        }, {
            type: "float",
            name: "iCameraHeight",
            defaultValue: 2.1,
            min: 0.01,
            max: 10,
        }, {
            type: "float",
            name: "iCameraRotationFrequency",
            defaultValue: 0.02,
            min: 0,
            max: 1,
        }, {
            type: "float",
            name: "iCameraRotationAngle",
            defaultValue: 0,
            min: 0,
            max: 6.283,
        }, {
            type: "vec3",
            name: "vecDirectionalLight",
            defaultValue: [-0.4, 0.8, -0.4],
            min: -1,
            max: 1,
            normalize: true
        }, {
            type: "float",
            name: "iDiffuseAmount",
            defaultValue: 2.2,
            min: 0,
            max: 20,
        }, {
            type: "float",
            name: "iSpecularAmount",
            defaultValue: 1.0,
            min: 0,
            max: 20,
        }, {
            type: "float",
            name: "iSpecularExponent",
            defaultValue: 20,
            min: 0.01,
            max: 100,
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
        }, {
            type: "float",
            name: "iFree5",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree6",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree7",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree8",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree9",
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

    gl.uniform1f(state.location.iFocalLength, state.iFocalLength);
    gl.uniform3fv(state.location.iCameraTargetOffset, state.iCameraTargetOffset);
    gl.uniform1f(state.location.iCameraCenterDistance, state.iCameraCenterDistance);
    gl.uniform1f(state.location.iCameraHeight, state.iCameraHeight);
    gl.uniform1f(state.location.iCameraRotationFrequency, state.iCameraRotationFrequency);
    gl.uniform1f(state.location.iCameraRotationAngle, state.iCameraRotationAngle);
    gl.uniform3fv(state.location.vecDirectionalLight, state.vecDirectionalLight);

    gl.uniform1f(state.location.iDiffuseAmount, state.iDiffuseAmount);
    gl.uniform1f(state.location.iSpecularAmount, state.iSpecularAmount);
    gl.uniform1f(state.location.iSpecularExponent, state.iSpecularExponent);

    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);
    gl.uniform1f(state.location.iFree5, state.iFree5);
    gl.uniform1f(state.location.iFree6, state.iFree6);
    gl.uniform1f(state.location.iFree7, state.iFree7);
    gl.uniform1f(state.location.iFree8, state.iFree8);
    gl.uniform1f(state.location.iFree9, state.iFree9);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
