import {diffLines} from "diff";
import REGEX, {MAGIC_SYMBOLS} from "./regex.js";

export const SymbolType = {
    DefineDirective: "DefineDirective",
    ShaderVariable: "ShaderVariable",
    Constant: "CustomConstant",
    CustomFunction: "CustomFunction",
    Struct: "CustomStruct",
};

export const ChangeType = {
    Added: "Added",
    Changed: "Changed",
    Removed: "Removed",
};

export function analyzeShader(source, errorLog, shaderKey) {
    const stored = sessionStorage.getItem(shaderKey) ?? "";
    if (shaderKey) {
        sessionStorage.setItem(shaderKey, source);
    }

    const errors = parseErrors(errorLog);
    const storedLines = stored.split("\n");
    const differences = diffLines(stored, source, {
        oneChangePerToken: true
    });

    const analyzed = {
        shaderKey,
        source,
        lines: [],
        symbols: [],
        scopes: [],
        functions: [],
        changedBlockAt: {},
    };
    const cursor = {
        index: 0,
        positionInSource: 0,
        scopeLevel: 0,
        commentLevel: 0,
        removedBefore: [],
        consecutiveEmpty: 0,
        currentChangedBlock: {type: null},
    };

    function handleChangedBlock(diff, type) {
        if (type !== null && cursor.currentChangedBlock.type !== null) {
            if (cursor.currentChangedBlock.type !== type) {
                cursor.currentChangedBlock.type = ChangeType.Changed;
            }
            cursor.currentChangedBlock.endIndex = cursor.index;
            cursor.currentChangedBlock.diffs.push(diff);
        } else {
            if (cursor.currentChangedBlock.type !== null) {
                const lineNumber = cursor.currentChangedBlock.startIndex + 1;
                analyzed.changedBlockAt[lineNumber] = cursor.currentChangedBlock;
            }
            cursor.currentChangedBlock = {
                type,
                startIndex: cursor.index,
                endIndex: cursor.index,
                diffs: type === null ? [] : [diff]
            };
        }
    }

    for (const diff of differences) {
        if (diff.removed) {
            cursor.removedBefore.push(diff.value);
            handleChangedBlock(diff, ChangeType.Removed);
            continue;
        }

        const code = {
            trimmed: diff.value.trim(),
            original: diff.value,
            length: diff.value.length,
        };
        code.empty = !code.trimmed;
        code.blocks = countSeparators(code.trimmed);

        if (code.empty) {
            cursor.consecutiveEmpty++;
        } else {
            cursor.consecutiveEmpty = 0;
        }

        let changed = diff.added && stored !== "";
        const onlyWhiteSpaceChanged =
            changed &&
            code.trimmed === storedLines[cursor.index]?.trim();
        if (onlyWhiteSpaceChanged) {
            changed = false;
            cursor.removedBefore = [];
        }

        handleChangedBlock(diff, changed ? ChangeType.Added : null);

        analyzed.lines.push({
            code,
            changed,
            number: cursor.index + 1,
            removedBefore: cursor.removedBefore,
            changedBlock: null,
            error: errors[cursor.index],
            belongsToUnusedBlock: cursor.commentLevel > 0 || code.blocks.comment.justOpening,
            positionInSource: cursor.positionInSource,
            scopeLevelAtStart: cursor.scopeLevel,
            consecutiveEmpty: cursor.consecutiveEmpty,
        });

        cursor.index++;
        cursor.removedBefore = [];
        cursor.positionInSource += code.length;
        cursor.scopeLevel += code.blocks.braces.open - code.blocks.braces.close;
        cursor.commentLevel += code.blocks.comment.open - code.blocks.comment.close;
    }

    analyzed.lines = analyzed.lines.filter(
        l => l.consecutiveEmpty < 2
    );

    for (const line of analyzed.lines) {
        if (analyzed.changedBlockAt[line.number]) {
            line.changedBlock = analyzed.changedBlockAt[line.number]
            line.changedBlock.removed = line.changedBlock.diffs
                .filter(d => d.removed);
        }
    }

    return analyzed;
}

export async function extendAnalysis(analyzed) {
    analyzed.scopes = parseScopes(analyzed.lines);
    analyzed.symbols = parseSymbols(analyzed.source);
    analyzed.functions = enhancedFunctionsWithBody(analyzed);
    enhanceSymbols(analyzed);

    console.log("Analyzed Shader", analyzed);

    return analyzed;
}

const SymbolRegex = {
    [SymbolType.DefineDirective]: REGEX.DEFINE_DIRECTIVE,
    [SymbolType.ShaderVariable]: REGEX.SHADER_VARIABLE,
    [SymbolType.Constant]: REGEX.CONSTANT,
    [SymbolType.CustomFunction]: REGEX.FUNCTION_SIGNATURE,
    [SymbolType.Struct]: REGEX.STRUCT,
}

