import {REGEX, SymbolType} from "./symbols.js";
import {createSpan} from "../layout/helpers.js";

export function withGlslHighlighting(code) {
    return code
        .replaceAll(REGEX.MAGIC_SYMBOL, match =>
            `<span class="magic keyword">${match}</span>`
        )
        .replaceAll(REGEX.DIRECTIVE, match =>
            `<span class="directive">${match}</span>`
        )
        .replaceAll(REGEX.DIRECTIVE_KEYWORD, match =>
            `<span class="directive keyword">${match}</span>`
        )
        .replaceAll(REGEX.BUILTIN_FUNCTION, match =>
            `<span class="builtin">${match}</span>`
        )
        .replaceAll(REGEX.KEYWORD, match =>
            `<span class="keyword">${match}</span>`
        )
        .replaceAll(REGEX.NUMBER, match =>
            `<span class="number">${match}</span>`
        );
}
export function withSymbolsHighlighted(code, analyzedSymbols, lineNumber) {
    let result = code;

    const replacedNames = [];

    for (const symbol of analyzedSymbols) {
        if (replacedNames.includes(symbol.name)) {
            // TODO. we cannot yet handle branching preprocessor directives. just ignore for now.
            continue;
        }

        replacedNames.push(symbol.name);

        let firstMatch = true;

        try {
            result = result.replaceAll(
                symbol.pattern,
                () => {
                    const isDefinition =
                        lineNumber === symbol.definedInLine && firstMatch;
                    firstMatch = false;
                    const element = isDefinition
                        ? highlightedDefinition(symbol)
                        : highlightedUsage(symbol);
                    return element.outerHTML;
                }
            );
        }
        catch (error) {
            console.warn("Could not replace", symbol, result.length);
        }
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
    const classes = [];
    if (!symbol.isMagic) {
        classes.push(SymbolClass[symbol.symbolType]);
    }
    const element = createSpan({
        text: symbol.name,
        id: symbol.name,
        classes,
    });
    if (symbol.unused) {
        element.classList.add("unused");
        element.title = `"${symbol.name}" appears unused.`;
    } else if (symbol.usageCount > 0) {
        element.title = `"${symbol.name}": ${symbol.usageCount}x used`;
    }
    return element;
}

function highlightedUsage(symbol) {
    const classes = ["symbol", SymbolClass[symbol.symbolType]];
    return createSpan({
        text: symbol.name,
        classes,
        data: symbol.name,
    });
}
