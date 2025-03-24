import {highlightGLSL, highlightDefinedSymbols} from "./codeHighlighting.js";

export function createDiv(content, classes) {
    const div = document.createElement("div");
    if (classes) {
        div.classList.add(...classes.split(" "));
    }
    div.textContent = content.toString();
    return div;
}

export function appendText(parent, tagName, textContent) {
    const element = document.createElement(tagName);
    element.textContent = textContent;
    parent.appendChild(element);
}

export function createHighlightedCode(analyzedLine) {
    const element = createDiv("", "code");
    element.innerHTML = highlightDefinedSymbols(
        highlightGLSL(analyzedLine.code),
        analyzedLine.defined,
        analyzedLine.number,
    );
    return element;
}
