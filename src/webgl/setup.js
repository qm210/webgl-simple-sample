import {asResolution} from "./helpers.js";

/**
 * @param canvas - You need a <canvas> element to initialize WebGl context
 *                 Also, your browser needs to support this.
 *                 See: https://caniuse.com/webgl2
 *                 Fallback: https://caniuse.com/webgl
 * @param geometry {width, height, aspectRatio} - canvas dimensions, specify either two
 */
export function setupWebGl(canvas, geometry) {

    const gl = canvas.getContext("webgl2");
    // LEFT OUT: one would check here whether WebGL2 is even supported

    const canvasRect = canvas.getBoundingClientRect();
    if (!geometry.height) {
        geometry.height = canvasRect.height;
    }
    const {width, height} = asResolution(geometry);
    canvas.width = width;
    canvas.height = height;
    gl.viewport(0, 0, width, height);

    // note: canvas is now also passed as gl.canvas

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

export function createInitialState(vertexSrc, fragmentSrc) {
    // note: as of 2025/03/11, fragmentSrc can now be either one or an array of multiple fragment shader sources
    // this is for compatibility of the old versions:
    if (!(fragmentSrc instanceof Array)) {
        fragmentSrc = [fragmentSrc];
    }

    return {
        numberFragmentShaders: fragmentSrc.length,
        source: {
            vertex: vertexSrc,
            fragment: fragmentSrc,
        },
        error: {
            vertex: "",
            fragment: [],
            linker: "",
        },
        compileStatus: {
            vertex: undefined,
            fragment: [],
            linker: undefined,
        },
        program: undefined,
        location: {},
    };
}

/**
 *
 * @param gl - the WebGl context (browser needs to support this)
 * @param vertexSrc - the Vertex Shader Source
 * @param fragmentSrc - the Fragment Shader Source
 */
export function compile(gl, vertexSrc, fragmentSrc) {
    const state = createInitialState(vertexSrc, fragmentSrc);

    // we do it as verbose as it's usually done - i.e. yes, this could be cleaner. is not, on purpose.

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSrc);
    gl.compileShader(vertexShader);
    state.compileStatus.vertex = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
    state.error.vertex = gl.getShaderInfoLog(vertexShader);
    if (!state.compileStatus.vertex) {
        gl.deleteShader(vertexShader);
        // NOTE: vertexShader is now unusuable ...
    }
    // ... but we wouldn't need it further anyway ;)

    // Note -- changed after VL3:
    // state now supports multiple fragment shaders, but this routine still uses just one.
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSrc);
    gl.compileShader(fragmentShader);
    state.compileStatus.fragment[0] = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
    state.error.fragment[0] = gl.getShaderInfoLog(fragmentShader);
    if (!state.compileStatus.fragment[0]) {
        gl.deleteShader(fragmentShader);
    }

    // Note: these single error checks are only useful for demonstration
    // usually, one would throw an error earlier.
    const program = gl.createProgram();
    if (!state.error.vertex) {
        gl.attachShader(program, vertexShader);
    }
    if (!state.error.fragment[0]) {
        gl.attachShader(program, fragmentShader);
    }
    gl.linkProgram(program);
    state.compileStatus.linker = gl.getProgramParameter(program, gl.LINK_STATUS);
    state.error.linker = gl.getProgramInfoLog(program);
    if (!state.compileStatus.linker) {
        gl.deleteProgram(program);
        return state;
    }
    // Note: usually, we only read the getProgramInfoLog when one of the parameters is false

    state.program = program;
    return state;
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

