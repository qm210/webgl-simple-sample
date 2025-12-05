export function loadImage(imageSource, onLoad) {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.src = imageSource;
    return img;
}

export function createTextureFromImage(gl, imageSource, options) {
    const opt = options ?? {};

    // Texturen brauchen einerseits die Parameter, die beschreiben, wie eine Textur skaliert
    // und außerhalb der Koordinaten (0..1) interpretiert werden soll,
    // und die Spezifikation des Datentyps, Anzahl Kanäle, Farbtiefe.

    // S, T: Alte Konvention für die Texel-Koordinaten (Heute oft UV, für OpenGL aber nicht.)
    // Wrap: CLAMP_TO_EDGE, REPEAT, MIRRORED_REPEAT (in ES / WebGl: no border colors)
    opt.wrapS ??= gl.CLAMP_TO_EDGE;
    opt.wrapT ??= gl.CLAMP_TO_EDGE;
    // Filter: LINEAR, NEAREST
    opt.minFilter ??= gl.LINEAR;
    opt.magFilter ??= gl.LINEAR;
    // Wir lassen hier das Konzept der "Mipmaps" aus. Es geht da darum,
    // verschiedene Versionen einen Textur für verschiedene Skalierungen darzustellen,
    // was wir hier nur insofern wissen müssen, dass MIN_FILTER so etwas erwartet und deswegen,
    // wenn man dessen glTexParameteri()-Call auslässt, die Textur erstmal gar nicht funktioniert.
    // Das Argument "lod" (Level of Detail) in einigen Funktionen hängt auch an diesen Mipmaps -> Bei uns 0.

    // Spezifikation des Datentyps (damit auch Anzahl Kanäle / Farbtiefe)
    // ACHTUNG: Diese müssen aufeinander abgestimmt sein. Wird sonst Fehler geben.
    // https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexImage2D.xhtml
    opt.dataType ??= gl.UNSIGNED_BYTE;
    opt.dataFormat ??= gl.RGBA;
    opt.internalFormat ??= gl.RGBA;
    // Anmerkung: internalFormat = gl.SRGB8_ALPHA8 kann bei Bildern oft sinnvoll sein

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opt.wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opt.wrapT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opt.minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opt.magFilter);

    loadImage(imageSource, (img) => {
        // Laden im Browser notwendigerweise asynchron. Flackert ggf. auch kurz.
        // Wichtig: Textur neu binden, weil der Zustand von gl.TEXTURE_2D jetzt unklar ist.
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            opt.internalFormat,
            opt.dataFormat,
            opt.dataType,
            img
        );
        // Notiz: Weil das hier im Browser ist, ist die Auflösung des Bilds im HTMLImageElement "img"
        //        bereits bekannt. Im Allgemeinen würde man die Auflösung hier auch noch spezifizieren.
    });

    return texture;
}