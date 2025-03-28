import {createDiv} from "./helpers.js";
import {analyzeShader} from "../glslCode/analysis.js";
import {withGlslHighlighting, withSymbolsHighlighted} from "../glslCode/highlighting.js";
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
        const elements = prepareElements(line, shaderKey)
        sources.appendChild(elements.line);

        let code = elements.code.innerHTML;
        code = withGlslHighlighting(code);
        code = withSymbolsHighlighted(code, analyzed.symbols, line.number);
        elements.code.innerHTML = code;
    }

    addShaderCodeEventListeners(sources, elements.scrollStack);
}

function idForLine(shaderKey, lineNumber) {
    return `${shaderKey}.line.${lineNumber}`;
}

function prepareElements(line, shaderKey) {
    const element = createDiv("", "line");
    element.id = idForLine(shaderKey, line.number);
    if (!line.code.trimmed) {
        element.classList.add("empty");
    }

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
        element.title = "Was Removed: " + line.removedBefore.join("\n").trim();
    }
    if (errors) {
        element.classList.add("error");
        element.title = errors;
        annotation = errors;
    }

    const numberElement = createDiv(line.number, "line-number");
    element.appendChild(numberElement);

    const codeElement = createDiv(line.code.original, "code");
    element.appendChild(codeElement);

    if (annotation) {
        element.appendChild(
            createDiv(annotation, "annotation")
        );
        element.classList.add("annotated");
    }

    return {
        line: element,
        code: codeElement,
    };
}

function enrichHeader(element, analyzed) {
    const main = analyzed.symbols.find(f => f.name === "main");
    if (!main) {
        element.appendChild(
            createDiv("no main() found!", "error")
        )
        return;
    }

    const mainLink = createDiv(`main() in l. ${main.definedInLine}`, "quicklink");
    element.appendChild(mainLink);

    mainLink.addEventListener("click", () => {
        scrollToElementId(idForLine(analyzed.shaderKey, main.definedInLine))
    });
}