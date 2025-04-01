import {setupWebGl} from "./webgl/setup.js";
import {prepareShowcase} from "./layout/showcase.js";
import generatePage from "./layout/generate.js";
import initLayout, {setFromUrlParameters} from "./layout/init.js";
import {selectShowcase} from "./showcases.js";
import './style/index.css';

const showcase = selectShowcase();

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
