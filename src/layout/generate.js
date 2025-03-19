import {addButton, addValueLabel} from "./controls.js";
import {displayCode} from "./shaderCode.js";


const generatePage = (elements, state, controls, autoRenderOnLoad) => {

    if (!state.program) {
        elements.workingShader.remove();
        elements.console.innerHTML = renderErrorConsole(state);
    } else {
        elements.console.remove();
    }

    displayCode(
        elements.fragment,
        state.source.fragment,
        state.error.fragment,
        "fragment.source"
    );

    displayCode(
        elements.vertex,
        state.source.vertex,
        state.error.vertex,
        "vertex.source"
    );

    document.addEventListener("DOMContentLoaded", () => {
        const firstChangedLine = document.querySelector(".line.changed");
        if (firstChangedLine) {
            firstChangedLine.scrollIntoView({
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
        <div>
            <h4>Fragment Shader</h4>
            <div>Compile Status: ${state.compileStatus.fragment}</div>
            <div class="error">${state.error.fragment}</div>
        </div>
        <div>
            <h4>Vertex Shader</h4>
            <div>Compile Status: ${state.compileStatus.vertex}</div>
            <div class="error">${state.error.vertex}</div>
        </div>
        <div>
            <h4>Shader Program</h4>
            <div>Link Status: ${state.compileStatus.linker}</div>
            <div class="error">${state.error.linker}</div>
        </div>
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
