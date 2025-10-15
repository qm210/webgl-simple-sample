// we now take the end state of VL3 as a basis
import standardSetup from "./retired/3_SimpleGeometry.js";

import fragmentShaderSource from "../shaders/spring-2025/moreGeometry.glsl";

export default {
    title: "More 2D Geometry",
    init: (gl) =>
        standardSetup.init(gl, fragmentShaderSource),
    generateControls:
        standardSetup.generateControls
};
