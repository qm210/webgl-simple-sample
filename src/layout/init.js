

export default function init({rootId}) {

    const root = document.getElementById(rootId);
    root.innerHTML = `
      <div id="layout">
        <div id="shaders">
          <div id="fragment-source"></div>
          <div id="vertex-source"></div>
        </div>
        <div id="console"></div>
        <div id="working-program">
          <div id="canvas-frame">
            <canvas id="canvas"></canvas>
          </div>
          <div id="controls"></div>
        </div>
      </div>
    `;

    // allow setting the font size via ?fontsize=1.5em URL param
    setFromUrlParameter("--font-size-large", "fontsize");

    return {
        console: document.getElementById("console"),
        workingShader: document.getElementById("working-program"),

        fragment: document.getElementById("fragment-source"),
        vertex: document.getElementById("vertex-source"),
        canvasFrame: document.getElementById("canvas-frame"),
        canvas: document.getElementById("canvas"),
        controls: document.getElementById("controls"),
    };

}

function setFromUrlParameter(cssProperty, paramName) {
    const paramValue = (new URLSearchParams(window.location.search)).get(paramName);
    if (!paramValue) {
        return;
    }
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty(cssProperty, paramValue);
}
