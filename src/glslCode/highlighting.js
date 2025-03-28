import REGEX from "./regex.js";
import {createDiv, renderSpan} from "../layout/helpers.js";
import {SymbolType} from "./analysis.js";

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

export function withGlslHighlighting(line) {
    const codeElement = createDiv("", "code");
    codeElement.innerHTML = highlightGLSL(line.code.original);
    return codeElement;
}

export function withSymbolsHighlighted(code, analyzed) {
    const result = {
        original: code,
        code: code,
    };

    for (const symbol of analyzed.symbols) {
        let firstMention = false;
        result.code = result.code.replaceAll(
            symbol.marker.pattern,
            () => {
                const rendered = render(symbol, !firstMention);
                firstMention = true;
                return rendered;
            }
        );
    }

    return result.code;
}

const SymbolClass = {
    [SymbolType.DefineDirective]: "is-defined",
    [SymbolType.ShaderVariable]: "is-global",
    [SymbolType.CustomConstant]: "is-constant",
    [SymbolType.CustomFunction]: "is-custom-function",
};

function render(symbol, isDefinition) {
    if (isDefinition) {
        return renderSpan({
            text: symbol.name,
            id: symbol.name
        });
    }

    const className = (SymbolClass[symbol.symbolType] ?? "") + " symbol";
    const code = symbol.code ?? symbol.lineOfCode;
    const lineInfo = `line ${symbol.definedInLine}`;
    const title = `${lineInfo}: ${code}`;

    return renderSpan({
        text: symbol.name,
        className,
        title,
        data: symbol.name,
    });
}
