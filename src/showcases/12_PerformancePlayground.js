import {startRenderLoop} from "../webgl/render.js";
import {createFramebufferWithTexture} from "../webgl/helpers.js";

import fragmentShaderSource from "../shaders/performancePlayground.glsl";
import {initBasicState} from "./common.js";

export default {
    title: "Performance Considerations",
    init: (gl, sources = {}) => {
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

        gl.ext.timer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
        if (!gl.ext.timer) {
            console.error("For querying, we need the \"EXT_disjoint_timer_query_webgl2\" WebGL2 extension.");
        }

        state.framebuffer = [0, 1].map(() =>
            createFramebufferWithTexture(gl, {
                width: gl.drawingBufferWidth,
                height: gl.drawingBufferHeight,
                colorAttachment: gl.COLOR_ATTACHMENT0,
            })
        );
        state.location.texture = [
            state.location.textureA,
            state.location.textureB
        ];
        state.query = {
            obj: [
                gl.createQuery(),
                gl.createQuery()
            ],
            doExecute: false,
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
            type: "button",
            name: "executeQueries",
            label: "Query Rendering",
            onClick: () => {
                state.query.doExecute = true;
            }
        }, {
            type: "int",
            name: "iQueryRepetitions",
            defaultValue: 10000,
            min: 1,
            max: 500_000,
            log: true
        }, {
            type: "float",
            name: "iResultMin",
            defaultValue: 0,
        }, {
            type: "float",
            name: "iResultMax",
            defaultValue: 1,
        }, {
            type: "float",
            name: "iCutoffMin",
            defaultValue: -3,
            min: -3,
            max: 3
        }, {
            type: "float",
            name: "iCutoffMax",
            defaultValue: 3,
            min: -3,
            max: 3
        }, {
            type: "float",
            name: "iScale",
            defaultValue: 1,
            min: 0.001,
            max: 100,
            log: true,
        }, {
            type: "float",
            name: "iStepLength",
            defaultValue: 0.1,
            min: 0.001,
            max: 1,
        }, {
            type: "int",
            name: "iStepIterations",
            defaultValue: 10,
            min: 1,
            max: 999,
        }, {
            type: "float",
            name: "iShenanigans",
            defaultValue: 1,
            min: 0.01,
            max: 10,
            log: true,
        }]
    })
};

function render(gl, state) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1i(state.location.iFrame, state.frameIndex);

    gl.uniform1f(state.location.iResultMin, state.iResultMin);
    gl.uniform1f(state.location.iResultMax, state.iResultMax);
    gl.uniform1f(state.location.iCutoffMin, state.iCutoffMin);
    gl.uniform1f(state.location.iCutoffMax, state.iCutoffMax);
    gl.uniform1f(state.location.iScale, state.iScale);
    gl.uniform1f(state.location.iStepLength, state.iStepLength);
    gl.uniform1i(state.location.iStepIterations, state.iStepIterations);
    gl.uniform1f(state.location.iShenanigans, state.iShenanigans);

    state.framebuffer.forEach((fb, index) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb.fbo);
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.uniform1i(state.location.iPassIndex, index);

        if (state.query.doExecute) {
            gl.uniform1i(state.location.iQueryRepetitions, state.iQueryRepetitions);
            gl.beginQuery(gl.ext.timer.TIME_ELAPSED_EXT, state.query.obj[index]);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.endQuery(gl.ext.timer.TIME_ELAPSED_EXT);
        } else {
            gl.uniform1i(state.location.iQueryRepetitions, 1);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
    });

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    state.framebuffer.forEach((fb, index) => {
        gl.activeTexture(gl.TEXTURE0 + index);
        gl.bindTexture(gl.TEXTURE_2D, fb.texture);
        gl.uniform1i(state.location.texture[index], index);
    });
    gl.uniform1i(state.location.iPassIndex, -1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    checkQueries(gl, state);
}

function checkQueries(gl, state) {
    if (!state.query.doExecute) {
        return;
    }
    state.query.doExecute = false;

    Promise.all(
        state.query.obj.map((query, index) =>
            evaluateQuery(query, gl)
                .then(time => {
                    console.log("Query Pass", index, "took", time / state.iQueryRepetitions, "ns per repetition");
                    return time;
                })
        )
    ).then(time => {
        console.log("Query Pass 0 over 1 Ratio:", time[0] / time[1]);
    })
}

async function evaluateQuery(query, gl) {
    while (true) {
        const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
        const disjoint = gl.getParameter(gl.ext.timer.GPU_DISJOINT_EXT);
        if (available && !disjoint) {
            return gl.getQueryParameter(query, gl.QUERY_RESULT);
        }
        await new Promise(requestAnimationFrame);
    }
}
