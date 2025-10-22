import {startRenderLoop} from "../webgl/render.js";
import {createTextureFromImage} from "../webgl/helpers.js";

import fragmentShaderSource from "../shaders/texturePlayground.glsl";
import {compile, createStaticVertexBuffer, initVertices} from "../webgl/setup.js";
import vertexShaderSource from "../shaders/playground.vertex.glsl";
import image0 from "../textures/frame.png";
import image1 from "../textures/hubble_extreme_deep_field.jpg";
import image2 from "../textures/mysterious_capybara.png";

export default {
    title: "Texture Playground",
    init: (gl) => {
        createStaticVertexBuffer(
            gl,
            [-1, -1, +1, -1, -1, +1, -1, +1, +1, -1, +1, +1]
        );
        const state = compile(gl, vertexShaderSource, fragmentShaderSource);
        if (!state.program) {
            return state;
        }
        initVertices(gl, state, "aPosition");
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        state.location.iTime = gl.getUniformLocation(state.program, "iTime");
        state.location.iResolution = gl.getUniformLocation(state.program, "iResolution");
        state.location.iGamma = gl.getUniformLocation(state.program, "iGamma");
        state.location.iSomething = gl.getUniformLocation(state.program, "iSomething");
        state.resolution = [gl.drawingBufferWidth, gl.drawingBufferHeight];

        state.texture0 = createTextureFromImage(gl, image0, {
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
        });
        state.texture1 = createTextureFromImage(gl, image1, {
            wrapS: gl.REPEAT,
            wrapT: gl.MIRRORED_REPEAT,
            minFilter: gl.LINEAR,
        });
        state.texture2 = createTextureFromImage(gl, image2, {
            wrapS: gl.REPEAT,
            wrapT: gl.REPEAT,
            minFilter: gl.NEAREST,
            magFilter: gl.NEAREST
        });
        state.location.iTexture0 = gl.getUniformLocation(state.program, "iTexture0");
        state.location.iTexture1 = gl.getUniformLocation(state.program, "iTexture1");
        state.location.iTexture2 = gl.getUniformLocation(state.program, "iTexture2");
        state.location.iTexture2AspectRatio = gl.getUniformLocation(state.program, "iTexture2AspectRatio");

        gl.useProgram(state.program);

        return state;
    },
    generateControls: (gl, state, elements) => ({
        onRender: () => {
            startRenderLoop(
                state => render(gl, state),
                state,
                elements
            );
        },
        uniforms: [{
            type: "label",
            name: "iTime",
        }, {
            type: "floatInput",
            name: "iGamma",
            defaultValue: 1,
            min: 0.01,
            max: 10.,
        }, {
            type: "floatInput",
            name: "iSomething",
            defaultValue: 0,
            min: -2,
            max: +2,
        }]
    })
};

function render(gl, state) {
    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);
    gl.uniform1f(state.location.iGamma, state.iGamma);
    gl.uniform1f(state.location.iSomething, state.iSomething);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.texture0);
    gl.uniform1i(state.location.iTexture0, 0);
    // <-- letzter Parameter <n> muss zu Texture Unit gl.TEXTURE<n> passen

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.texture1);
    gl.uniform1i(state.location.iTexture1, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.texture2);
    gl.uniform1i(state.location.iTexture2, 2);
    gl.uniform1f(state.location.iTexture2AspectRatio, 0.728);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
}
