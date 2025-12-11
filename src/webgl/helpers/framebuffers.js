export function createFramebufferWithTexture(gl, options, fbIndex = undefined) {
    const opt = options ?? {};
    opt.width ??= gl.drawingBufferWidth;
    opt.height ??= gl.drawingBufferHeight;

    opt.wrapS ??= gl.CLAMP_TO_EDGE;
    opt.wrapT ??= gl.CLAMP_TO_EDGE;
    opt.minFilter ??= gl.LINEAR;
    opt.magFilter ??= gl.LINEAR;

    // siehe Anmerkung der Datentyp-Parameter in der Textur-Erstellung (weiter oben)
    opt.internalFormat ??= gl.RGBA8;
    opt.dataFormat ??= gl.RGBA;
    opt.dataType ??= gl.UNSIGNED_BYTE;

    // Attachment beschreibt die Direktverknüpfung zwischen einer Textur und einem Framebuffer,
    // er könnte auch über mehrere Color-Attachments mehrere Texturen haben, außerdem gibt es
    // da noch andere Arten von Attachments, die wir in der Vorlesung aber nicht brauchen.
    opt.attachment ??= gl.COLOR_ATTACHMENT0;

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opt.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opt.magFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opt.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opt.wrapT);

    // Speicher wird jetzt alloziert, aber - siehe letztes Argument - leergelassen.
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        opt.internalFormat,
        opt.width,
        opt.height, 0,
        opt.dataFormat,
        opt.dataType,
        null
    );

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, opt.attachment, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    warnAboutBadFramebufferStatus(gl, status);

    // Kann (und sollte) jetzt aufgeräumt werden, Attachment gilt weiterhin.
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
        fbo,
        texture,
        attachments: [opt.attachment],
        extraDataTexture: null,
        width: opt.width,
        height: opt.height,
        texelSize: [1 / opt.width, 1 / opt.height],
        params: opt,
        // <-- Speichern wir hier, weil wir bei einem Resize reagieren müssen
        //     TODO: mache ich aber noch nicht! Canvas-Resizing braucht F5-Reload.
        // Und für die Fehlersuche:
        index: fbIndex,
        status,
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
    pp.currentWriteReadOrder = () => [
        // TODO: better name: currentRoles()
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

    gl.framebufferTexture2D(gl.FRAMEBUFFER, old.attachment, gl.TEXTURE_2D, texture, 0);

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
    const pingIndex = state.iFrame % 2;
    const pongIndex = 1 - pingIndex;
    return {
        write: state.framebuffer[pingIndex],
        read: state.framebuffer[pongIndex],
    }
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