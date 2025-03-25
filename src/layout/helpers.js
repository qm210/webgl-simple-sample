import {highlightGLSL, highlightDefinedSymbols} from "../glslCode/codeHighlighting.js";

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

export function createHighlightedCode(analyzedLine, scrollStack) {
    const codeElement = createDiv("", "code");
    codeElement.innerHTML =
        highlightDefinedSymbols(
            highlightGLSL(analyzedLine.code),
            analyzedLine.defined,
            analyzedLine.number,
        );

    for (const symbolElement of document.getElementsByClassName("symbol")) {
        symbolElement.addEventListener("click", () => {
            const id = symbolElement.getAttribute("data-id");
            const target = document.getElementById(id);
            if (target) {
                scrollStack.push(symbolElement);
                target.scrollIntoView({
                    behaviour: "smooth",
                    block: "start"
                });
                console.log("SCROLL STACK", scrollStack);
            } else {
                console.error("Target Element does not exist", id, symbolElement);
            }
        })
    }



    return codeElement;
}
