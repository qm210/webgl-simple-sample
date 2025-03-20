// we now take the end state of VL3 as a basis
import standardSetup from "./3_SimpleGeometry.js";
import {loadImage} from "../webgl/helpers.js";

import fragmentShaderSource from "../shaders/texturesBeginning.glsl";
// import image from "../textures/hubble_extreme_deep_field.jpg";
import image from "../textures/frame.png";

export default {
    title: "Textures",
    init: (gl) => {
        const state = standardSetup.init(gl, fragmentShaderSource);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); // <-- what else there is?
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        // wir lass hier Mipmaps aus, aber es sei erwähnt, dass sie existieren.

        loadImage(image, (img) => {
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

        return state;
    },
    generateControls:
        standardSetup.generateControls
};
