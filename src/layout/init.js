

export default function init(rootId) {

    const root = document.getElementById(rootId);
    root.innerHTML = `
      <div id="layout">
        <div id="shaders"></div>
        <div id="console"></div>
        <div id="working-program">
          <div id="canvas-frame">
            <canvas id="canvas"></canvas>
          </div>
          <div id="controls"></div>
        </div>
        <div id="canvas-controls"></div>
      </div>
    `;

    const shaders = document.getElementById("shaders");
    keepScrollPosition(shaders, "shaders.scroll");

    return {
        shaders,
        console: document.getElementById("console"),
        workingShader: document.getElementById("working-program"),
        canvasFrame: document.getElementById("canvas-frame"),
        canvas: document.getElementById("canvas"),
        controls: document.getElementById("controls"),
        canvasControls: document.getElementById("canvas-controls"),
        startRendering: performance.now(),
    };
}

export function setFromUrlParameters(paramMap) {
    const urlParams = new URLSearchParams(window.location.search);
    for (const paramName in paramMap) {
        const paramValue = urlParams.get(paramName);
        if (!paramValue) {
            // not given in url
            continue;
        }
        const cssProperty = paramMap[paramName];
        document.documentElement.style.setProperty(cssProperty, paramValue);
    }
}

function keepScrollPosition(element, storageKey) {
    let debounceTimer;
    element.addEventListener("scroll", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            sessionStorage.setItem(storageKey, element.scrollTop.toString());
        }, 200);
    });
    document.addEventListener("DOMContentLoaded", () => {
        const scrollPosition = sessionStorage.getItem(storageKey);
        if (scrollPosition) {
            element.scrollTop = parseInt(scrollPosition);
            sessionStorage.removeItem(storageKey);
        }
    });
}
