// we'll get to that, but let's not use these for less confusion
// even though, of course, we all love clean glslCode.


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

export function createProgram(gl, vertexShader, fragmentShader) {
    let program = gl.createProgram();
    let error = "";

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        error = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        program = null;
    }

    return {program, error};
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


export function loadImage(imageSource, onLoad) {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.src = imageSource;
    return img;
}

export function createTextureFromImage(gl, imageSource, options) {
    const wrapS = options?.wrapS ?? gl.CLAMP_TO_EDGE;
    const wrapT = options?.wrapT ?? gl.CLAMP_TO_EDGE;
    const minFilter = options?.minFilter ?? gl.LINEAR;
    const magFilter = options?.magFilter ?? gl.LINEAR;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // S, T: Koordinaten in Texture-Space
    // Wrap: CLAMP_TO_EDGE, REPEAT, MIRRORED_REPEAT (in ES / WebGl: no border colors)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    // Filter: LINEAR, NEAREST
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    // <-- TEXTURE_MAG_FILTER kann auch ausgelassen werden, ist aber oft sinnvoll.
    // wir lass hier Mipmaps aus, aber es sei erwähnt, dass sie existieren.

    // asynchron -> wird erst kurz nach laden aktualisiert, aber das akzeptieren wir mal.
    loadImage(imageSource, (img) => {
        // muss Textur neu binden, weil inzwischen alles mögliche passiert sein kann.
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            img
        )
    });

    return texture;
}

function createFrameBufferWithTexture(gl) {
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // <-- format gl.FLOAT could look like the following (see tables at https://registry.khronos.org/OpenGL-Refpages/es3.1/)
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGB, gl.FLOAT, null);
    // but throws one of these:
    // [.WebGL-0x1dd400107100] GL_INVALID_FRAMEBUFFER_OPERATION: Framebuffer is incomplete: Attachment is not renderable.
    // [.WebGL-0x1dd402129400] GL_INVALID_FRAMEBUFFER_OPERATION: Framebuffer is incomplete: Attachment has zero size.

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // ... now the texture is the framebuffer's render target, shouldn't need bindTexture again:
    gl.bindTexture(gl.TEXTURE_2D, null);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        console.error("[GL][CREATE_FBO] not complete:", status);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
        texture,
        fbo,
        status
    };
}
