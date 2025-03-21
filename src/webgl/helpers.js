// we'll get to that, but let's not use these for less confusion
// even though, of course, we all love clean code.

import image2 from "../textures/Grass001_1K-JPG_Color.jpg";

export function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Error compiling shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

export function createProgram(gl, vertexShader, fragmentShader) {
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