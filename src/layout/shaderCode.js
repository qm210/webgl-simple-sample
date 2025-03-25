import {createHighlightedCode, createDiv} from "./helpers.js";
import {analyzeShader} from "../glslCode/codeAnalysis.js";

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

    const analyzedLines = analyzeShader(shaderSource, errorLog, storageKey);

    for (const line of analyzedLines) {
        const annotatedLine = createAnnotatedLine(line, elements.scrollStack);
        sourceColumn.appendChild(annotatedLine);
    }
}

function createAnnotatedLine(line, scrollStack) {
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

    const codeElement = createHighlightedCode(line, scrollStack);
    element.appendChild(codeElement);

    if (annotation) {
        element.appendChild(
            createDiv(annotation, "annotation")
        );
        element.classList.add("annotated");
    }

    return element;
}
