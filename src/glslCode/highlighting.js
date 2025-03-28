import REGEX from "./regex.js";
import {renderSpan} from "../layout/helpers.js";
import {SymbolType} from "./analysis.js";

export function withGlslHighlighting(code) {
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
export function withSymbolsHighlighted(code, analyzedSymbols, lineNumber) {
    let result = code;

    for (const symbol of analyzedSymbols) {
        let firstMatch = true;

        result = result.replaceAll(
            symbol.pattern.original,
            () => {
                const isDefinition = lineNumber === symbol.definedInLine && firstMatch;
                const rendered = render(symbol, isDefinition);
                firstMatch = false;
                return rendered;
            }
        );
    }

    return result;
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
