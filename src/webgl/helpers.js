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

/**
 * Helper function for aspectRatio
 * @param geometry {width, height, aspectRatio} - canvas dimensions, specify any two
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

export function resolutionScaled(newHeight, oldWidth, oldHeight) {
    const resolution = {
        width: Math.floor(newHeight * oldWidth / oldHeight),
        height: Math.floor(newHeight),
    };
    resolution.asVec2 = [resolution.width, resolution.height];
    resolution.texelSize = [1 / resolution.width, 1 / resolution.height];
    return resolution;
}

/**
 * @return {{width, height}}
 */
export function initialOrStoredResolution(canvas, geometry) {
    const canvasRect = canvas.getBoundingClientRect();
    geometry.height = loadStoredResolutionHeight()
        ?? geometry.height
        ?? canvasRect.height;
    if (!geometry.aspectRatio && !geometry.width) {
        geometry.width = canvasRect.width;
    }
    return asResolution(geometry);
}

function loadStoredResolutionHeight() {
    const resolution = JSON.parse(localStorage.getItem("qm.resolution") ?? "null");
    return resolution?.height ?? null;
}

export function storeResolution(width, height) {
    localStorage.setItem("qm.resolution", JSON.stringify({width, height}));
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
    // wir lassen hier das Konzept "Mipmaps" aus, kann man aber mal bei Gelegenheit vertiefen.. :)

    // Laden im Browser notwendigerweise asynchron, flackert dann leider kurz. (< 1 sec)

    // const startLoading = performance.now();

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
        // console.log("Image Loaded in", (performance.now() - startLoading).toFixed(2), "ms");
    });

    return texture;
}

export function createFramebufferWithTexture(gl, options, fbIndex = undefined) {
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
        fbo,
        texture,
        attachments: [colorAttachment],
        extraDataTexture: null,
        // for debugging:
        index: fbIndex,
        status,
        // stored in here because we might need for resizing later
        width,
        height,
        params: {
            width,
            height,
            internalFormat,
            dataFormat,
            dataType,
            colorAttachment,
            wrapS,
            wrapT,
            minFilter,
            magFilter,
        },
    };
}

export function halfFloatOptions(gl, resolution, internalFormat, filter) {
    const dataFormatFor = {
        [gl.R16F]: gl.RED,
        [gl.RG16F]: gl.RG,
        [gl.RGB16F]: gl.RG,
        [gl.RGBA16F]: gl.RGBA,
    };
    const result = {
        ...resolution,
        minFilter: filter,
        maxFilter: filter,
        internalFormat,
        dataFormat: dataFormatFor[internalFormat],
        dataType: gl.HALF_FLOAT,
    };
    if (!result.internalFormat) {
        throw Error(`halfFloatOptions() helper function can not deal with internalFormat ${internalFormat}`);
    }
    return result;
}

export function createPingPongFramebuffersWithTexture(gl, options) {
    const pp = {
        fb: [0, 1].map((index) =>
            createFramebufferWithTexture(gl, options, index)
        ),
        ping: 0,
    };
    pp.pong = () => 1 - pp.ping;
    pp.currentWriteAndRead = () => [
        pp.fb[pp.ping],
        pp.fb[pp.pong()]
    ];
    pp.doPingPong = () => {
        pp.ping = pp.pong();
    }
    return pp;
}

export function recreateFramebufferWithTexture(gl, framebuffer) {
    const old = framebuffer.params;

    // RESOURCE CLEANUP: Not done automatically by OpenGL!
    gl.deleteFramebuffer(framebuffer.fbo);
    gl.deleteTexture(framebuffer.texture);

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, old.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, old.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, old.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, old.wrapT);

    gl.texImage2D(
        gl.TEXTURE_2D, 0, old.internalFormat,
        old.width, old.height,
        0, old.dataFormat, old.dataType,
        null
    );

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, old.colorAttachment, gl.TEXTURE_2D, texture, 0 );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    warnAboutBadFramebufferStatus(gl, status);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
        ...framebuffer,
        fbo,
        texture,
        status,
        extraDataTexture: null,
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

export function takePingPongFramebuffers(state) {
    // "Frame Buffer Ping Pong": wir beschreiben die Framebuffer immer abwechselnd:
    // "ping": write fbo 0, read texture 1
    // "pong": write fbo 1, read texture 0
    // etc.
    const pingIndex = state.frameIndex % 2;
    const pongIndex = 1 - pingIndex;
    return {
        write: state.framebuffer[pingIndex],
        read: state.framebuffer[pongIndex],
    }
}

export function updateResolutionInState(state, glContext) {
    const width = glContext.drawingBufferWidth;
    const height = glContext.drawingBufferHeight;
    state.resolution = [width, height];
    state.texelSize = [1/width, 1/height];
    return {width, height};
}

export function clearFramebuffers(gl, state) {
    state.framebuffer.fb.forEach(fb => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb.fbo);
        gl.viewport(0, 0, fb.width, fb.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

export async function evaluateReadData(buffer, mapFunc = undefined) {
    const isUnsignedByte = buffer instanceof Uint8Array;
    const asFloat = buffer instanceof Float32Array
        ? buffer
        : Float32Array.from(buffer, mapFunc);
    const data = {
        pixels: buffer.length / 4,
        min: rgba(Infinity),
        max: rgba(-Infinity),
        avg: rgba(0),
        span: rgba(0),
        buffer: {
            raw: buffer,
            asFloat,
        },
    };
    for (let i = 0; i < buffer.length; i += 4) {
        for (let c = 0; c < 4; c++) {
            let value = asFloat[i + c];
            if (value < data.min[c]) {
                data.min[c] = value;
            }
            if (value > data.max[c]) {
                data.max[c] = value;
            }
            data.avg[c] += value;
        }
    }
    for (let c = 0; c < 4; c++) {
        data.avg[c] /= data.pixels;
        data.span[c] = data.max[c] - data.min[c];
    }
    data.formatted = {
        avg: toStr(data.avg),
        min: toStr(data.min),
        max: toStr(data.max),
    };
    return data;

    function rgba(value) {
        return [value, value, value, value];
    }

    function toStr(rgba) {
        const list = rgba.map(format).join(", ");
        return `[${list}]`;
    }

    function format(value) {
        if (isUnsignedByte) {
            if (value < 0.001) {
                return " <= 0";
            }
            if (value > 0.999) {
                return " >= 1"
            }
        }
        return value.toFixed(3);
    }
}
