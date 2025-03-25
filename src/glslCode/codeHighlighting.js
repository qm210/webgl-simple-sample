import {createDiv, renderSpan} from "../layout/helpers.js";

export const CodeHighlighting = {
    magicKeyword:
        /\b(gl_Position|gl_PointSize|gl_FragCoord|gl_FrontFacing|gl_PointCoord|main)\b/g,
    keyword:
        /\b(uniform|varying|attribute|const|in|out|[iu]?vec[234]|mat[234]|void|float|u?int|bool|sampler[123]D|return|discard|continue|break|if|else|texture|texelFetch|precision|highp|mediump|lowp)\b/g,
    builtin:
        /\b(mix|min|max|clamp|smoothstep|step|length|dot|normalize|cross|reflect|refract|sinh?|cosh?|tanh?|atan|exp|log|sqrt|pow|mod|modf|fract|abs|sign|floor|ceil)\b/g,
    number:
        /\b(-?\d+\.?\d*(e-?\d+)?[Uf]?)/g,
    directive:
        /^\s*(#.*)/g,
};

function highlightGLSL(code) {
    return code
        .replace(CodeHighlighting.magicKeyword, match =>
            `<span class="magic keyword">${match}</span>`
        )
        .replace(CodeHighlighting.directive, match =>
            `<span class="directive">${match}</span>`
        )
        .replace(CodeHighlighting.builtin, match =>
            `<span class="builtin">${match}</span>`
        )
        .replace(CodeHighlighting.keyword, match =>
            `<span class="keyword">${match}</span>`
        )
        .replace(CodeHighlighting.number, match =>
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
