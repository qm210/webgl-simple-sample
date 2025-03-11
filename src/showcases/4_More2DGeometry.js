// we now take the end state of VL3 as a basis
import simpleGeometrySetup from "./3_SimpleGeometry.js";

import fragmentShaderSource from "../shaders/moreGeometry.glsl";

export default {
    title: "More 2D Geometry",
    init: (gl) => {
        return simpleGeometrySetup.init(gl, fragmentShaderSource);
    },
    generateControls:
        simpleGeometrySetup.generateControls
};
