import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";
import {evaluateReadData} from "../webgl/helpers.js";

const basicVertexShaderSource =
    `#version 300 es

    in vec4 aPosition;
    
    void main() {
        gl_Position = aPosition;
    }`;

export function initBasicState(gl, sources) {
    /**
     *  The common WebGL initialization code for a showcase
     *  with our super-basic vertex shader (rectangle from 2 triangles)
     *  and fragment shader uniforms {iTime, iResolution, iMouse}
     *  but no textures, extra frame buffers etc.
     */
    createStaticVertexBuffer(
        gl,
        [-1, -1, +1, -1, -1, 1, -1, +1, +1, -1, +1, +1]
    );

    sources.vertex ??= basicVertexShaderSource;
    const state = compile(gl, sources);
    if (!state.program) {
        return state;
    }

    initVertices(gl, state, "aPosition");

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(state.program);

    return state;
}

export async function readPixelsAndEvaluate(gl, resolution, resultBuffer, targetElement) {
    const startedAt = performance.now();
    const [width, height] = resolution;
    gl.readPixels(
        0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, resultBuffer
    );
    const readMillis = performance.now() - startedAt;

    // Notiz: Vom Screen ("Back Buffer") können wir nur höchst ungenau die Unsigned Bytes lesen.
    // Für genauere Informationen verwendet man hierfür Framebuffer, aber die heben wir uns noch auf.
    const data = await evaluateReadData(
        resultBuffer,
        byte => (byte / 255)
    );

    const totalMillis = performance.now() - startedAt;
    targetElement.innerHTML = `
            <div class="readout-stats">
                <div>Read Pixel Values (to CPU)</div>
                <div>AVG = ${data.formatted.avg}</div>
                <div>MIN = ${data.formatted.min}</div>
                <div>MAX = ${data.formatted.max}</div>
                <span>See Browser Console for details</span>
            </div>`;
    console.info(
        "Read Data", data,
        "- Reading took", readMillis, "ms,",
        " Total with numerical evaluation", totalMillis, "ms"
    );
}
