import {REGEX, SymbolRegex, SymbolType} from "./definitions.js";

export function parseSymbols(source) {
    const results = [];
    for (const symbolType of Object.values(SymbolType)) {
        const matches = source.matchAll(SymbolRegex[symbolType]);
        for (const match of matches) {
            const name = match.groups?.name;
            if (typeof (name) !== "string") {
                continue;
            }
            if (name.match(REGEX.KEYWORD) || name.match(REGEX.DIRECTIVE_KEYWORD)) {
                continue;
            }

            // TODO: can not yet parse whether the block is disabled via #if-directive etc...

            const matched = match[0].trim();
            const matchedLines = matched.split('\n');
            const result = {
                ...match.groups,
                symbolType,
                sourcePosition: match.index,
                pattern:
                    new RegExp(`\\b${name}\\b`, "g"),
                matched: {
                    trimmed: matched,
                    full: match[0],
                    lines: matchedLines,
                },
                isMagic: name.match(REGEX.MAGIC_SYMBOL),
            };
            if (result.args) {
                result.argString = result.args
                    .trim()
                    .replaceAll(/\s+/g, ' ')
                    .replaceAll(/\s*,\s*/g, ', ');
                result.argArray = result.argString
                    .split(', ');
            }
            results.push(result);
        }
    }
    return results;
}

export function enhanceSymbols(analyzed) {
    // Note: These are lavishly nested loops, but they did not cause large loading times, yet, for me.

    for (const symbol of analyzed.symbols) {
        symbol.definedInLine = locateDefinitionLine(symbol, analyzed.lines);
        symbol.definitionSpansLines = measureDefinitionLines(symbol, analyzed.functions);

        symbol.usages = collectUsages(symbol, analyzed.lines);
        symbol.firstUsedInLine = symbol.usages[0]?.number;
        symbol.unused = symbol.usages.length === 0 && !symbol.isMagic;
    }

    analyzed.unusedSymbols = analyzed.symbols
        .filter(symbol => symbol.unused);

    for (const symbol of analyzed.unusedSymbols) {
        for (let l = 0; l < symbol.definitionSpansLines; l++) {
            const analyzedLine = analyzed.lines.find(
                line => line.number === symbol.definedInLine + l
            );
            if (!analyzedLine) {
                continue;
            }
            analyzedLine.belongsTo.unusedCode = true;
        }
    }
    const emptyBlocksBetween = linesBetweenUnusedSymbols(analyzed);
    for (const block of emptyBlocksBetween) {
        for (const line of block) {
            line.belongsTo.unusedCode = true;
        }
    }
}

function locateDefinitionLine(symbol, analyzedLines) {
    let lineNumber = null;
    for (const line of analyzedLines) {
        if (line.positionInSource > symbol.sourcePosition) {
            break;
        }
        lineNumber = line.number;
    }
    return lineNumber;
}

function measureDefinitionLines(symbol, analyzedFunctions) {
    if (symbol.symbolType === SymbolType.CustomFunction) {
        const functionMatch = analyzedFunctions.find(
            match => match.name === symbol.name
        );
        if (functionMatch?.scope) {
            return functionMatch.scope.closesIn + 1 - functionMatch.startsAtLine;
        }
    }
    return 1;
}

function collectUsages(symbol, analyzedLines) {
    const usages = [];
    for (const line of analyzedLines) {
        if (line.number <= symbol.definedInLine) {
            continue;
        }
        if (line.code.trimmed.match(symbol.pattern)) {
            usages.push(line);
        }
    }
    return usages;
}

function linesBetweenUnusedSymbols(analyzed) {
    const blocks = [];
    if (analyzed.unusedSymbols.length < 2) {
        return blocks;
    }
    let symbolIndex = 0;
    let [symbol, nextSymbol] = symbolWithNext(symbolIndex);
    let block = [];
    let proceed = false;
    for (const line of analyzed.lines) {
        if (line.number < symbol.definedInLine + symbol.definitionSpansLines) {
            continue;
        }
        if (line.number === nextSymbol.definedInLine) {
            blocks.push(block);
            proceed = true;
        } else if (!line.code.empty) {
            proceed = true;
        } else {
            block.push(line);
        }

        if (proceed) {
            symbolIndex++;
            if (symbolIndex > analyzed.unusedSymbols.length - 2) {
                break;
            }
            block = [];
            [symbol, nextSymbol] = symbolWithNext(symbolIndex);
            proceed = false;
        }
    }
    return blocks;

    function symbolWithNext(index) {
        return analyzed.unusedSymbols.slice(index, index + 2);
    }
}