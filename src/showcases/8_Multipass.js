import standardSetup from "./3_SimpleGeometry.js";
import {startRenderLoop} from "../webgl/render.js";
import {createTextureFromImage} from "../webgl/helpers.js";

import fragmentShaderSource from "../shaders/textures.glsl";
import postFragmentShaderSource from "../shaders/postProcessing.glsl";

import image0 from "../textures/frame.png";
import image1 from "../textures/hubble_extreme_deep_field.jpg";
import image2 from "../textures/Wood066_1K-JPG_Color.jpg";

const ACTIVATE_POST_PROCESSING = true;

export default {
    title: "Multipass",
    init: (gl) => {
        const state = standardSetup.init(gl, fragmentShaderSource);

        if (!state.program) {
            return state;
        }

        state.texture0 = createTextureFromImage(gl, image0, {
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            minFilter: gl.LINEAR,
            magFilter: gl.LINEAR,
        });
        state.texture1 = createTextureFromImage(gl, image1, {
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            minFilter: gl.LINEAR,
        });
        state.texture2 = createTextureFromImage(gl, image2, {
            wrapS: gl.CLAMP_TO_EDGE,
            wrapT: gl.CLAMP_TO_EDGE,
            minFilter: gl.LINEAR,
        });

        state.location.texture0 = gl.getUniformLocation(state.program, "iTexture0");
        state.location.texture1 = gl.getUniformLocation(state.program, "iTexture1");
        state.location.texture2 = gl.getUniformLocation(state.program, "iTexture2");

        // <-- up to here, known from 6_Texture.js

        state.post = standardSetup.init(gl, postFragmentShaderSource);

        state.fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbo);

        state.fbTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, state.fbTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.drawingBufferWidth,
            gl.drawingBufferHeight,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            state.fbTexture,
            0
        );

        state.post.location.texture = gl.getUniformLocation(state.program, "iImage");

        return state;
    },
    generateControls: (gl, state, elements) => [{
        type: "renderButton",
        title: "Render",
        onClick: () => {
            startRenderLoop(
                state => render(gl, state),
                state,
                elements
            );
        }
    }, {
        type: "label",
        name: "iTime",
    }]
};

function render(gl, state) {
    const post = ACTIVATE_POST_PROCESSING ? state.post : null;

    gl.useProgram(state.program);

    gl.uniform1f(state.location.iTime, state.time);
    gl.uniform2fv(state.location.iResolution, state.resolution);

    // generell: getUniformLocation kann auch hier aufgerufen werden, optimiert vielleicht ein paar epsilons...

    // Was ist die Texture Unit? (i.e. TEXTURE0)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, state.texture0);
    gl.uniform1i(state.location.texture0, 0);
    // <-- hint: 0 entspricht gl.TEXTURE0 unit

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, state.texture1);
    gl.uniform1i(state.location.texture1, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, state.texture2);
    gl.uniform1i(state.location.texture2, 2);

    if (post) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.fbo)
    } else {
        // unbind framebuffer = draw on screen
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (post) {
        gl.useProgram(post.program);

        gl.uniform1f(post.location.iTime, state.time);
        gl.uniform2fv(post.location.iResolution, state.resolution);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, state.fbTexture);
        gl.uniform1i(post.location.texture, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}
