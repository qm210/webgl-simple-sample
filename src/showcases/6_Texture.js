import standardSetup from "./3_SimpleGeometry.js";
import {createTextureFromImage} from "../webgl/helpers.js";
import {startRenderLoop} from "../webgl/render.js";

import fragmentShaderSource from "../shaders/texturesAdvanced.glsl";
import image0 from "../textures/frame.png";
import image1 from "../textures/hubble_extreme_deep_field.jpg";
import image2 from "../textures/Wood066_1K-JPG_Color.jpg";

export default {
    title: "Textures",
    init: (gl) => {
        const state = standardSetup.init(gl, fragmentShaderSource);

        if (!state.program) {
            return state;
        }

        // createTextureFromImage ist unsere eigene Hilfsfunktion. Reinschauen.
        // sie nimmt uns die nötigen OpenGL-Schritte für die Texturen ab:
        // gl.createTexture()
        // gl.bindTexture()
        // gl.texParameteri() für WRAP_S, WRAP_T, MIN_FILTER, optional: MAG_FILTER
        // gl.texImage2D();

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

        state.location.pass = gl.getUniformLocation(state.program, "iPass");

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

    gl.uniform1i(state.location.pass, 0);
    if (state.pass0) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.pass0.fb);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    if (state.pass1) {
        gl.uniform1i(state.location.pass, 1);
        gl.bindFramebuffer(gl.FRAMEBUFFER, state.pass1.fb);
    }
}
