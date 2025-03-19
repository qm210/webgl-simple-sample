// we now take the end state of VL3 as a basis
import simpleGeometrySetup from "./3_SimpleGeometry.js";

import fragmentShaderSource from "../shaders/texturesBeginning.glsl";

export default {
    title: "Textures",
    init: (gl) => {
        return simpleGeometrySetup.init(gl, fragmentShaderSource);
    },
    generateControls:
    simpleGeometrySetup.generateControls
};
