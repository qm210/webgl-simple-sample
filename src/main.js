import {initShaders, setupWebGl} from "./webgl/setup.js";

import vertexShaderSource from "./shaders/basicVertex.glsl";
import fragmentShaderSource from "./shaders/fragment1.glsl";

import './style.css';
import {render} from "./webgl/render.js";

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
      <div id="controls">
        <button id="render-button">
          Render
        </button>
      </div>
    </div>
  </div>
`;

const element = {
    fragment: document.getElementById("fragment-source"),
    vertex: document.getElementById("vertex-source"),
    console: document.getElementById("console"),
    canvas: document.getElementById("canvas"),
    controls: document.getElementById("controls"),
    button: {
        render: document.getElementById("render-button"),
    }
};

const glContext = setupWebGl(
    element.canvas,
    800,
    16/9
);

const state = initShaders(glContext, vertexShaderSource, fragmentShaderSource);
console.log("initShader() =", state);

if (!!state.program) {
    element.button.render.addEventListener(
        "click",
        () => render(glContext, state)
    );
} else {
    element.button.render.innerText = "Can not render - we have errors.";
    element.button.render.disabled = true;
}

element.fragment.classList.add("code");
element.fragment.innerHTML = `
  <pre>${fragmentShaderSource}</pre>
`;

element.vertex.classList.add("code");
element.vertex.innerHTML = `
  <pre>${vertexShaderSource}</pre>
`;

element.console.innerHTML = `
    <h4>Fragment Shader</h4>
    <div>Compile Status: ${state.compileStatus.fragment}</div>
    <div class="error">${state.error.fragment}</div>
    <div></div>
    <h4>Vertex Shader</h4>
    <div>Compile Status: ${state.compileStatus.vertex}</div>
    <div class="error">${state.error.vertex}</div>
    <div></div>
    <h4>Shader Program</h4>
    <div>Link Status: ${state.compileStatus.linker}</div>
    <div class="error">${state.error.linker}</div>
    <div></div>
`;
