import {addButton, addInput, addValueLabel} from "./controls.js";
import {appendShaderCode} from "./shaderCode.js";
import {appendText} from "./helpers.js";
import {addStartupListeners, createScrollStackOn} from "./eventListeners.js";


const generatePage = (elements, state, controls, autoRenderOnLoad) => {

    if (!state.program) {
        elements.workingShader.remove();
        elements.console.innerHTML = renderErrorConsole(state);
    } else {
        elements.console.remove();
    }

    elements.scrollStack = createScrollStackOn(elements.shaders);

    appendShaderCode(
        elements,
        state.source.fragment,
        state.error.fragment,
        "fragment.source",
        "Fragment Shader"
    );
    appendShaderCode(
        elements,
        state.source.vertex,
        state.error.vertex,
        "vertex.source",
        "Vertex Shader"
    );

    if (state.post) {
        appendText(
            elements,
            "h4",
            "Second Program (Post Processing):"
        );
        appendShaderCode(
            elements,
            state.post.source.fragment,
            state.post.error.fragment,
            "fragment.post.source",
            "Fragment Shader"
        );
        appendShaderCode(
            elements,
            state.post.source.vertex,
            state.post.error.vertex,
            "vertex.post.source",
            "Vertex Shader"
        );
    }

    addStartupListeners();
    addControlsToPage(elements, state, controls, autoRenderOnLoad);

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

    for (const control of controls) {

        switch (control.type) {
            case "renderButton":
                if (autoRenderOnLoad) {
                    control.onClick();
                } else {
                    addButton(elements.controls, {
                        title: control.title,
                        onClick: control.onClick,
                    });
                }
                break;

            case "label":
                elements[control.name] =
                    addValueLabel(elements.controls, {
                        label: control.name + " = ",
                        id: control.name
                    });
                break;

            case "cursorInput":
            case "floatInput":
                elements[control.name] =
                    addInput(elements.controls, state, control);
                break;

            default:
                console.warn("Undefined Control", control);
        }

    }

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
