import {addButton, addValueLabel} from "./controls.js";
import {appendCodeBlock} from "./shaderCode.js";
import {appendText} from "./helpers.js";


const generatePage = (elements, state, controls, autoRenderOnLoad) => {

    if (!state.program) {
        elements.workingShader.remove();
        elements.console.innerHTML = renderErrorConsole(state);
    } else {
        elements.console.remove();
    }

    appendCodeBlock(
        elements.shaders,
        state.source.fragment,
        state.error.fragment,
        "fragment.source"
    );
    appendCodeBlock(
        elements.shaders,
        state.source.vertex,
        state.error.vertex,
        "vertex.source"
    );

    if (state.post) {
        appendText(
            elements.shaders,
            "h4",
            "Second Program (Post Processing):"
        );
        appendCodeBlock(
            elements.shaders,
            state.post.source.fragment,
            state.post.error.fragment,
            "fragment.post.source"
        );
        appendCodeBlock(
            elements.shaders,
            state.post.source.vertex,
            state.post.error.vertex,
            "vertex.post.source"
        );
    }

    document.addEventListener("DOMContentLoaded", () => {
        const firstInterestingLine =
            document.querySelector(".line.error")
            ?? document.querySelector(".line.annotated");
        if (firstInterestingLine) {
            firstInterestingLine.scrollIntoView({
                behaviour: "smooth",
                block: "center"
            });
        }
    });

    addControlsToPage(elements, state, controls, autoRenderOnLoad);
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
        ? `<div class="error">${error}</div>`
        : `<div>${successMessage}</div>`;
    return `
        <div>
            <h4>${title}</h4>
            ${content}
        </div>    
    `;
}
