import {createDiv} from "./helpers.js";
import {analyzeShader} from "../glslCode/analysis.js";

export function registerShaderCode(elements, shaderSource, errorLog, shaderKey, title = "") {
    if (!shaderSource) {
        return;
    }

    const codeBlock = createDiv("", "code-block");
    elements.shaders.appendChild(codeBlock);

    const header = createDiv(title, "code-header");
    codeBlock.appendChild(header);

    const sources = createDiv("", "source");
    codeBlock.appendChild(sources);

    const analyzed = analyzeShader(shaderSource, errorLog, shaderKey);

    const references = {header, sources};

    for (const line of analyzed.lines) {
        const elements = prepareElements(line, shaderKey);
        sources.appendChild(elements.line);

        references[line.number] = elements;
    }

    elements.register.push({shaderKey, references, analyzed});
}

export function idForLine(shaderKey, lineNumber) {
    return `${shaderKey}.line.${lineNumber}`;
}

function prepareElements(line, shaderKey) {
    const elements = {
        line: createDiv("", "line"),
        code: createDiv(line.code.original, "code"),
        number: createDiv(line.number, "line-number"),
        annotation: createDiv("", "annotation"),
        changedInfo: createDiv("", "changed-info"),
    };
    elements.line.appendChild(elements.number);
    elements.line.appendChild(elements.code);
    elements.line.appendChild(elements.annotation);
    elements.line.id = idForLine(shaderKey, line.number);

    let annotation = "";

    if (line.code.empty) {
        elements.line.classList.add("empty");
    }
    if (line.changed) {
        elements.line.classList.add("changed");
        elements.line.title = "Line Changed"
        annotation = line.removedBefore.length === 0
            ? "added"
            : "changed";
    }
    if (line.removedBefore.length > 0) {
        elements.line.classList.add("removed-before");
        elements.line.title = "Was Removed: " + line.removedBefore.join("\n").trim();
    }
    if (line.changedBlock?.removed.length > 0) {
        elements.line.appendChild(elements.changedInfo);
        writeRemovedBlock(elements.changedInfo, line);
    }

    const errors = line.error
        ?.inRow
        .map(error => error.message)
        .join('; ') ?? "";
    if (errors) {
        elements.line.classList.add("error");
        elements.line.title = errors;
        annotation = errors;
    }

    elements.annotation.textContent = annotation;

    if (annotation) {
        elements.annotation.classList.add("annotated");
    }

    return elements;
}

const CLOSE_X = "\u2716";
const TRIANGLE_UP = "\u25b2";

function writeRemovedBlock(parent, line) {
    const hideButton = document.createElement("button");
    hideButton.textContent = CLOSE_X;
    hideButton.addEventListener("click", () => {
        parent.classList.toggle("info-collapsed");
        hideButton.textContent = (
            parent.classList.contains("info-collapsed")
                ? TRIANGLE_UP
                : CLOSE_X
        );
    });

    parent.appendChild(createDiv("Removed:"));
    parent.appendChild(hideButton);
    let lineNumber = line.number;
    for (const removed of line.changedBlock.removed) {
        parent.appendChild(createDiv(lineNumber, "line-number"));
        parent.appendChild(createDiv(removed.value));
        parent.appendChild(createDiv());
        lineNumber++;
    }
}