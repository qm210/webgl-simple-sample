import {diffLines} from "diff";
import {REGEX} from "./definitions.js";
import {enhanceChangedBlocks, handleConsecutiveChanges} from "./changes.js";
import {handleDirectives} from "./directives.js";
import {countBlockDelimiters, enhancedFunctionsWithBody, parseScopes} from "./scopes.js";
import {enhanceSymbols, parseSymbols} from "./symbols.js";

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
            belongsTo: {
                unusedCode: false,
                comment: (
                    cursor.commentLevel > 0
                    || delimiters.justOpeningComment
                    || code.onlyHiddenComment
                )
            },
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

    analyzed.lines = analyzed.lines.filter(l =>
        l.consecutiveEmpty < 2
        && !l.code.onlyHiddenComment
    );

    enhanceChangedBlocks(analyzed);

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
