import {startRenderLoop} from "../webgl/render.js";
import {createTextureFromImage} from "../webgl/helpers.js";

import fragmentShaderSource from "../shaders/noisePlayground.glsl";
import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";
import vertexShaderSource from "../shaders/vertex.basic.glsl";
import image0 from "../textures/frame.png";
import image1 from "../textures/hubble_extreme_deep_field.jpg";

export default {
    title: "Texture Playground",
    init: (gl, sources = {}) => {
        createStaticVertexBuffer(
            gl,
            [-1, -1, +1, -1, -1, 1, -1, +1, +1, -1, +1, +1]
        );

        sources.vertex ??= vertexShaderSource;
        sources.fragment ??= fragmentShaderSource;
        const state = compile(gl, sources);
        if (!state.program) {
            return state;
        }
        initVertices(gl, state, "aPosition");
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        state.location.iTime = gl.getUniformLocation(state.program, "iTime");
        state.location.iResolution = gl.getUniformLocation(state.program, "iResolution");
        state.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];

        state.location.iNoiseLevel = gl.getUniformLocation(state.program, "iNoiseLevel");
        state.location.iNoiseFreq = gl.getUniformLocation(state.program, "iNoiseFreq");
        state.location.iNoiseOffset = gl.getUniformLocation(state.program, "iNoiseOffset");
        state.location.iFractionSteps = gl.getUniformLocation(state.program, "iFractionSteps");
        state.location.iFractionScale = gl.getUniformLocation(state.program, "iFractionScale");
        state.location.iFractionAmplitude = gl.getUniformLocation(state.program, "iFractionAmplitude");
        state.location.iFree = gl.getUniformLocation(state.program, "iFree");

        state.texture0 = createTextureFromImage(gl, image0, {
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
        });
        state.texture1 = createTextureFromImage(gl, image1, {
            wrapS: gl.REPEAT,
            wrapT: gl.MIRRORED_REPEAT,
            minFilter: gl.LINEAR,
        });
        state.location.iTexture0 = gl.getUniformLocation(state.program, "iTexture0");
        state.location.iTexture1 = gl.getUniformLocation(state.program, "iTexture1");

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
            defaultValue: 0,
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
            type: "vec3Input",
            name: "iFree",
            defaultValue: [0, 0, 0],
            min: 0,
            max: 1,
        }]
    })
};

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1f(state.location.iNoiseLevel, state.iNoiseLevel);
    gl.uniform1f(state.location.iNoiseFreq, state.iNoiseFreq);
    gl.uniform1f(state.location.iNoiseOffset, state.iNoiseOffset);
    gl.uniform1i(state.location.iFractionSteps, Math.floor(state.iFractionSteps));
    gl.uniform1f(state.location.iFractionScale, state.iFractionScale);
    gl.uniform1f(state.location.iFractionAmplitude, state.iFractionAmplitude);
    gl.uniform3fv(state.location.iFree, state.iFree);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.texture0);
    gl.uniform1i(state.location.iTexture0, 0);
    // <-- letzter Parameter <n> muss zu Texture Unit gl.TEXTURE<n> passen

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.texture1);
    gl.uniform1i(state.location.iTexture1, 1);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
