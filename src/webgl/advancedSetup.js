import {createShader} from "./helpers.js";
import {createInitialState} from "./setup.js";

export function compileMultipleFragments(gl, vertexSrc, ...fragmentSrcList) {
    const state = createInitialState(vertexSrc, fragmentSrcList);
    const allShaders = [];

    const v = createShader(gl, gl.VERTEX_SHADER, vertexSrc);
    state.compileStatus.vertex = !v.error;
    state.error.vertex = v.error;
    allShaders.push(v.shader);

    for (const fragmentSrc of fragmentSrcList) {
        const f = createShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);
        state.compileStatus.fragment.push(!f.error);
        state.error.fragment.push(f.error);
        allShaders.push(f.shader);
    }

    console.log("All Shaders:", allShaders);

    const program = gl.createProgram();
    for (const shader of allShaders) {
        if (shader !== null) {
            // can only attach successfully compiled shaders, obviously.
            gl.attachShader(program, shader);
        }
        console.log("attached");
    }
    gl.linkProgram(program);
    state.compileStatus.linker = gl.getProgramParameter(program, gl.LINK_STATUS);
    state.error.linker = gl.getProgramInfoLog(program);
    if (!state.compileStatus.linker) {
        gl.deleteProgram(program);
        return state;
    }

    state.program = program;
    return state;
}
