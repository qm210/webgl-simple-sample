import {createDiv, renderSpan} from "./helpers.js";
import {analyzeShader} from "../glslCode/codeAnalysis.js";
import {prepareHighlightedCode} from "../glslCode/codeHighlighting.js";
import {addShaderCodeEventListeners} from "./eventListeners.js";

export function appendShaderCode(elements, shaderSource, errorLog, storageKey) {
    if (!shaderSource) {
        return;
    }

    const codeBlock = document.createElement("div");
    codeBlock.classList.add("code-block");
    elements.shaders.appendChild(codeBlock);

    const sourceColumn = document.createElement("div");
    sourceColumn.classList.add("source");
    codeBlock.appendChild(sourceColumn);

    const analyzed = analyzeShader(shaderSource, errorLog, storageKey);

    for (const line of analyzed.lines) {
        const annotatedLine = prepareLine(line, analyzed);
        sourceColumn.appendChild(annotatedLine);
    }

    sourceColumn.innerHTML =
        withMarkersReplaced(sourceColumn.innerHTML, analyzed);

    addShaderCodeEventListeners(sourceColumn, elements.scrollStack);
}

function prepareLine(line, analyzed) {
    if (!line.code) {
        return createDiv("", "empty-line");
    }

    const element = createDiv("", "line");

    const errors = line.error
        ?.inRow
        .map(error => error.message)
        .join('; ') ?? "";

    let annotation = "";

    if (line.changed) {
        element.classList.add("changed");
        element.title = "Line Changed"
        annotation = "changed";
    }
    if (line.removedBefore.length > 0) {
        element.classList.add("removed-before");
        element.title = "Was Removed: " + line.removedBefore.join("\n");
    }
    if (errors) {
        element.classList.add("error");
        element.title = errors;
        annotation = errors;
    }

    const numberElement = createDiv(line.number, "line-number");
    numberElement.id = `l.${line.number}`;
    element.appendChild(numberElement);

    const codeElement = prepareHighlightedCode(line, analyzed);
    element.appendChild(codeElement);

    if (annotation) {
        element.appendChild(
            createDiv(annotation, "annotation")
        );
        element.classList.add("annotated");
    }

    return element;
}

function withMarkersReplaced(result, analyzed) {
    const assignedClasses = {
        "defines": "is-defined symbol",
        "globals": "is-global symbol",
        "constants": "is-constant symbol",
        "functions": "is-own-function symbol"
    };

    for (const r of analyzed.replaceMarkers) {
        result = result.replaceAll(r.marker, render(r));
    }

    return result;

    function render(r) {
        if (r.isDefinition) {
            return renderSpan({
                text: r.symbol.name,
                id: r.symbol.name
            });
        }

        const className = assignedClasses[r.key];
        const title = `line ${r.symbol.lineNumber}: ${r.symbol.code ?? r.symbol.lineOfCode}`;
        return renderSpan({
            text: r.symbol.name,
            className,
            title,
            data: r.symbol.name,
        });
    }
}
