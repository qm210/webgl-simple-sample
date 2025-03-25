import {createDiv, renderSpan} from "./helpers.js";
import {analyzeShader} from "../glslCode/codeAnalysis.js";
import {prepareHighlightedCode} from "../glslCode/codeHighlighting.js";
import {addShaderCodeEventListeners, scrollToElementId} from "./eventListeners.js";

export function appendShaderCode(elements, shaderSource, errorLog, shaderKey, title = "") {
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
    enrichHeader(header, analyzed);

    for (const line of analyzed.lines) {
        const annotatedLine = prepareLine(line, analyzed, shaderKey);
        sources.appendChild(annotatedLine);
    }

    sources.innerHTML =
        withMarkersReplaced(sources.innerHTML, analyzed);

    addShaderCodeEventListeners(sources, elements.scrollStack);
}

function idForLine(shaderKey, lineNumber) {
    return `${shaderKey}.line.${lineNumber}`;
}

function prepareLine(line, analyzed, key) {
    if (!line.code) {
        return createDiv("", "empty-line");
    }

    const element = createDiv("", "line");
    element.id = idForLine(key, line.number);

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

function withMarkersReplaced(code, analyzed) {
    const assignedClasses = {
        "defines": "is-defined symbol",
        "globals": "is-global symbol",
        "constants": "is-constant symbol",
        "functions": "is-own-function symbol"
    };

    const result = {
        original: code,
        code: code,
    };

    for (const r of analyzed.replaceMarkers) {
        result.code = result.code.replaceAll(r.marker, render(r));
    }

    return result.code;

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

function enrichHeader(element, analyzed) {
    const main = analyzed.defined.functions.find(f => f.name === "main");
    if (!main) {
        element.appendChild(
            createDiv("no main() found!", "error")
        )
        return;
    }

    const mainLink = createDiv(`main() in l. ${main.lineNumber}`, "quicklink");
    element.appendChild(mainLink);

    mainLink.addEventListener("click", () => {
        scrollToElementId(idForLine(analyzed.shaderKey, main.lineNumber))
    });
}