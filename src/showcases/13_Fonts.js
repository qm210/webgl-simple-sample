import {initBasicState, startRenderLoop} from "./common.js";
import {createTextureFromImage} from "../webgl/helpers/textures.js";

import vertexShaderSource from "../shaders/vertex.fonts.glsl"
import fragmentShaderSource from "../shaders/fonts.proofofconcept.glsl";
import spiceSaleMsdfPng from "../textures/dream210/SpicySale.msdf.png";
import spiceSaleMsdfJson from "../textures/dream210/SpicySale.msdf.json";

function toAscii(text) {
    return Array.from(text, char => char.charCodeAt(0));
}

function createGlyphDef(json) {
    // This will create an array of vec4 (glyphCenter, glyphSize)
    // i.e. if one is used to think of u0, v0, u1, v1, then it is
    // glyphCenter = (uv0 + uv1) / 2;
    // halfSize = (uv1 - uv0) / 2;
    const charset = json.info.charset;
    const glyphDef = new Float32Array(charset.length * 4);
    const atlasW = json.common.scaleW;
    const atlasH = json.common.scaleH;

    const glyphDebug = [];

    let index = 0;
    for (const char of charset) {
        const charCode = char.charCodeAt(0);
        const glyph = json.chars.find(g => g.id === charCode);

        if (!glyph) {
            console.warn("This character is defined in the charset but not in the chars array: " + char);
            continue;
        }

        const halfWidth = 0.5 * glyph.width / atlasW;
        const halfHeight = 0.5 * glyph.height / atlasH;

        // center of glyph in [0..1] of texture
        glyphDef[index++] = glyph.x / atlasW + halfWidth;
        glyphDef[index++] = glyph.y / atlasH + halfHeight;
        // size of glyph in [0..1] of texture
        glyphDef[index++] = halfWidth;
        glyphDef[index++] = halfHeight;

        glyphDebug.push({
            char, charCode, glyph,
            index,
            startIndex: index - 4,
            def: glyphDef.slice(index - 4, index)
        });
    }

    return {glyphDef, glyphDebug};
}

function createUbo(gl, program, array, blockName) {
    const ubo = gl.createBuffer();
    const blockBytes = array.length * 4;
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    gl.bufferData(gl.UNIFORM_BUFFER, blockBytes, gl.STATIC_DRAW);
    // gl.DYNAMIC_DRAW is data is changing often!

    const blockIndex = gl.getUniformBlockIndex(program, blockName);
    if (blockIndex === gl.INVALID_INDEX) {
        console.error("Found no layout(std140) uniform", blockName);
        return null;
    }

    // seems that WebGL2 doesn't allow (std140, binding=0), only (std140)
    const binding = gl.getActiveUniformBlockParameter(
        program, blockIndex, gl.UNIFORM_BLOCK_BINDING
    );
    gl.uniformBlockBinding(program, blockIndex, 0);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);

    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, array);

    const checkBlockSize = gl.getActiveUniformBlockParameter(
        program, blockIndex, gl.UNIFORM_BLOCK_DATA_SIZE
    );
    console.info("[UBO]", ubo,
        "Block Sizes equal... ", checkBlockSize, blockBytes,
        "? Block Name/Index:", blockName, blockIndex,
        "Binding", binding,
    );

    /*
    Update Data with:
        gl.bindBuffer(gl.UNIFORM_BUFFER, ubo);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, array);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);
     */

    return ubo;
}

export default {
    title: "What about Fonts?",
    init: (gl, sources = {}) => {
        sources.vertex ??= vertexShaderSource;
        sources.fragment ??= fragmentShaderSource;
        const state = initBasicState(gl, sources);

        if (!state.program) {
            return state;
        }

        const {glyphDef, glyphDebug} = createGlyphDef(spiceSaleMsdfJson);
        const ubo = createUbo(gl, state.program, glyphDef, "Glyphs");
        state.msdf = {
            tex: createTextureFromImage(gl, spiceSaleMsdfPng, {
                wrapS: gl.CLAMP_TO_EDGE,
                wrapT: gl.CLAMP_TO_EDGE,
                minFilter: gl.LINEAR,
                maxFilter: gl.LINEAR,
                internalFormat: gl.RGBA8,
                dataFormat: gl.RGBA,
                dataType: gl.UNSIGNED_BYTE,
            }),
            json: spiceSaleMsdfJson,
            ubo,
            glyphDef,
            debug: glyphDebug,
        }

        const someText = "QM says hi \\o/";
        console.log(
            `[DEVEL] ASCII for \"${someText}\"`, toAscii(someText),
            "and maybe useful:", state.msdf
        );

        return state;
    },
    generateControls: (gl, state, elements) => ({
        onRender: () => {
            startRenderLoop(
                state => render(gl, state, elements),
                state,
                elements
            );
        },
        uniforms: [
            // type: "button",
            // name: "executeQueries",
            // label: "Query Rendering",
            // onClick: () => {
            //     state.query.doExecute = true;
            // }
        // }, {
        {
            separator: "Fragment Shader Uniforms"
        }, {
            type: "vec3",
            name: "iTextColor",
            defaultValue: [1, 0.3, 0.5],
            min: 0,
            max: 1
        }, {
            separator: "Zur freien Verwendung..."
        }, {
            type: "float",
            name: "iFree0",
            defaultValue: 0,
            min: 0.01,
            max: 100,
            log: true
        }, {
            type: "float",
            name: "iFree1",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree2",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree3",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree4",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }, {
            type: "float",
            name: "iFree5",
            defaultValue: 0,
            min: -9.99,
            max: +9.99,
        }]
    })
};

function render(gl, state, elements) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform4fv(state.location.iMouseDrag, state.iMouseDrag);
    gl.uniform1i(state.location.iFrame, state.iFrame);

    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);
    gl.uniform1f(state.location.iFree5, state.iFree5);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.msdf.tex);
    gl.uniform1i(state.location.glyphTex, 0);
    gl.uniform4fv(state.location.glyphDefM, state.msdf.glyphDef.slice(4 * 44, 4*45));

    gl.uniform3fv(state.location.iTextColor, state.iTextColor);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
