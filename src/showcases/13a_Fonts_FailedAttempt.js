import {startRenderLoop} from "../app/playback.js";
import {compile} from "../webgl/setup.js";
import {createTextureFromImage} from "../webgl/helpers/textures.js";

import vertexShaderSource from "../shaders/vertex.fonts.glsl";
import fragmentShaderSource from "../shaders/fonts.proofofconcept.glsl";
import spiceSaleMsdfPng from "../textures/dream210/SpicySale.msdf.png";
import spiceSaleMsdfJson from "../textures/dream210/SpicySale.msdf.json";

export default {
    title: "What about Fonts?",
    init: (gl, sources = {}) => {
        sources.vertex ??= vertexShaderSource;
        sources.fragment ??= fragmentShaderSource;

        const state = compile(gl, sources);
        if (!state.program) {
            return state;
        }
        gl.useProgram(state.program);


        const MAX_VERTICES = 5000;
        // (vec2 pos + vec4 uv) = 6 floats à 4 bytes:
        const FLOATS_PER_VERTEX = 6;
        const BYTES_PER_VERTEX = 4 * FLOATS_PER_VERTEX;
        state.vertices = new Float32Array(MAX_VERTICES * FLOATS_PER_VERTEX);
        state.textBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, state.textBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, MAX_VERTICES * BYTES_PER_VERTEX, gl.DYNAMIC_DRAW);
        state.stride = BYTES_PER_VERTEX;

        state.location.aPosition = gl.getAttribLocation(state.program, "aPosition");
        state.location.aGlyphRect = gl.getAttribLocation(state.program, "aGlyphRect");
        gl.enableVertexAttribArray(state.location.aPosition);
        gl.enableVertexAttribArray(state.location.aGlyphRect);
        gl.vertexAttribPointer(state.location.aPosition,
            2, gl.FLOAT, false, state.stride, 0
        );
        // aPosition is vec2 -> aGlyphRect has offset 2 * 4
        gl.vertexAttribPointer(state.location.aGlyphRect,
            4., gl.FLOAT, false, state.stride, 8
        );

        gl.clearColor(0,.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

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
            json: spiceSaleMsdfJson
        }
        console.log("MFing MSDF", state.msdf.json);

        state.texts = [
            {text: "Qrmaw", x: -0.9, y: -0.5, scale: 0.8},
            //{text: "Hello", x: 0.5, y: -0.5, scale: 0.8}
        ];

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
            separator: "Vertex Shader Uniforms"
        }, {
            type: "vec2",
            name: "uShiftTexCoord",
            defaultValue: 0,
            min: -1,
            max: +1,
        }, {
            type: "vec2",
            name: "uScaleTexCoord",
            defaultValue: 1,
            min: 0.1,
            max: 10,
        }, {
            separator: "Fragment Shader Uniforms"
        }, {
            type: "vec3",
            name: "uTextColor",
            defaultValue: [1, 0.3, 0.5],
            min: 0,
            max: 1
        }, {
            type: "float",
            name: "uPxRange",
            defaultValue: 4,
            min: 0,
            max: 20
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

function putVertex(state, base, px, py, u0, v0, u1, v1) {
    state.vertices[base] = px;
    state.vertices[base+1] = py;
    state.vertices[base+2] = u0;
    state.vertices[base+3] = v0;
    state.vertices[base+4] = u1;
    state.vertices[base+5] = v1;
}

function render(gl, state, elements) {

    // VERTEX
    const atlasW = state.msdf.json.common.scaleW;
    const atlasH = state.msdf.json.common.scaleH;

    let vertexCount = 0;
    for (let {text, x, y, scale} of state.texts) {
        scale *= 0.01;
        let cursorX = x;
        for (let char of text) {

            const glyph = state.msdf.json.chars.find(
                g => g.id === char.charCodeAt(0)
            );
            if (!glyph) {
                continue;
            }

            const w = glyph.width * scale;
            const h = glyph.height * scale;
            const left = cursorX + glyph.xoffset * scale;
            const top = y + glyph.yoffset * scale;
            const right = left + w;
            const bottom = top + h;

            const u0 = glyph.x / atlasW;
            const v1 = (glyph.y / atlasH);
            const u1 = (glyph.x + glyph.width) / atlasW;
            const v0= (glyph.y + glyph.height) / atlasH;

            // 6 vertices = 2 triangles
            const base = vertexCount * 6;
            putVertex(state, base +  0, left, bottom, u0,v0,u1,v1);
            putVertex(state, base +  6, right, bottom, u0,v0,u1,v1);
            putVertex(state, base + 12, left, top, u0,v0,u1,v1);
            putVertex(state, base + 18, left, top, u0,v0,u1,v1);
            putVertex(state, base + 24, right, bottom, u0,v0,u1,v1);
            putVertex(state, base + 30, right, top, u0,v0,u1,v1);
            vertexCount += 6;
            cursorX += glyph.xadvance * scale;

            if (!state.debugged) {
                const glyphRect = {u0, v0, u1, v1};
                console.log(
                    "GLYPH", glyph.char, glyph,
                    "POS", {left, right, bottom: top, top: bottom, w, h},
                    "RECT", glyphRect,
                    // "VERTICES", state.vertices.slice(base, base+36)
                )
                if (!((u1 > u0) && (v1 > v0) && (u0 > 0) && (u1 > 0))) {
                    console.warn("BAD DOG", glyphRect);
                }
            }
        }
        state.debugged = true;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, state.textBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, state.vertices, 0, vertexCount * state.stride);

    gl.uniform2fv(state.location.uScaleTexCoord, state.uScaleTexCoord);
    gl.uniform2fv(state.location.uShiftTexCoord, state.uShiftTexCoord);

    // FRAGMENT

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
    gl.uniform1i(state.location.uMSDF, 0);

    gl.uniform3fv(state.location.uTextColor, state.uTextColor);
    gl.uniform1f(state.location.uPxRange, state.uPxRange);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
}
