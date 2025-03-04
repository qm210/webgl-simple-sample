/**
 *
 * @param canvas - You need a <canvas> element to initialize WebGl context
 *                 Also, your browser needs to support this.
 *                 See: https://caniuse.com/webgl2
 *                 Fallback: https://caniuse.com/webgl
 */
export function setupWebGl(canvas, width, aspectRatio) {

    const gl = canvas.getContext("webgl2");
    // LEFT OUT: one would check here whether WebGL2 is even supported

    const height = Math.round(width / aspectRatio);
    gl.canvas.width = width;
    gl.canvas.height = height;
    gl.viewport(0, 0, width, height);

    // QUESTION: what the hell is this?
    const positions = new Float32Array([
        -1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1
    ]);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    return gl;
}

/**
 *
 * @param gl - the WebGl context (browser needs to support this)
 * @param vertexSrc - the Vertex Shader Source
 * @param fragmentSrc - the Fragment Shader Source
 */
export function initShaders(gl, vertexSrc, fragmentSrc) {
    const result = {
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

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    result.compileStatus.linker = gl.getProgramParameter(program, gl.LINK_STATUS);
    result.error.linker = gl.getProgramInfoLog(program);
    if (!result.compileStatus.linker) {
        gl.deleteProgram(program);
        return result;
    }
    // Note: usually, we only read the getProgramInfoLog when one of the parameters is false

    result.location.aPosition = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(result.location.aPosition);
    gl.vertexAttribPointer(result.location.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    result.program = program;

    return result;
}
