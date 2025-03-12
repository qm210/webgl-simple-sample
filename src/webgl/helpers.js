// we'll get to that, but let's not use these for less confusion
// even though, of course, we all love clean code.

export function createShader(gl, type, source) {
    // this is the usual short form, we do it more verbosely due to educational reasons

    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader), "; Source:", source);
        gl.deleteShader(shader);
        return {shader: null, error};
    }

    return {shader, error: null};
}

export function createProgram(gl, vertexShader, fragmentShader) {
    // this is the usual short form, we do it more verbosely due to educational reasons

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    return program;
}


export function initUniformLocations(gl, state, uniformNames) {
    for (const name of uniformNames) {
        state.location[name] = gl.getUniformLocation(state.program, name);
    }
}

/**
 * Helper function for aspectRatio
 * @param geometry {width, height, aspectRatio} - canvas dimensions, specify either two
 * @return {{width, height}} - the resolution in integer pixels.
 */
export function asResolution({width, height, aspectRatio}) {
    if (aspectRatio) {
        return {
            width: Math.round(height * aspectRatio),
            height: Math.round(height),
        };
    }
    return {
        width: Math.round(width || height * aspectRatio),
        height: Math.round(height ?? width / aspectRatio),
    };
}
