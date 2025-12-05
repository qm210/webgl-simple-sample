export function createShader(gl, type, source) {
    let shader = gl.createShader(type);
    let error = "";

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        shader = null;
    }

    return {shader, error};
}

export function collectActiveUniforms(gl, state) {
    // In einfachen Fällen findet man solche Aufrufe entweder im Setup- oder im Rendercode:
    //   state.location.iTime = gl.getUniformLocation(state.program, "iTime");
    //   state.location.iResolution = gl.getUniformLocation(state.program, "iResolution");
    //   state.location.iMouse = gl.getUniformLocation(state.program, "iMouse");
    //   etc...
    // -> seit die Showcases teilweise sehr viele Uniforms haben, lesen wir sie aber immer automatisch:
    // Vorteil: getActiveUniform() sagt uns auch direkt, ob ein uniform überhaupt verwendet (gelesen) wird.
    const uniformCount = gl.getProgramParameter(state.program, gl.ACTIVE_UNIFORMS);
    for (let u = 0; u < uniformCount; u++) {
        const uniform = gl.getActiveUniform(state.program, u);
        state.activeUniforms.push(uniform);
        state.location[uniform.name] = gl.getUniformLocation(state.program, uniform.name);
    }
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
