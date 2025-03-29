import {diffLines} from "diff";
import REGEX from "./regex.js";

export const SymbolType = {
    DefineDirective: "DefineDirective",
    ShaderVariable: "ShaderVariable",
    CustomConstant: "CustomConstant",
    CustomFunction: "CustomFunction"
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
        matches: {},
    };
    const cursor = {
        index: 0,
        positionInSource: 0,
        scopeLevel: 0,
        removedBefore: [],
        consecutiveEmpty: 0,
    };

    for (const diff of differences) {
        if (diff.removed) {
            cursor.removedBefore.push(diff.value);
            continue;
        }

        const code = {
            trimmed: diff.value.trim(),
            original: diff.value,
            length: diff.value.length,
        };
        code.empty = !code.trimmed;
        code.braces = countBraces(code.trimmed);

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

        const lineNumber = cursor.index + 1;
        const symbols = parseSymbols(code.trimmed, lineNumber);

        analyzed.lines.push({
            code,
            changed,
            number: lineNumber,
            removedBefore: cursor.removedBefore,
            error: errors[cursor.index],
            belongsToUnusedDefinition: false,
            positionInSource: cursor.positionInSource,
            scopeLevelAtStart: cursor.scopeLevel,
            consecutiveEmpty: cursor.consecutiveEmpty,
        });
        analyzed.symbols.push(...symbols);

        cursor.index++;
        cursor.removedBefore = [];
        cursor.positionInSource += code.length;
        cursor.scopeLevel += code.braces.open - code.braces.close;
    }

    analyzed.lines = analyzed.lines.filter(
        l => l.consecutiveEmpty < 2
    );

    analyzed.scopes = parseScopes(analyzed);
    analyzed.functionMatches = parseFunctionSignatures(analyzed);
    enhanceSymbols(analyzed);

    console.log("Analyzed Shader", analyzed);

    return analyzed;
}

const SymbolRegex = {
    [SymbolType.DefineDirective]: REGEX.DEFINE_DIRECTIVE,
    [SymbolType.ShaderVariable]: REGEX.SHADER_VARIABLE,
    [SymbolType.CustomConstant]: REGEX.CONSTANT,
    [SymbolType.CustomFunction]: REGEX.FUNCTION_SIGNATURE,
}

function parseSymbols(code, lineNumber) {
    const result = [];
    for (const symbolType in SymbolType) {

        const regex = SymbolRegex[symbolType];
        const matches = code.matchAll(regex);
        for (const match of matches) {

            const name = match.groups?.name;

            if (!name) {
                continue;
            }

            const pattern =
                    new RegExp(`\\b${name}\\b`, "g");

            // TODO: might check whether we are in a block defined that is disabled via directive...

            result.push({
                ...match.groups,
                pattern,
                symbolType,
                lineOfCode: code,
                definedInLine: lineNumber,
            });
        }
    }
    return result;
}

function countBraces(code) {
    return {
        open: code.match(/\{/g)?.length ?? 0,
        close: code.match(/}/g)?.length ?? 0,
    };
}

export function parseScopes(analyzed) {
    const scopes = {
        result: [],
        stack: [],
        cursor: {
            content: [],
            openedIn: 0,
            depth: 0,
        },
    };

    for (const line of analyzed.lines) {
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
        closesIn: analyzed.lines.length
    });

    scopes.result.sort(
        (a, b) => a.openedIn - b.openedIn
    );

    return scopes.result;
}

function parseFunctionSignatures(analyzed) {
    const result = [];

    for (const match of analyzed.source.matchAll(REGEX.FUNCTION_SIGNATURE)) {
        const argString = match.groups.args
            .trim()
            .replaceAll(/\s+/g, ' ')
            .replaceAll(/\s*,\s*/g, ', ');
        const argArray = argString
            .split(', ');
        const matchString = match[0]
            .replaceAll(/^(\s*\n)*/g, '');

        result.push({
            ...match.groups,
            argString,
            argArray,
            matchString,
            sourcePosition: match.index
        });
    }

    let nextIndex = 0;
    for (const line of analyzed.lines) {

        const nextSignature = result[nextIndex];
        if (!nextSignature) {
            break;
        }

        const possibleSourceMatch = analyzed.source.slice(
            line.positionInSource,
            line.positionInSource + nextSignature.matchString.length
        );
        const startsHere = nextSignature.matchString === possibleSourceMatch;
        if (startsHere) {
            nextSignature.startsAtLine = line.number;
            nextSignature.lineSpan = nextSignature.matchString.split('\n').length;
            nextSignature.endsAtLine = line.number + nextSignature.lineSpan - 1;

            // needs the scopes to be sorted!
            nextSignature.functionScope = analyzed.scopes
                .find(scope => scope.openedIn >= nextSignature.endsAtLine);

            nextIndex++;
        }
    }

    return result;
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
        // -1 because the definition itself doesn't count as usage :)
        symbol.usageCount = [...analyzed.source.matchAll(symbol.pattern)].length - 1;

        symbol.unused = symbol.usageCount === 0
            && !REGEX.MAGIC_SYMBOL.test(symbol.name);

        symbol.definitionSpansLines = 1;

        if (symbol.symbolType === SymbolType.CustomFunction) {
            const functionMatch = analyzed.functionMatches.find(
                match => match.name === symbol.name
            );
            symbol.definitionSpansLines = functionMatch.functionScope.closesIn + 1 - functionMatch.startsAtLine;
        }
    }

    analyzed.unusedSymbols = analyzed.symbols
        .filter(symbol => symbol.unused);

    for (const symbol of analyzed.unusedSymbols) {
        for (let l = 0; l < symbol.definitionSpansLines; l++ ) {
            const lineIndex = symbol.definedInLine + l - 1;
            const analyzedLine = analyzed.lines[lineIndex];
            analyzedLine.belongsToUnusedDefinition = true;
        }
    }
}
