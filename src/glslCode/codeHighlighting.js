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

export function highlightDefinedSymbols(code, definitions, lineNumber) {
    let result = code;

    function replace(symbol, className) {
        const symbolUsed =
            new RegExp(`(?<!")${symbol.name}(?!")`, "g");

        result = result.replaceAll(symbolUsed, match => {

            if (symbol.lineNumber === lineNumber) {
                // do not replace the actual definition ;)
                return `<span id="${symbol.name}">${match}</span>`;
            }

            const title = `line ${symbol.lineNumber}: ${symbol.lineOfCode}`
                .replaceAll(symbol.name, '...');
            // <-- have to replace the name, otherwise this very replaceAll will conflict :D

            const attributes = `class="${className}" title="${title}" data-id="${symbol.name}"`;
            return `<span ${attributes}>${match}</span>`;
        });
    }

    for (const symbol of definitions.defines) {
        replace(symbol, "is-defined symbol");
    }
    for (const symbol of definitions.globals) {
        replace(symbol, "is-global symbol");
    }
    for (const symbol of definitions.constants) {
        replace(symbol, "is-constant symbol");
    }
    for (const symbol of definitions.functions) {
        replace(symbol, "is-own-function symbol")
    }
    return result;
}
