import REGEX from "./regex.js";
import {createSpan} from "../layout/helpers.js";
import {SymbolType} from "./analysis.js";

export function withGlslHighlighting(code) {
    return code
        .replace(REGEX.MAGIC_SYMBOL, match =>
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

    const replacedNames = [];

    for (const symbol of analyzedSymbols) {
        if (replacedNames.includes(symbol.name)) {
            // TODO. we cannot yet handle preprocessor directives. just ignore for now.
            continue;
        }

        replacedNames.push(symbol.name);

        let firstMatch = true;

        result = result.replaceAll(
            symbol.pattern,
            () => {
                const isDefinition =
                    lineNumber === symbol.definedInLine && firstMatch;
                firstMatch = false;
                const element = isDefinition
                    ? highlightedDefinition(symbol)
                    : highlightedUsage(symbol)
                return element.outerHTML;
            }
        );
    }

    return result;
}

const SymbolClass = {
    [SymbolType.DefineDirective]: "is-defined",
    [SymbolType.ShaderVariable]: "is-global",
    [SymbolType.Constant]: "is-constant",
    [SymbolType.CustomFunction]: "is-custom-function",
};

function highlightedDefinition(symbol) {
    const element = createSpan({
        text: symbol.name,
        id: symbol.name,
    });
    if (symbol.unused) {
        element.classList.add("unused");
        element.title = `"${symbol.name}" appears unused.`;
    } else {
        element.title = `"${symbol.name}": ${symbol.usageCount}x used`;
    }
    return element;
}

function highlightedUsage(symbol) {
    const classes = ["symbol", SymbolClass[symbol.symbolType]];
    const code = symbol.code ?? symbol.lineOfCode;
    const lineInfo = `line ${symbol.definedInLine}`;
    const title = `${lineInfo}: ${code}`;
    return createSpan({
        text: symbol.name,
        classes,
        title,
        data: symbol.name,
    });
}
