

export default function init(rootId) {

    const root = document.getElementById(rootId);
    root.innerHTML = `
      <div id="layout">
        <div id="shaders"></div>
        <div id="console"></div>
        <div id="canvas-divider"></div>
        <div id="working-program">
          <div id="canvas-frame">
            <canvas id="canvas"></canvas>
          </div>
          <div id="controls"></div>
        </div>
      </div>
    `;

    const shaders = document.getElementById("shaders");
    keepScrollPosition(shaders, "shaders.scroll");

    const elements = {
        shaders,
        console: document.getElementById("console"),
        canvasDivider: document.getElementById("canvas-divider"),
        workingShader: document.getElementById("working-program"),
        canvasFrame: document.getElementById("canvas-frame"),
        canvas: document.getElementById("canvas"),
        controls: document.getElementById("controls"),
        startRendering: performance.now(),
    };

    initializeCanvasDivider(elements);

    return elements;
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

function initializeCanvasDivider(elements) {
    let dragging = false;
    elements.canvasDivider.addEventListener("mousedown", () => {
        dragging = true;
        document.body.style.userSelect = "none";
    });
    elements.canvasDivider.addEventListener("mousemove", (event) => {
        if (!dragging) {
            return;
        }
        const parentRect = elements.canvasDivider.parentElement.getBoundingClientRect();
        let newWidth = event.clientX - parentRect.left;
        console.log("NEW WIDTH", newWidth);
        elements.shaders.style.flex = `1 0 ${newWidth}px`;
        elements.workingShader.style.flex = `1 0 calc(100% - ${newWidth + elements.canvasDivider.offsetWidth}px)`;
    });
    elements.canvasDivider.addEventListener("mouseup", endDrag);
    elements.canvasDivider.addEventListener("mouseleave", endDrag);

    function endDrag() {
        if (!dragging) {
            return;
        }
        document.body.style.userSelect = "";
        dragging = false;
        console.log("now rescale");
    }
}
