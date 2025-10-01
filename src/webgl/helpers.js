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

    // Laden im Browser notwendigerweise asynchron.
    // -> wird kurz flackern, aber das akzeptieren wir mal

    loadImage(imageSource, (img) => {
        // -> daher auch: Textur lieber neu binden, weil inzwischen alles mögliche passiert sein kann.
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            img
        );
    });

    return texture;
}

export function createFramebufferWithTexture(gl, options) {
    const width = options?.width ?? gl.drawingBufferWidth;
    const height = options?.height ?? gl.drawingBufferHeight;

    const wrapS = options?.wrapS ?? gl.CLAMP_TO_EDGE;
    const wrapT = options?.wrapT ?? gl.CLAMP_TO_EDGE;
    const minFilter = options?.minFilter ?? gl.LINEAR;
    const magFilter = options?.magFilter ?? gl.LINEAR;

    // Diese Parameter beschreiben den Typ der geschriebenen Pixeldaten.
    // ACHTUNG: Diese müssen aufeinander abgestimmt sein. Wird sonst nicht klappen.
    // https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml
    const internalFormat = options?.internalFormat ?? gl.RGBA8;
    const dataFormat = options?.dataFormat ?? gl.RGBA;
    const dataType = options?.dataType ?? gl.UNSIGNED_BYTE;

    // Attachment beschreiben die Direktverknüpfung zwischen einer Textur und einem Framebuffer
    const colorAttachment = options?.colorAttachment ?? gl.COLOR_ATTACHMENT0;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);

    // Alloziert den Speicher, lässt ihn aber - siehe letztes Argument - leer
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, dataFormat, dataType, null);
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);


    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    // Attachment: Verknüpft Framebuffer fest mit der Textur
    gl.framebufferTexture2D(gl.FRAMEBUFFER, colorAttachment, gl.TEXTURE_2D, texture, 0 );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    warnAboutBadFramebufferStatus(gl, status);

    // Kann (und sollte) jetzt aufgeräumt werden, Attachment gilt weiterhin.
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
        texture,
        fbo,
        status
    };
}

function warnAboutBadFramebufferStatus(gl, status) {
    switch (status) {
        case gl.FRAMEBUFFER_COMPLETE:
            // der Wunschzustand.
            break;
        case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
            console.error('FRAMEBUFFER_INCOMPLETE_ATTACHMENT: Attachment is not renderable');
            break;
        case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
            console.error('FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: No valid attachments');
            break;
        case gl.FRAMEBUFFER_UNSUPPORTED:
            console.error('FRAMEBUFFER_UNSUPPORTED: Combination of internal formats used by attachments is not supported');
            break;
        default:
            console.error('Framebuffer error:', status);
    }
}
