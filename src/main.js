import {setupWebGl} from "./webgl/setup.js";
import generatePage from "./generate.js";
import './style/index.css';
import './style/app.css';

// choose wisely :)
// import showcase from "./showcases/1_PlainColor.js";
// import showcase from "./showcases/2_HelloShadertoy_broken.js";
// import showcase from "./showcases/2_HelloShadertoy_fixed_static.js";
import showcase from "./showcases/2_HelloShadertoy_fixed.js";

const autoRenderOnLoad = true;


document.querySelector('#app').innerHTML = `
  <div id="layout">
    <div id="shaders">
      <div id="fragment-source"></div>
      <div id="vertex-source"></div>
    </div>
    <div id="console"></div>
    <div id="panels">
      <div id="canvas-frame">
        <canvas id="canvas"></canvas>
      </div>
      <div id="controls"></div>
    </div>
  </div>
`;

if (showcase.title) {
    document.title = showcase.title;
}

const elements = {
    fragment: document.getElementById("fragment-source"),
    vertex: document.getElementById("vertex-source"),
    console: document.getElementById("console"),
    canvasFrame: document.getElementById("canvas-frame"),
    canvas: document.getElementById("canvas"),
    controls: document.getElementById("controls"),
};

const glContext = setupWebGl(
    elements.canvas,
    800,
    16/9
);

const state = showcase.init(glContext);

const controls = showcase.generateControls(glContext, state, elements);

console.log(glContext, state, controls);

generatePage(elements, state, controls);

if (autoRenderOnLoad) {
    controls
        .find(it => it.type === "renderButton")
        ?.onClick();
}
