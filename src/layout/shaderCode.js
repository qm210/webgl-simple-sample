import {diffLines} from "diff";
import {createHighlightedCode, createDiv} from "./helpers.js";
import {analyzeLines} from "./codeAnalysis.js";

export function appendCodeBlock(parent, shaderSource, errorLog, storageKey) {
    if (!shaderSource) {
        return;
    }

    const element = document.createElement("div");

    const lines = analyzeLines(shaderSource, errorLog, storageKey);

    const rendered = lines.map(renderAnnotatedLine).join("");

    element.classList.add("code-block");
    element.innerHTML = `
        <div class="source">
            ${rendered}
        </div>
    `;

    parent.appendChild(element);
}

function renderAnnotatedLine(line) {
    if (!line.code) {
        return `<div class="empty-line"></div>`;
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

    element.appendChild(
        createDiv(line.number, "line-number")
    );
    element.appendChild(
        createHighlightedCode(line)
    );

    if (annotation) {
        element.appendChild(
            createDiv(annotation, "annotation")
        );
        element.classList.add("annotated");
    }

    return element.outerHTML;
}
