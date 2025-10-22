import {addButton, createInputElements, addValueRow} from "./controls.js";
import {registerShaderCode} from "./shaderCode.js";
import {appendText} from "./helpers.js";
import {createScrollStackOn, scrollToFirstInterestingLine} from "./events.js";
import {deferExtendedAnalysis} from "../glslCode/deferredAnalysis.js";
import {shiftTime} from "../webgl/render.js";


const generatePage = (elements, state, controls, autoRenderOnLoad) => {

    if (!state.program) {
        elements.workingShader.remove();
        elements.console.innerHTML = renderErrorConsole(state);
    } else {
        elements.console.remove();
    }

    elements.scrollStack = createScrollStackOn(elements.shaders);

    elements.register = [];

    registerShaderCode(
        elements,
        state.source.fragment,
        state.error.fragment,
        "fragment.source",
        "Fragment Shader"
    );
    registerShaderCode(
        elements,
        state.source.vertex,
        state.error.vertex,
        "vertex.source",
        "Vertex Shader"
    );

    if (state.post) {
        appendText(
            elements.shaders,
            "h4",
            "Second Program (Post Processing):"
        );
        registerShaderCode(
            elements,
            state.post.source.fragment,
            state.post.error.fragment,
            "fragment.post.source",
            "Fragment Shader"
        );
        registerShaderCode(
            elements,
            state.post.source.vertex,
            state.post.error.vertex,
            "vertex.post.source",
            "Vertex Shader"
        );
    }

    deferExtendedAnalysis(elements).then(() => {
        scrollToFirstInterestingLine();
    });

    addControlsToPage(elements, state, controls, autoRenderOnLoad);
    addCanvasControls(elements, state);

    elements.initialRenderMs = performance.now() - elements.startRendering;
};

export default generatePage;


export const addControlsToPage = (elements, state, controls, autoRenderOnLoad) => {
    if (!state.program) {
        elements.controls.innerHTML = `
            <div class="error" style="text-align: right;">
                Nothing to render, because compilation failed.
            </div>
        `;
        return;
    }

    if (autoRenderOnLoad) {
        controls.onRender();
    } else {
        addButton(elements.controls, {
            title: "Render!",
            onClick: controls.onRender,
        });
    }

    for (const control of controls.uniforms ?? []) {

        if (control.type === "label") {
            elements[control.name] =
                addValueRow(elements.controls, {
                    label: control.name + " = ",
                    id: control.name
                });
            continue;
        }

        const input = createInputElements(state, control);
        if (!input) {
            console.warn("Undefined Control", control);
            continue;
        }
        elements.controls.appendChild(input.nameLabel);
        elements.controls.appendChild(input.valueLabel);
        elements.controls.appendChild(input.minLabel);
        elements.controls.appendChild(input.input ?? input.container);
        elements.controls.appendChild(input.maxLabel);
        elements.controls.appendChild(input.resetButton);
    }

    document.addEventListener("keydown", event => {
        // Some global time control features, by pressing Ctrl + something.
        if (!event.ctrlKey) {
            return;
        }
        if (document.activeElement !== document.body) {
            return;
        }
        // cf. render.js for how the state variables work
        switch (event.key) {
            case "Backspace":
                state.time = 0.;
                state.startTime = performance.now();
                break;
            case " ":
                if (state.timeRunning) {
                    state.timeRunning = false;
                } else {
                    state.timeRunning = true;
                    state.startTime = performance.now() - 1000. * state.time;
                }
                break;
            case "ArrowLeft":
                shiftTime(state, -1);
                break;
            case "ArrowRight":
                shiftTime(state, +1);
                break;
            case "ArrowUp":
                shiftTime(state, +0.05);
                break;
            case "ArrowDown":
                shiftTime(state, -0.05);
                break;
            default:
                break;
        }
    });
};

function renderErrorConsole(state) {
    let result = `
        <h2>Compilation failed.</h2>
        ${renderCompileStepStatus("Fragment Shader", state.error.fragment, "compiled.")}
        ${renderCompileStepStatus("Vertex Shader", state.error.vertex, "compiled.")}
        ${renderCompileStepStatus("Shader Program", state.error.linker, "linked.")}
    `;

    const locations = Object.entries(state.location);
    if (locations.length > 0) {
        result +=
            `<h4>Locations (whatever these are)</h4>`
            + "<pre>";
        for (const [name, location] of locations) {
            result +=
                `${name.padEnd(20)} -> ${location}\n`;
        }
        result += "</pre>";
    }

    return result;
}

function renderCompileStepStatus(title, error, successMessage) {
    const content = error
        ? `<pre class="error">${error}</pre>`
        : `<div>${successMessage}</div>`;
    return `
        <div>
            <h4>${title}</h4>
            ${content}
        </div>    
    `;
}

function addCanvasControls(elements, state) {
    const plusButton = document.createElement("button");
    plusButton.textContent = "+";
    plusButton.addEventListener("click", resizeHandler(1.05));
    const minusButton = document.createElement("button");
    minusButton.textContent = "\u2013";
    minusButton.addEventListener("click", resizeHandler(0.95));

    elements.canvasControls.appendChild(plusButton);
    elements.canvasControls.appendChild(minusButton);

    function resizeHandler(factor) {
        return () => {
            let width = elements.canvas.width;
            let height = elements.canvas.height;
            width = Math.max(Math.round(width * factor), 1);
            height = Math.max(Math.round(height * factor), 1);
            elements.canvas.style.width = `${width}px`;
            elements.canvas.style.height = `${height}px`;
            // TODO: should we respect window.devicePixelRatio here?
            elements.canvas.width = width;
            elements.canvas.height = height;
            elements.canvas.getContext("webgl2").viewport(0, 0, width, height);
            state.resolution = [width, height];
        };
    }
}
