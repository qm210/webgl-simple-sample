import {startRenderLoop} from "../app/playback.js";
import {compile} from "../webgl/setup.js";
import {createTextureFromImage} from "../webgl/helpers/textures.js";

import vertexShaderSource from "../shaders/vertex.fonts.glsl";
import fragmentShaderSource from "../shaders/fonts.proofofconcept.glsl";
import spiceSaleMsdfPng from "../textures/dream210/SpicySale.msdf.png";
import spiceSaleMsdfJson from "../textures/dream210/SpicySale.msdf.json";


function layoutText(gl, json, text, x, y, scale = 1) {
    const {chars, common} = json;
    const atlas = {
        W: common.scaleW,
        H: common.scaleH
    };

    const vertices = [];
    let cursorX = x;
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        const glyph = chars.find(c => c.id === charCode);
        if (!glyph) {
            continue;
        }
        const gw = glyph.width * scale;
        const gh = glyph.height * scale;
        const left = cursorX + glyph.xoffset * scale;
        const top = y + glyph.yoffset * scale;
        const u0 = glyph.x / atlas.W;
        const v0 = glyph.y / atlas.H;
        const u1 = (glyph.x + glyph.width) / atlas.W;
        const v1 = (glyph.y + glyph.height) / atlas.H;


        // x, y, u0, v0, u1, v1
        // (x, y): screen position (clip space)
        // (u0, v0) = top left corner of glyph rect in atlas
        // (u1, v1) = bottom right corner of glyph rect in atlas
        // -> Quad aus zwei Dreiecken as-we-know-it (eventühl)
        // -> Das ist aber irgendwie harteklig interleaved? whythou?
        /*
        vertices.push(
            left, top + gh, u0, v0, u1, v1,             // top left
            left + gw, top + gh, u0, v0, u1, v1,        // top right
            left, top, u0, v1, u1, v1,                  // bottom left

            left, top, u0, v1, u1, v1,                  // bottom left
            left + gw, top + gh, u0, v0, u1, v1,        // top right
            left + gw, top, u0, v1, u1, v1,             // bottom right
        );
        // 24 Bytes / Vertex (2 Floats (x,y) + 4 floats rect
         */

        vertices.push(
            // TRIANGLE 1
            left,          top+gh,    u0, v0,     // Top-left: screen-top, atlas-top-left
            left+gw,       top+gh,    u1, v0,     // Top-right: screen-top, atlas-top-right
            left,          top,       u0, v1,     // Bottom-left: screen-bottom, atlas-bottom-left
            // TRIANGLE 2
            left,          top,       u0, v1,     // Bottom-left: screen-bottom, atlas-bottom-left
            left+gw,       top+gh,    u1, v0,     // Top-right: screen-top, atlas-top-right
            left+gw,       top,       u1, v1      // Bottom-right: screen-bottom, atlas-bottom-right
        );
        cursorX += glyph.xadvance * scale;
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
        return buffer;
    }
}

