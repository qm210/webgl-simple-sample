

const regex = {
    version:
        /^#version/,
    precision:
        /precision\s*\w*\s*float/,
    main:
        /void\s+main\s*\(\s*\)/,
    mainImage:
        /void\s+mainImage\s*\(\s*out\s+vec4\s+(?<outVariable>\w+)\s*,\s*in\s+vec2\s+(?<inVariable>\w+)\s*\)/,
    uniform: (type, name) =>
        new RegExp(`\buniform\s+${type}\s+${name};`),
}

export function maybeAdjustForCompatibility(shaderSource) {
    let src = shaderSource;
    // quick way to include Shader Toy shaders: add ?shadertoy-Flag to URL Query (value doesn't matter)
    const shaderToyFlag = window.location.search.includes("shadertoy");
    if (shaderToyFlag) {
        src = translateShaderToyFormat(src);
    }
    // -- might add further variations / dialects here --
    return src;
}

export function translateShaderToyFormat(source) {
    // OpenGL/WebGL versions like to differ in small-but-annoying details,
    // this holds e.g. when comparing shaders from Shader Toy to current WebGL2.
    // -> we will accept these as input and transform them on the fly.

    let result = "\n" + source;

    ensureUniform("sampler2D", "iChannel3");
    ensureUniform("sampler2D", "iChannel2");
    ensureUniform("sampler2D", "iChannel1");
    ensureUniform("sampler2D", "iChannel0");
    ensureUniform("int", "iFrame");
    ensureUniform("vec2", "iResolution");
    ensureUniform("float", "iTime");

    const mainImage = source.match(regex.mainImage);
    if (!regex.main.test(source) && mainImage) {
        const {outVariable, inVariable} = mainImage.groups;
        prepend(`out vec4 ${outVariable};\n\n`);
        result = result
            .replace(mainImage[0], "void main()")
            .replaceAll(inVariable, "gl_FragCoord.xy");
    }

    if (!regex.precision.test(source)) {
        prepend("precision mediump float;")
    }

    if (!regex.version.test(source)) {
        prepend("#version 300 es");
    }

    return result;

    function prepend(line) {
        result = `${line}\n${result}`;
    }

    function ensureUniform(type, name) {
        if (!regex.uniform(type, name).test(result)) {
            prepend(`uniform ${type} ${name};`);
        }
    }
}
