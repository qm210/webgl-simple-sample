import REGEX from "./regexp.js";
import {createDiv} from "../layout/helpers.js";

function highlightGLSL(code) {
    return code
        .replace(REGEX.MAGIC_KEYWORD, match =>
            `<span class="magic keyword">${match}</span>`
        )
        .replace(REGEX.DIRECTIVE, match =>
            `<span class="directive">${match}</span>`
        )
        .replace(REGEX.BUILTIN_FUNCTION, match =>
            `<span class="builtin">${match}</span>`
        )
        .replace(REGEX.KEYWORD, match =>
            `<span class="keyword">${match}</span>`
        )
        .replace(REGEX.NUMBER, match =>
            `<span class="number">${match}</span>`
        );
}

export function prepareHighlightedCode(analyzedLine, analyzed) {
    const codeElement = createDiv("", "code");

    let code = highlightGLSL(analyzedLine.code);

    for (const key in analyzed.defined) {
        for (const symbol of analyzed.defined[key]) {
            code = code.replaceAll(
                symbol.marker.originalRegExp,
                symbol.lineNumber === analyzedLine.number
                    ? symbol.marker.definition
                    : symbol.marker.usage
            );
        }
    }

    codeElement.innerHTML = code;
    return codeElement;
}
