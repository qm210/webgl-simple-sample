import {setupWebGl} from "./webgl/setup.js";
import generatePage from "./layout/generate.js";
import initLayout from "./layout/init.js";
import './style/index.css';

import showcase1 from "./showcases/1_PlainColor.js";
import showcase2a from "./showcases/2_HelloShadertoy_broken.js";
import showcase2b from "./showcases/2_HelloShadertoy_fixed_static.js";
import showcase2c from "./showcases/2_HelloShadertoy_fixed.js";
import showcase3 from "./showcases/3_SimpleGeometry.js";

// choose wisely :)
const showcase = showcase3;

const autoRenderOnLoad = true;

const elements = initLayout({
    rootId: "app",
    reducedView: true,
});

const glContext = setupWebGl(elements.canvas, {
    height: Math.max(400, 0.5 * window.innerHeight),
    aspectRatio: 16 / 9,
});

const state = showcase.init(glContext);

if (!state.program) {
    elements.workingShader.remove();
} else {
    elements.console.remove();
}

console.log("WebGL objects initialized:", state);

const controls = showcase.generateControls(glContext, state, elements);

generatePage(elements, state, controls);

if (autoRenderOnLoad) {
    controls
        .find(it => it.type === "renderButton")
        ?.onClick();
}

if (showcase.title) {
    document.title = showcase.title;
}
