import {startRenderLoop} from "../webgl/render.js";
import {initBasicState} from "./common.js";
import {createTextureFromImage} from "../webgl/helpers.js";
import fragmentShaderSource from "../shaders/raymarchingPlusVariousConcepts.glsl";
import imageFrame from "../textures/frame.png";
import imageSpace from "../textures/hubble_extreme_deep_field.jpg";

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

        state.location.texFrame = gl.getUniformLocation(state.program, "texFrame");
        state.location.texSpace = gl.getUniformLocation(state.program, "texSpace");
        state.location.iCamOrigin = gl.getUniformLocation(state.program, "iCamOrigin");
        state.location.iCamLook = gl.getUniformLocation(state.program, "iCamLook");
        state.location.iCamRoll = gl.getUniformLocation(state.program, "iCamRoll");
        state.location.iCamFocalLength = gl.getUniformLocation(state.program, "iCamFocalLength");
        state.location.iPathProgress = gl.getUniformLocation(state.program, "iPathProgress");
        state.location.iFree0 = gl.getUniformLocation(state.program, "iFree0");
        state.location.iFree1 = gl.getUniformLocation(state.program, "iFree1");
        state.location.iFree2 = gl.getUniformLocation(state.program, "iFree2");
        state.location.iFree3 = gl.getUniformLocation(state.program, "iFree3");
        state.location.iFree4 = gl.getUniformLocation(state.program, "iFree4");
        state.location.iFree5 = gl.getUniformLocation(state.program, "iFree5");
        state.location.vecFree0 = gl.getUniformLocation(state.program, "vecFree0");
        state.location.vecFree1 = gl.getUniformLocation(state.program, "vecFree1");
        state.location.vecFree2 = gl.getUniformLocation(state.program, "vecFree2");
        state.location.vecFree3 = gl.getUniformLocation(state.program, "vecFree3");
        state.location.vecFree4 = gl.getUniformLocation(state.program, "vecFree4");
        state.location.vecFree5 = gl.getUniformLocation(state.program, "vecFree5");

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

    gl.uniform3fv(state.location.iCamOrigin, state.iCamOrigin);
    gl.uniform3fv(state.location.iCamLook, state.iCamLook);
    gl.uniform1f(state.location.iCamRoll, state.iCamRoll);
    gl.uniform1f(state.location.iCamFocalLength, state.iCamFocalLength);
    gl.uniform1f(state.location.iPathProgress, state.iPathProgress);

    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);
    gl.uniform1f(state.location.iFree5, state.iFree5);
    gl.uniform3fv(state.location.vecFree0, state.vecFree0);
    gl.uniform3fv(state.location.vecFree1, state.vecFree1);
    gl.uniform3fv(state.location.vecFree2, state.vecFree2);
    gl.uniform3fv(state.location.vecFree3, state.vecFree3);
    gl.uniform3fv(state.location.vecFree4, state.vecFree4);
    gl.uniform3fv(state.location.vecFree5, state.vecFree5);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function defineUniformControlsBelow() {
    return [{
        type: "cursorInput",
        name: "iCamOrigin",
        keys: ["w", "a", "s", "d", "r", "f", "q"],
        defaultValue: [-0.75, 1.5, 3],
        step: 0.25,
    }, {
        type: "vec3Input",
        name: "iCamLook",
        defaultValue: [0.34, -0.34, -0.84],
        min: -1,
        max: +1,
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
        type: "floatInput",
        name: "iPathProgress",
        defaultValue: 0,
        min: 0.,
        max: 2.,
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
    }, {
        type: "vec3Input",
        name: "vecFree3",
        defaultValue: [0, 0, 0],
        min: -9.99,
        max: +9.99,
    }, {
        type: "vec3Input",
        name: "vecFree4",
        defaultValue: [0, 0, 0],
        min: -9.99,
        max: +9.99,
    }, {
        type: "vec3Input",
        name: "vecFree5",
        defaultValue: [0, 0, 0],
        min: -9.99,
        max: +9.99,
    }];
}