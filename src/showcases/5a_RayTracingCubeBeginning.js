// we now take the end state of VL3 as a basis
import simpleGeometrySetup from "./3_SimpleGeometry.js";

import fragmentShaderSource from "../shaders/cubeRayMarchingBeginning.glsl";

export default {
    title: "Ray Tracing",
    init: (gl) =>
        simpleGeometrySetup.init(gl, fragmentShaderSource),
    generateControls:
        simpleGeometrySetup.generateControls
};
