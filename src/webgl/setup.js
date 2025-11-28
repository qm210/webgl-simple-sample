import {createShader, initialOrStoredResolution, storeResolution} from "./helpers.js";
import {maybeAdjustForCompatibility} from "./compatibility.js";
import {loadExtensions} from "./extensions.js";

/**
 *
 * @param canvas - You need a <canvas> element to initialize WebGl context
 *                 Also, your browser needs to support this.
 *                 See: https://caniuse.com/webgl2
 * @param geometry {{width, height, aspectRatio}} - canvas dimensions, specify either two
 */

export function setupWebGl(canvas, geometry) {

    const gl = canvas.getContext("webgl2");
    if (!gl) {
        window.alert("We need WebGL2 and your Browser does not support that, sadly.");
        // now the rest will fail badly, but that doesn't matter for me now,
        // because the application can not be used either way -- we need WebGL2!
        // https://caniuse.com/webgl2
    }

    gl.ext = {};
    gl.timer = {};
    // Grafikprogrammierung ist (egal welche Grafik-API man zugrundelegt) recht hardwareabhängig,
    // und WebGL2 ist ein Kompromiss zwischen Grundvoraussetzungen, die man inzwischen von den
    // meisten real verwendeten Grafikkarten verlangen kann.
    // Einige Grundfunktionen sind aber erst durch das Nachladen spezifischer "Extensions" verfügbar,
    // die zwar auch in den meisten Geräten verfügbar sind, aber das gilt es extra zu überprüfen.
    // Wer hier Fehlermeldungen in der Browser-Konsole findet -> besprechen wir dann im Einzelfall.
    // Manche Extensions sind für manche der Showcases unabdingbar, andere nur nice-to-have.
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Using_Extensions
    loadExtensions(gl, [
        "EXT_color_buffer_float",
        "OES_texture_float_linear",
        "KHR_parallel_shader_compile",
        "EXT_disjoint_timer_query_webgl2"
    ]);

    const {width, height} = initialOrStoredResolution(canvas, geometry);
    setCanvasResolution(canvas, gl, width, height);
    return gl;
}

export function setCanvasResolution(canvas, glContext, width, height) {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    // TODO: need to think about window.devicePixelRatio here?
    canvas.width = width;
    canvas.height = height;
    glContext.viewport(0, 0, width, height);
    storeResolution(width, height);
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
        activeUniforms: [],
        location: {},
        framebuffer: [],
        createdAt: performance.now(),
    };
}

/**
 *
 * @param gl - the WebGl context (browser needs to support this)
 * @param {{vertex: string, fragment, string}} sources - the Fragment and Vertex Shader Source
 */
export function compile(gl, sources) {
    const result = createInitialState(sources);
    result.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];

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

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        result.error.linker = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        return result;
    }
    result.program = program;
    result.compiledMillis = performance.now() - result.createdAt;
    console.info("Shader Program Compiled in", +result.compiledMillis.toFixed(3), "ms");

    collectActiveUniforms(gl, result);
    return result;
}

export function initVertices(gl, state, variableName) {
    if (!state.program) {
        throw Error("initVertices() needs a working state.program");
    }

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

function collectActiveUniforms(gl, state) {
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
