import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

import vertexShaderSource from "../shaders/playground.vertex.glsl";
import fragmentShaderSource from "../shaders/colorPlayground.glsl";
import {startRenderLoop} from "../webgl/render.js";


export default {
    title: "Playground: Color",
    init: (gl) => {
        createStaticVertexBuffer(
            gl,
            [-1, -1, +1, -1, -1, 1, -1, +1, +1, -1, +1, +1]
        );

        const state = compile(gl, vertexShaderSource, fragmentShaderSource);
        if (!state.program) {
            return state;
        }

        initVertices(gl, state, "aPosition");

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        state.location.iTime = gl.getUniformLocation(state.program, "iTime");
        state.location.iResolution = gl.getUniformLocation(state.program, "iResolution");
        state.location.palA = gl.getUniformLocation(state.program, "palA");
        state.location.palB = gl.getUniformLocation(state.program, "palB");
        state.location.palC = gl.getUniformLocation(state.program, "palC");
        state.location.palD = gl.getUniformLocation(state.program, "palD");
        state.location.iWhatever = gl.getUniformLocation(state.program, "iWhatever");
        state.location.iGamma = gl.getUniformLocation(state.program, "iGamma");
        state.location.iSeed = gl.getUniformLocation(state.program, "iSeed");
        state.location.iNoiseFreq = gl.getUniformLocation(state.program, "iNoiseFreq");
        state.location.iNoiseAmp = gl.getUniformLocation(state.program, "iNoiseAmp");
        state.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];

        console.log(state);

        return state;
    },
    generateControls: (gl, state, elements) => ({
        onRender: () =>
            startRenderLoop(state => render(gl, state), state, elements),
        uniforms: [{
            type: "label",
            name: "iTime",
        }, {
            type: "vec3Input",
            name: "palA",
            defaultValue: [0.5, 0.5, 0.5],
            min: 0,
            max: 1
        }, {
            type: "vec3Input",
            name: "palB",
            defaultValue: [0.5, 0.5, 0.5],
            min: 0,
            max: 1
        }, {
            type: "vec3Input",
            name: "palC",
            defaultValue: [0.5, 0.5, 0.5],
            min: 0,
            max: 1
        }, {
            type: "vec3Input",
            name: "palD",
            defaultValue: [0.5, 0.5, 0.5],
            min: 0,
            max: 1
        }, {
            type: "floatInput",
            name: "iGamma",
            defaultValue: 1.00,
            min: 0.001,
            max: 10.,
            step: 0.001
        }, {
            type: "floatInput",
            name: "iSeed",
            defaultValue: 0,
        }, {
            type: "floatInput",
            name: "iWhatever",
            defaultValue: 1.00,
            min: 0,
            max: 10.,
        }]
    })
}

function render(gl, state) {
    gl.useProgram(state.program);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform3fv(state.location.palA, state.palA);
    gl.uniform3fv(state.location.palB, state.palB);
    gl.uniform3fv(state.location.palC, state.palC);
    gl.uniform3fv(state.location.palD, state.palD);
    gl.uniform1f(state.location.iWhatever, state.iWhatever);
    gl.uniform1f(state.location.iGamma, state.iGamma);
    gl.uniform1f(state.location.iSeed, state.iSeed);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
