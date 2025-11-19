import {diffLines} from "diff";
import {REGEX, SymbolRegex, SymbolType} from "./symbols.js";
import {handleConsecutiveChanges} from "./changes.js";
import {handleDirectives} from "./directives.js";
import {countBlockDelimiters, enhancedFunctionsWithBody, parseScopes} from "./scopes.js";

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
        consecutiveChanged: {type: null},
        directive: {
            current: null,
            conditions: [],
            defined: []
        }
    };

    for (const diff of differences) {
        if (diff.removed) {
            cursor.removedBefore.push(diff.value);
            handleConsecutiveChanges(analyzed, cursor, diff);
            continue;
        }

        const fullOriginal = diff.value;
        const [preVisibleComment, visibleComment] = fullOriginal.split("///");
        const [preHiddenComment, hiddenComment] = preVisibleComment.split("//");
        const original = [preHiddenComment, visibleComment]
            .filter(o => o).join("///");
        const code = {
            original,
            trimmed: original.trim(),
            length: fullOriginal.length,
            hiddenComment: (hiddenComment ?? "").trim(),
            forDebug: {
                fullOriginal, visibleComment, preVisibleComment, preHiddenComment
            },
        };
        code.empty = !code.trimmed;
        code.onlyHiddenComment = code.empty && code.hiddenComment;
        cursor.consecutiveEmpty = code.empty
            ? cursor.consecutiveEmpty + 1
            : 0;

        let changed = diff.added && stored !== "";
        const onlyWhiteSpaceChanged =
            changed &&
            code.trimmed === storedLines[cursor.index]?.trim();
        if (onlyWhiteSpaceChanged) {
            changed = false;
            diff.added = false;
            cursor.removedBefore = [];
        }
        handleConsecutiveChanges(analyzed, cursor, diff);

        const delimiters = countBlockDelimiters(code.trimmed);
        handleDirectives(code.trimmed, cursor.directive);

        analyzed.lines.push({
            code,
            changed,
            number: cursor.index + 1,
            positionInSource: cursor.positionInSource,
            removedBefore: cursor.removedBefore,
            changedBlock: null,
            consecutiveEmpty: cursor.consecutiveEmpty,
            error: errors[cursor.index],
            scopeLevelAtStart: cursor.scopeLevel,
            belongsToUnusedBlock: (
                cursor.commentLevel > 0
                || delimiters.justOpeningComment
                || code.onlyHiddenComment
            ),
            directives: {
                current: cursor.directive.current,
                conditions: [...cursor.directive.conditions],
                defined: [...cursor.directive.defined],
            }
        });
        cursor.index++;
        cursor.removedBefore = [];
        cursor.positionInSource += code.length;
        cursor.scopeLevel += delimiters.delta.braces;
        cursor.commentLevel += delimiters.delta.comments;
    }

    analyzed.lines = analyzed.lines.filter(
        l => l.consecutiveEmpty < 2 && !l.code.onlyHiddenComment
    );

    for (const line of analyzed.lines) {
        if (analyzed.changedBlockAt[line.number]) {
            line.changedBlock = analyzed.changedBlockAt[line.number]
            line.changedBlock.removed = line.changedBlock.diffs
                .filter(d => d.removed);
            line.changedBlock.indent = commonIndentation(line.changedBlock.removed);
        }
    }

    return analyzed;
}

function commonIndentation(diffs) {
    return diffs.reduce(
        (acc, diff) => {
            const leadingSpaces = diff.value.match(REGEX.LEADING_SPACES)?.[0].length;
            if (leadingSpaces === undefined) {
                return acc;
            }
            if (acc === null) {
                return leadingSpaces;
            }
            return Math.min(acc, leadingSpaces);
        },
        null
    ) ?? 0;
}

export async function extendAnalysis(analyzed) {
    analyzed.scopes = parseScopes(analyzed.lines);
    analyzed.symbols = parseSymbols(analyzed.source);
    analyzed.functions = enhancedFunctionsWithBody(analyzed);
    enhanceSymbols(analyzed);
    console.log("Analyzed Shader", analyzed);
    return analyzed;
}

function parseSymbols(source) {
    const results = [];
    for (const symbolType of Object.values(SymbolType)) {
        const matches = source.matchAll(SymbolRegex[symbolType]);
        for (const match of matches) {
            const name = match.groups?.name;
            if (typeof(name) !== "string") {
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
                isMagic: REGEX.MAGIC_SYMBOL.test(name),
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
        symbol.definedInLine = undefined;
        for (const line of analyzed.lines) {
            if (line.positionInSource > symbol.sourcePosition) {
                break;
            }
            symbol.definedInLine = line.number;
        }
    }

    for (const symbol of analyzed.symbols) {
        symbol.usages = [];
        for (const line of analyzed.lines) {
            if (line.number <= symbol.definedInLine) {
                continue;
            }
            if (line.code.trimmed.match(symbol.pattern)) {
                symbol.usages.push(line);
            }
        }
        symbol.firstUsedInLine = symbol.usages[0]?.number;
        symbol.unused = symbol.usages.length === 0 && !symbol.isMagic;
    }

    for (const symbol of analyzed.symbols) {
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
