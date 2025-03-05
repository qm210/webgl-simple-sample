/**
 *
 * @param canvas - You need a <canvas> element to initialize WebGl context
 *                 Also, your browser needs to support this.
 *                 See: https://caniuse.com/webgl2
 *                 Fallback: https://caniuse.com/webgl
 * @param width - canvas width in pixels
 * @param aspectRatio - rather than height, specify aspect ratio because we're so hip
 */

export function setupWebGl(canvas, width, aspectRatio) {

    const gl = canvas.getContext("webgl2");
    // LEFT OUT: one would check here whether WebGL2 is even supported

    const height = Math.round(width / aspectRatio);
    gl.canvas.width = width;
    gl.canvas.height = height;
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

function createInitialState(vertexSrc, fragmentSrc) {
    return {
        source: {
            vertex: vertexSrc,
            fragment: fragmentSrc,
        },
        error: {
            vertex: "",
            fragment: "",
            linker: "",
        },
        compileStatus: {
            vertex: undefined,
            fragment: undefined,
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
    const result = createInitialState(vertexSrc, fragmentSrc);

    // we do it as verbose as it's usually done - i.e. yes, this could be cleaner.

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexSrc);
    gl.compileShader(vertexShader);
    result.compileStatus.vertex = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
    result.error.vertex = gl.getShaderInfoLog(vertexShader);
    if (!result.compileStatus.vertex) {
        gl.deleteShader(vertexShader);
        // NOTE: vertexShader is now unusuable ...
    }
    // NOTE: ... but we don't need it further anyway ;)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentSrc);
    gl.compileShader(fragmentShader);
    result.compileStatus.fragment = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
    result.error.fragment = gl.getShaderInfoLog(fragmentShader);
    if (!result.compileStatus.fragment) {
        gl.deleteShader(fragmentShader);
    }

    // Note: these single error checks are only useful for demonstration, we wouldn't get far anyway
    const program = gl.createProgram();
    if (!result.error.vertex) {
        gl.attachShader(program, vertexShader);
    }
    if (!result.error.fragment) {
        gl.attachShader(program, fragmentShader);
    }
    gl.linkProgram(program);
    result.compileStatus.linker = gl.getProgramParameter(program, gl.LINK_STATUS);
    result.error.linker = gl.getProgramInfoLog(program);
    if (!result.compileStatus.linker) {
        gl.deleteProgram(program);
        return result;
    }
    // Note: usually, we only read the getProgramInfoLog when one of the parameters is false

    result.program = program;

    console.log("What we have after initialization:", result);

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
