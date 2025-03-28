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
    const functionMatches = parseFunctions(source);

    const analyzed = {
        lines: [],
        symbols: [],
        shaderKey,
    };
    let lineIndex = 0;
    let removedBefore = [];
    let consecutiveBlanks = 0;

    for (const diff of differences) {
        if (diff.removed) {
            removedBefore.push(diff.value);
            continue;
        }

        const trimmedCode = diff.value.trim();
        let changed = diff.added && stored !== "";
        try {
            const onlyWhiteSpaceChanged =
                changed &&
                trimmedCode === storedLines[lineIndex]?.trim();
            if (onlyWhiteSpaceChanged) {
                changed = false;
                removedBefore = [];
            }
        } catch (err) {
            console.warn("Error Comparing", err, `"${diff.value}"`, storedLines);
        }

        if (trimmedCode === "" || trimmedCode === "{") {
            consecutiveBlanks++;
        } else {
            consecutiveBlanks = 0;
        }

        analyzed.lines.push({
            code: {
                original: diff.value,
                trimmed: trimmedCode,
            },
            changed,
            removedBefore,
            error: errors[lineIndex],
            number: lineIndex + 1,
            consecutiveBlanks,
        });
        removedBefore = [];
        lineIndex++;
    }

    analyzed.lines = analyzed.lines.filter(
        l => l.consecutiveBlanks < 2
    );

    analyzed.symbols = parseSymbols(analyzed.lines);
    analyzed.scopes = parseScopes(analyzed);

    console.log("Analyzed Shader", {analyzed, functionMatches});

    return analyzed;
}

const SymbolRegex = {
    [SymbolType.DefineDirective]: REGEX.DEFINE_DIRECTIVE,
    [SymbolType.ShaderVariable]: REGEX.SHADER_VARIABLE,
    [SymbolType.CustomConstant]: REGEX.CONSTANT,
    [SymbolType.CustomFunction]: REGEX.FUNCTION_SIGNATURE,
}

function parseSymbols(lines) {
    const result = [];
    for (const line of lines) {
        for (const symbolType in SymbolType) {

            const regex = SymbolRegex[symbolType];
            const matches = line.code.trimmed.matchAll(regex);
            for (const match of matches) {

                const name = match.groups?.name;

                if (!name) {
                    continue;
                }

                const marker = {
                    definition: `!${name}!`,
                    usage: `$${name}$`,
                    pattern:
                        new RegExp(`\\b${name}\\b`, "g"),
                };

                result.push({
                    ...match.groups,
                    marker,
                    symbolType,
                    lineOfCode: line.code.trimmed,
                    definedInLine: line.number
                });
            }
        }
    }
    return result;
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
        const parsedBraces = line.code.trimmed.split('{')
            .map((part, index) => ({
                betweenOpening: part,
                parts: part.split('}').map(
                    (innerPart, innerIndex) => ({
                        innerPart,
                        index: innerIndex
                    })
                ),
                index,
            }));

        console.log("----- ", line.code.trimmed, parsedBraces)
        for (const opened of parsedBraces) {

            console.log("   -- ", scopes.cursor.openedIn, "->", opened.parts)
            for (const part of opened.parts) {
                if (part.index < opened.parts.length - 1) {
                    scopes.cursor.closesIn = line.number;
                    scopes.result.push(scopes.cursor);
                    scopes.cursor = scopes.stack.pop();
                } else {
                    scopes.cursor.content.push(part.innerPart);
                }
            }

            console.log("   ------ now at", opened.index, parsedBraces.length, scopes.result);
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
    return scopes.result;
}

function extendFunctionDefinitionIfMatch(targetList, matches, code, lineNumber) {
    const signature = code.match(REGEX.FUNCTION_SIGNATURE)?.groups;
    if (!signature) {
        return;
    }
    const match = matches.find(match =>
        match.name === signature.name &&
        match.returnType === signature.returnType &&
        match.args === signature.args
    );
    if (!match) {
        return;
    }
    targetList.push({
        ...match,
        lineNumber
    });
}

function parseFunctions(code) {
    const result = [];

    for (const match of code.matchAll(REGEX.FUNCTION)) {
        const falsePositive = (
            REGEX.KEYWORD.test(match.groups.name) ||
            match.groups.returnType === "return"
        );
        if (falsePositive) {
            continue;
        }

        const code = match[0].trim();
        const lineOfCode = code.split("\n")[0];
        result.push({...match.groups, code, lineOfCode});
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
