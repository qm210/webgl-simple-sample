import {setupWebGl} from "./webgl/setup.js";
import {prepareShowcase} from "./layout/showcase.js";
import generatePage from "./layout/generate.js";
import initLayout, {setFromUrlParameters} from "./layout/init.js";
import './style/index.css';

import showcase1 from "./showcases/1_PlainColor.js";
import showcase2a from "./showcases/2_HelloShadertoy_broken.js";
import showcase2b from "./showcases/2_HelloShadertoy_fixed_static.js";
import showcase2c from "./showcases/2_HelloShadertoy_fixed.js";
import showcase3 from "./showcases/3_SimpleGeometry.js";
import showcase4 from "./showcases/4_More2DGeometry.js";
import showcase5a from "./showcases/5a_RayTracingCubeBeginning.js";
import showcase5b from "./showcases/5b_RayTracingCubeExtended.js";
import showcase6 from "./showcases/6_Textures.js";
import showcase7 from "./showcases/7_ColorMixing.js";
import showcase8 from "./showcases/8_Multipass.js";
import showcase9 from "./showcases/9_Volumetric.js";

// choose wisely :)
const showcase = showcase6;

const autoRenderOnLoad = true;

const elements = initLayout("app");

// allow setting the font size via ?fontsize=1.5em URL param
setFromUrlParameters({
    "fontsize": "--font-size-large"
});

const glContext = setupWebGl(elements.canvas, {
    aspectRatio: 16 / 9,
});

const state = prepareShowcase(showcase, glContext);

console.log("WebGL objects initialized:", state);

const controls = showcase.generateControls(glContext, state, elements);

generatePage(elements, state, controls, autoRenderOnLoad);

console.log("Page took", elements.initialRenderMs.toFixed(1), "ms to render.");