function parseSymbols(source) {
    const results = [];
    for (const symbolType in SymbolType) {

        const matches = source.matchAll(SymbolRegex[symbolType]);

        for (const match of matches) {
            const name = match.groups?.name;
            if (!name) {
                continue;
            }
            if (name.match(REGEX.KEYWORD)) {
                continue;
            }
            if (typeof name !== "string") {
                console.error("Symbol Parsing Error: Name cannot be", name);
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

const countRegex = {};

function count(pattern, line) {
    if (!countRegex[pattern]) {
        countRegex[pattern] = new RegExp(pattern, 'g');
    }
    return line.match(countRegex[pattern])?.length ?? 0;
}

function countSeparators(code) {
    return {
        braces: {
            open: count("\{", code),
            close: count("}", code)
        },
        comment: {
            open: count("\/\\*", code),
            close: count("\\*/", code),
            justOpening: code === "/*",
        }
    };
}

export function parseScopes(analyzedLines) {
    const scopes = {
        result: [],
        stack: [],
        cursor: {
            content: [],
            openedIn: 0,
            depth: 0,
        },
    };

    for (const line of analyzedLines) {
        if (line.code.empty) {
            continue;
        }

        const parsedBraces = line.code.trimmed.split('{')
            .map((part, index) =>
                ({
                    part,
                    index,
                    closing: part.split('}')
                        .map((part, index) =>
                            ({
                                part,
                                index
                            })
                        ),
                })
            );

        for (const opened of parsedBraces) {

            for (const closing of opened.closing) {
                if (closing.index < opened.closing.length - 1) {
                    scopes.cursor.closesIn = line.number;
                    scopes.result.push(scopes.cursor);
                    scopes.cursor = scopes.stack.pop();
                } else {
                    scopes.cursor.content.push(closing.part);
                }
            }

            if (opened.index < parsedBraces.length - 1) {
                scopes.stack.push(scopes.cursor);
                scopes.cursor = {
                    content: [],
                    openedIn: line.number,
                    depth: scopes.stack.length,
                };
            }
        }
    }
    scopes.result.push({
        ...scopes.cursor,
        closesIn: analyzedLines.length
    });

    scopes.result.sort(
        (a, b) => a.openedIn - b.openedIn
    );

    return scopes.result;
}

function enhancedFunctionsWithBody(analyzed) {
    const functions = analyzed.symbols.filter(
        s => s.symbolType === SymbolType.CustomFunction
    );

    let nextIndex = 0;
    for (let i = 0; i < analyzed.lines.length; i++) {
        const line = analyzed.lines[i];
        const nextFunction = functions[nextIndex];
        if (!nextFunction) {
            break;
        }

        const nextLinePosition = analyzed.lines[i + 1]?.positionInSource;
        const startsHere = nextLinePosition > nextFunction.sourcePosition;
        if (startsHere) {
            nextFunction.startsAtLine = line.number;
            nextFunction.endsAtLine = line.number + nextFunction.matched.lines.length - 1;

            // needs the scopes to be sorted!
            nextFunction.scope = analyzed.scopes
                .find(scope => scope.openedIn >= nextFunction.endsAtLine);

            nextFunction.actuallyInvalid =
                line.belongsToUnusedBlock || line.scopeLevelAtStart > 0;

            nextIndex++;
        }
    }

    return functions.filter(f => !f.actuallyInvalid);
}

function parseErrors(errorLog) {
    if (!errorLog) {
        return {};
    }

    const errors = {};

    for (const line of errorLog.split('\n')) {
        const parsed = [...line.matchAll(REGEX.ERROR_LOG)][0];
        if (!parsed) {
            continue;
        }

        // note: row counting is 1-based in the OpenGL error logs.
        const column = parseInt(parsed[1]);
        const lineNumber = parseInt(parsed[2]);
        const row = lineNumber - 1;
        const message = parsed[3];

        if (!errors[row]) {
            errors[row] = {
                lineNumber,
                lines: [],
                inRow: []
            }
        }
        errors[row].lines.push(line)
        errors[row].inRow.push({column, message});
    }

    return errors;
}

function enhanceSymbols(analyzed) {
    for (const symbol of analyzed.symbols) {
        for (const line of analyzed.lines) {
            if (line.positionInSource > symbol.sourcePosition) {
                break;
            }
            symbol.definedInLine = line.number;
        }
    }

    for (const symbol of analyzed.symbols) {
        // -1 because the definition itself doesn't count as usage :)
        symbol.usageCount = [...analyzed.source.matchAll(symbol.pattern)].length - 1;
        symbol.unused = symbol.usageCount < 1 && !symbol.isMagic;

        symbol.definitionSpansLines = 1;

        if (symbol.symbolType === SymbolType.CustomFunction) {
            const functionMatch = analyzed.functions.find(
                match => match.name === symbol.name
            );
            if (!functionMatch?.scope) {
                continue;
            }
            symbol.definitionSpansLines = functionMatch.scope.closesIn + 1 - functionMatch.startsAtLine;
        }
    }

    analyzed.unusedSymbols = analyzed.symbols
        .filter(symbol => symbol.unused);

    for (const symbol of analyzed.unusedSymbols) {
        for (let l = 0; l < symbol.definitionSpansLines; l++ ) {
            const analyzedLine = analyzed.lines.find(
                line => line.number === symbol.definedInLine + l
            );
            if (!analyzedLine) {
                break;
            }
            analyzedLine.belongsToUnusedBlock = true;
        }
    }
}
