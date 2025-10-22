import {asResolution, createShader} from "./helpers.js";
import {maybeAdjustForCompatibility} from "./compatibility.js";

/**
 *
 * @param canvas - You need a <canvas> element to initialize WebGl context
 *                 Also, your browser needs to support this.
 *                 See: https://caniuse.com/webgl2
 * @param geometry {width, height, aspectRatio} - canvas dimensions, specify either two
 */

export function setupWebGl(canvas, geometry) {

    const gl = canvas.getContext("webgl2");
    if (!gl) {
        window.alert("We need WebGL2 and your Browser does not support that, sadly.");
        // now the rest will fail badly, but that doesn't matter for me now,
        // because the application can not be used either way -- we need WebGL2!
        // https://caniuse.com/webgl2
    }

    // WebGL2-spezifisch müsen manche Erweiterungen für manche Anwendungszwecke nachgeladen werden,
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Using_Extensions
    // wir brauchen hier erstmal nur:
    const WEBGL_EXTENSIONS = ["EXT_color_buffer_float"];
    gl.ext = {};
    for (const extension of WEBGL_EXTENSIONS) {
        const ext = gl.getExtension(extension);
        if (!ext) {
            console.warn("Extension not available:", extension);
        }
        gl.ext[extension] = ext;
    }
    // <-- kann man als Anfänger ignorieren, aber wir brauchen das später für Float-Texturen / Framebuffer

    const canvasRect = canvas.getBoundingClientRect();
    if (!geometry.height) {
        geometry.height = canvasRect.height;
    }
    const {width, height} = asResolution(geometry);
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);

    return gl;
}

export function createStaticVertexBuffer(gl, vertexArray) {
    const positions = new Float32Array(vertexArray);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    return buffer;
}

export function createStaticIndexBuffer(gl, indexArray) {
    const indices = new Uint16Array(indexArray);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    return buffer;
}

function createInitialState(sources) {
    sources.fragment = maybeAdjustForCompatibility(sources.fragment);
    return {
        source: {
            vertex: sources.vertex,
            fragment: sources.fragment,
        },
        error: {
            vertex: "",
            fragment: "",
            linker: "",
        },
        program: undefined,
        location: {},
    };
}

/**
 *
 * @param gl - the WebGl context (browser needs to support this)
 * @param {{vertex: string, fragment, string}} sources - the Fragment and Vertex Shader Source
 */
export function compile(gl, sources) {

    const result = createInitialState(sources);

    const v = createShader(gl, gl.VERTEX_SHADER, sources.vertex);
    result.error.vertex = v.error;

    const f = createShader(gl, gl.FRAGMENT_SHADER, sources.fragment);
    result.error.fragment = f.error;

    const program = gl.createProgram();
    if (!v.error) {
        gl.attachShader(program, v.shader);
    }
    if (!f.error) {
        gl.attachShader(program, f.shader);
    }
    gl.linkProgram(program);
    result.error.linker = gl.getProgramInfoLog(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        return result;
    }

    result.program = program;
    return result;
}


export function initVertices(gl, state, variableName) {
    // Note: state.program needs to exist here!

    // ... now... more of that stuff with all the parameters and the stuff?
    state.location.aPosition = gl.getAttribLocation(state.program, variableName);
    gl.enableVertexAttribArray(state.location.aPosition);
    gl.vertexAttribPointer(
        state.location.aPosition,
        2,
        gl.FLOAT,
        false,
        0,
        0
    );
}