const MAX_VERTICES= 50000;
const BYTES_PER_VERTEX = 16; // (vec2 pos + vec2 uv) -> 16 bytes

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

        state.textBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, state.textBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, MAX_VERTICES * BYTES_PER_VERTEX, gl.DYNAMIC_DRAW);

        state.location.aPosition = gl.getAttribLocation(state.program, "aPosition");
        gl.enableVertexAttribArray(state.location.aPosition)
        gl.vertexAttribPointer(state.location.aPosition, 2, gl.FLOAT, false, 24, 0);
        state.location.aGlyphRect = gl.getAttribLocation(state.program, "aGlyphRect");
        gl.vertexAttribPointer(state.location.aGlyphRect, 4., gl.FLOAT, false, 24, 8);

        gl.clearColor(0,.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);


        state.msdf = {
            tex: createTextureFromImage(gl, spiceSaleMsdfPng, {
                wrapS: gl.CLAMP_TO_EDGE,
                wrapT: gl.CLAMP_TO_EDGE,
                minFilter: gl.LINEAR,
                maxFilter: gl.LINEAR,
            }),
            json: spiceSaleMsdfJson
        }
        //
        // state.texts = {
        //     dream210: layoutText(gl, state.msdf.json, "Dream210", -0.5, 0.5, 48.0),
        //     helloWorld: layoutText(gl, state.msdf.json, "Hello World", -0.5, 0.5, 48.0),
        // }

        state.texts = [
            {text: "Dream210", x: -0.5, y: 0.5},
            {text: "Hello", x: 0.5, y: -0.5}
        ];

        // gl.enableVertexAttribArray(state.location.aPosition);
        // gl.vertexAttribPointer(
        //     state.location.aPosition,
        //     2,
        //     gl.FLOAT,
        //     false,
        //     0,
        //     0
        // );

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
            type: "vec3",
            name: "uTextColor",
            defaultValue: [1, 1, 1],
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
            min: -9.99,
            max: +9.99,
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
/*
    const vertices = new Float32Array(MAX_VERTICES * 4);
    let vertexCount = 0;
    for (let textObj of Object.values(state.texts)) {
        vertexCount += layoutText(vertices, vertex)
    }

    gl.uniform3fv(state.location.uTextColor, state.uTextColor);
    gl.uniform1f(state.location.uPxRange, state.uPxRange);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform4fv(state.location.iMouseDrag, state.iMouseDrag);
    gl.uniform1i(state.location.iFrame, state.iFrame);
    //
    gl.uniform1f(state.location.iFree0, state.iFree0);
    gl.uniform1f(state.location.iFree1, state.iFree1);
    gl.uniform1f(state.location.iFree2, state.iFree2);
    gl.uniform1f(state.location.iFree3, state.iFree3);
    gl.uniform1f(state.location.iFree4, state.iFree4);
    gl.uniform1f(state.location.iFree5, state.iFree5);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.msdf.tex);
    gl.uniform1i(state.location.uMSDF, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
*/
    const vertices = new Float32Array(MAX_VERTICES * 4);
    let vertexCount = 0;

    for (let {text, x, y} of state.texts) {
        let cursorX = x;
        for (let char of text) {
            const glyph = state.msdf.json.chars.find(g => g.id === char.charCodeAt(0));
            if (!glyph) continue;

            const atlasW = state.msdf.json.common.scaleW;
            const left = cursorX + glyph.xoffset / 100;
            const top = y + glyph.yoffset / 100;
            const w = glyph.width / 100;
            const h = glyph.height / 100;

            const u0 = glyph.x / atlasW;
            const v0 = glyph.y / atlasW;
            const u1 = (glyph.x + glyph.width) / atlasW;
            const v1 = (glyph.y + glyph.height) / atlasW;

            // 6 vertices = 2 triangles
            const base = vertexCount * 4;
            vertices[base + 0] = left;           vertices[base + 1] = top + h;   vertices[base + 2] = u0; vertices[base + 3] = v0;
            vertices[base + 4] = left + w;       vertices[base + 5] = top + h;   vertices[base + 6] = u1; vertices[base + 7] = v0;
            vertices[base + 8] = left;           vertices[base + 9] = top;       vertices[base + 10] = u0; vertices[base + 11] = v1;
            vertices[base + 12] = left;          vertices[base + 13] = top;      vertices[base + 14] = u0; vertices[base + 15] = v1;
            vertices[base + 16] = left + w;      vertices[base + 17] = top + h;   vertices[base + 18] = u1; vertices[base + 19] = v0;
            vertices[base + 20] = left + w;      vertices[base + 21] = top;      vertices[base + 22] = u1; vertices[base + 23] = v1;

            vertexCount += 6;
            cursorX += glyph.xadvance / 100;
        }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, state.textBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, vertices, 0, vertexCount * 4);

    gl.bindTexture(gl.TEXTURE_2D, state.msdf.tex);
//    gl.uniform3f(gl.getUniformLocation(program, 'u_color'), 1, 1, 1);
    gl.uniform3fv(state.location.uTextColor, state.uTextColor);
    gl.uniform1f(state.location.uPxRange, state.uPxRange);

    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
}
