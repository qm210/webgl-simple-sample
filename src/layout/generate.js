import {addButton, createInputElements, addFreeRow, createResetAllButton} from "./controls.js";
import {registerShaderCode} from "./shaderCode.js";
import {appendButton, appendElement, createDiv, createElement} from "./helpers.js";
import {createScrollStackOn, scrollToFirstInterestingLine} from "./events.js";
import {deferExtendedAnalysis} from "../glslCode/deferredAnalysis.js";
import {shiftTime} from "../webgl/render.js";
import {setCanvasResolution} from "../webgl/setup.js";
import {updateResolutionInState} from "../webgl/helpers.js";
import {addCanvasMouseInteraction} from "./mouse.js";
import {createClipboardButtons} from "./clipboard.js";


const generatePage = (glContext, elements, state, controls, autoRenderOnLoad = true) => {

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
        appendElement(
            elements.shaders,
            "Second Program (Post Processing):",
            "h4",
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

    deferExtendedAnalysis(elements)
        .then(scrollToFirstInterestingLine);

    addCanvasMouseInteraction(elements, state);
    addControlsToPage(elements, state, controls, autoRenderOnLoad);
    addDisplayControls(elements, state, glContext);

    elements.pageLoadingMs = performance.now() - elements.initialMs;
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
        addButton({
            parent: elements.controls,
            title: "Render!",
            onClick: controls.onRender,
        });
    }

    // We nowadays want to always have the time, not specify it in every showcase anymore
    elements.iTime = addFreeRow({
        parent: elements.controls,
        label: "iTime",
        id: "iTime",
        valuePrefix: "=",
        content: [
            createDiv("", "full-spacer"),
            ...createClipboardButtons(elements, state, controls),
            createDiv("", "spacer"),
            createResetAllButton(elements, state, controls)
        ]
    });

    elements.toggles = [];
    for (const control of controls.toggles ?? []) {
        const toggleIndex = elements.toggles.length;
        elements.toggles.push(
            addButton({
                title: control.label(),
                style: control.style,
                onClick: async () => {
                    await control.onClick();
                    const self = elements.toggles[toggleIndex];
                    self.textContent = control.label();
                }
            })
        );
    }
    if (elements.toggles.length > 0) {
        elements.toggleButtons = addFreeRow({
            parent: elements.controls,
            label: "Toggles:",
            content: elements.toggles,
        });
    }

    for (const control of controls.uniforms ?? []) {

        if (control.type === "label") {
            if (elements[control.name] !== undefined) {
                continue;
            }
            // <-- skip overwriting one defined per default (i.e. iTime)
            elements[control.name] =
                addFreeRow({
                    parent: elements.controls,
                    label: control.name,
                    id: control.name,
                    content: createDiv("=", "value-label"),
                });
            continue;
        }
        else if (control.type === "button") {
            elements.controlButtons[control.name] = addButton({
                title: control.label,
                onClick: () =>
                    control.onClick(elements.controlButtons[control.name], control)
            });
            elements[control.name] =
                addFreeRow({
                    parent: elements.controls,
                    label: "",
                    content: elements.controlButtons[control.name]
                })
            continue;
        }

        const input = createInputElements(state, control);
        if (!input) {
            continue;
        }
        elements.controls.appendChild(input.name);
        elements.controls.appendChild(input.value);
        elements.controls.appendChild(input.min);
        elements.controls.appendChild(input.control);
        elements.controls.appendChild(input.max);
        elements.controls.appendChild(input.reset);

        elements.uniforms[control.name] = input;
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
                state.resetSignal = true;
                break;
            case " ":
                if (state.timeRunning) {
                    state.timeRunning = false;
                } else {
                    state.timeRunning = true;
                    state.startTime = null;
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

const PAGE_FONT = {
    cssProperty: "--font-size-factor",
    storageKey: "qm.fontsize.factor"
};

function addDisplayControls(elements, state, glContext) {
    const canvasControls = createDiv();
    elements.displayControls.appendChild(canvasControls);
    appendButton(canvasControls, "+", canvasResize(1.05));
    appendButton(canvasControls, "–", canvasResize(0.95));
    appendElement(canvasControls, "canvas", "label");

    const fontControls = createDiv();
    elements.displayControls.appendChild(fontControls);
    appendButton(fontControls, "↑", pageFontResize(1.05));
    appendButton(fontControls, "￬", pageFontResize(0.95));
    appendElement(fontControls, "font", "label");
    pageFontInitialize();

    const info = appendElement(elements.displayControls, "", "div");
    elements.fps = {
        label: createElement("label", "FPS"),
        display: createDiv("", "fps"),
    }
    info.appendChild(elements.fps.label);
    info.appendChild(elements.fps.display);
    info.addEventListener("click", () => {
        state.debugSignal = true;
    });

    function canvasResize(factor) {
        return () => {
            let width = elements.canvas.width;
            let height = elements.canvas.height;
            width = Math.max(Math.round(width * factor), 1);
            height = Math.max(Math.round(height * factor), 1);
            setCanvasResolution(elements.canvas, glContext, width, height);
            updateResolutionInState(state, gl);
            /*
            // TODO: must recreate framebuffers, but for that we need a short break from rendering
            whilePausingRendering(state, () => {
                state.framebuffer.forEach(fb => {
                    recreateFramebufferWithTexture(glContext, fb);
                });
            });
             */
        };
    }

    function pageFontResize(relativeFactor) {
        return () => {
            const currentFactor = JSON.parse(localStorage.getItem(PAGE_FONT.storageKey) ?? "1");
            const newFactor = Math.max(0.1, currentFactor * relativeFactor).toFixed(3);
            document.documentElement.style.setProperty(PAGE_FONT.cssProperty, newFactor);
            localStorage.setItem(PAGE_FONT.storageKey, newFactor);
        };
    }

    function pageFontInitialize() {
        const currentFactor = JSON.parse(localStorage.getItem(PAGE_FONT.storageKey) ?? "1");
        document.documentElement.style.setProperty(PAGE_FONT.cssProperty, currentFactor);
    }
}
