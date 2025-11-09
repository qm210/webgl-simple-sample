import {setupWebGl} from "./webgl/setup.js";
import {prepareShowcase} from "./layout/showcase.js";
import generatePage from "./layout/generate.js";
import initLayout from "./layout/init.js";
import {selectShowcase} from "./showcases.js";
import './style/index.css';

const showcase = selectShowcase();

const elements = initLayout("app");

const glContext = setupWebGl(elements.canvas, {aspectRatio: 16 / 9});

const state = prepareShowcase(showcase, glContext);

console.info("WebGL objects initialized:", state, glContext);

const controls = showcase.generateControls(glContext, state, elements);

generatePage(glContext, elements, state, controls);

console.info("Page took", elements.pageLoadingMs.toFixed(1), "ms to render.");
