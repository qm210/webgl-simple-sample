export const CodeHighlighting = {
    magicKeyword:
        /\b(gl_Position|gl_PointSize|gl_FragCoord|gl_FrontFacing|gl_PointCoord|main)\b/g,
    keyword:
        /\b(uniform|varying|attribute|const|in|out|[iu]?vec[234]|mat[234]|float|u?int|bool|sampler[123]D|return|discard|continue|break|if|else|texture|texelFetch|precision|highp|mediump|lowp)\b/g,
    builtin:
        /\b(mix|min|max|clamp|smoothstep|step|length|dot|reflect|normalize|sin|cos|exp|log|sqrt|pow|mod|modf|fract|abs|sign|floor|ceil)\b/g,
    number:
        /\b(-?\d+(\.\d+)?(e-?\d+)?U?)/g,
    directive:
        /^\s*(#.*)/g,
};

export function highlightGLSL(code) {
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

const ARROW = "\u2794";

export function replaceKnownDefinitions(code, definitions, lineNumber) {
    let result = code;

    function replace(symbol, className) {
        result = result.replaceAll(symbol.name, match => {
            if (symbol.lineNumber === lineNumber) {
                // do not replace the actual definition ;)
                return match;
            }
            const value = symbol.value ?? match;
            const name = [symbol.keyword ?? "", symbol.type, symbol.name]
                .join(" ");
            const title = symbol.value
                ? `${name} ${ARROW} ${symbol.value} (line ${symbol.lineNumber})`
                : `${name} (line ${symbol.lineNumber})`;
            return `<span class="${className}" title="${title}">${value}</span>`;
        });
    }

    for (const symbol of definitions.defines) {
        replace(symbol, "replaced is-defined");
    }
    for (const symbol of definitions.globals) {
        replace(symbol, "replaced is-global");
    }
    for (const symbol of definitions.constants) {
        replace(symbol, "replaced is-constant");
    }
    return result;
}