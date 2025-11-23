import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";

import vertexShaderSource from "../shaders/vertex.basic.glsl";
import fragmentShaderSource from "../shaders/colorPlayground.glsl";
import {startRenderLoop} from "../webgl/render.js";


export default {
    title: "Playground: Color",
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
        state.location.palA = gl.getUniformLocation(state.program, "palA");
        state.location.palB = gl.getUniformLocation(state.program, "palB");
        state.location.palC = gl.getUniformLocation(state.program, "palC");
        state.location.palD = gl.getUniformLocation(state.program, "palD");
        state.location.iWhatever = gl.getUniformLocation(state.program, "iWhatever");
        state.location.iGamma = gl.getUniformLocation(state.program, "iGamma");
        state.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];

        return state;
    },
    generateControls: (gl, state, elements) => ({
        onRender: () =>
            startRenderLoop(state => render(gl, state), state, elements),
        uniforms: [{
            type: "float",
            name: "iSaturationOrChroma",
            defaultValue: 0.5,
            min: 0,
            max: 1,
        }, {
            type: "float",
            name: "iValueOrLightnessOrPerceptualBrightness",
            defaultValue: 0.5,
            min: 0,
            max: 1,
        }, {
            type: "bool",
            name: "demoRainbowRing",
            group: "demo",
            description: "HSV-Rainbow left, OkLCh right (use uniforms above)",
            defaultValue: true,
        }, {
            type: "bool",
            name: "demoHsvHsl",
            group: "demo",
            description: "H = Polarwinkel, S = Abstand von Mitte. V/L über Uniform iValueOrL...",
            defaultValue: false,
        }, {
            type: "bool",
            name: "demoHsvOklch",
            group: "demo",
            description: "Analog zur letzten Zeile. Chroma ist ähnlich Sättigung " +
                "(referenziert den \"Gehalt an Farbpigmenten\" vgl. zu Weiß), geht aber nur bis 0.37",
            defaultValue: false,
        }, {
            type: "bool",
            name: "demoCosinePalette",
            group: "demo",
            description: "die Palette wird dann durch die 12 Einträge in palA...palD gebildet.\n" +
                " Links direkt, Rechts mit Tone Mapping + Gammakorrektur.",
            defaultValue: false,
        }, {
            type: "vec3",
            name: "palA",
            defaultValue: [0.5, 0.5, 0.5],
            min: 0,
            max: 1
        }, {
            type: "vec3",
            name: "palB",
            defaultValue: [0.5, 0.5, 0.5],
            min: 0,
            max: 1
        }, {
            type: "vec3",
            name: "palC",
            defaultValue: [0.5, 0.5, 0.5],
            min: 0,
            max: 1
        }, {
            type: "vec3",
            name: "palD",
            defaultValue: [0.5, 0.5, 0.5],
            min: 0,
            max: 1
        }, {
            type: "float",
            name: "iToneMapping",
            defaultValue: 0,
            min: 0,
            max: 1,
        }, {
            type: "float",
            name: "iGamma",
            defaultValue: 2.20,
            min: 0.001,
            max: 10.,
            step: 0.001
        }]
    })
}

function render(gl, state) {
    gl.useProgram(state.program);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1f(state.location.iSaturationOrChroma, state.iSaturationOrChroma);
    gl.uniform1f(state.location.iValueOrLightnessOrPerceptualBrightness, state.iValueOrLightnessOrPerceptualBrightness);
    gl.uniform3fv(state.location.palA, state.palA);
    gl.uniform3fv(state.location.palB, state.palB);
    gl.uniform3fv(state.location.palC, state.palC);
    gl.uniform3fv(state.location.palD, state.palD);
    gl.uniform1f(state.location.iGamma, state.iGamma);
    gl.uniform1f(state.location.iToneMapping, state.iToneMapping);
    gl.uniform1i(state.location.demoHsvHsl, state.demoHsvHsl);
    gl.uniform1i(state.location.demoHsvOklch, state.demoHsvOklch);
    gl.uniform1i(state.location.demoCosinePalette, state.demoCosinePalette);
    gl.uniform1i(state.location.demoRainbowRing, state.demoRainbowRing);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
