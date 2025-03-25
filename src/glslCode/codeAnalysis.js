import {diffLines} from "diff";
import REGEX from "./regexp.js";

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
        defined: {
            defines: [],
            globals: [],
            constants: [],
            functions: [],
        },
        replaceMarkers: [],
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

        const actualCode = diff.value.trim();
        let changed = diff.added && stored !== "";
        try {
            const onlyWhiteSpaceChanged = changed &&
                actualCode === storedLines[lineIndex]?.trim();
            if (onlyWhiteSpaceChanged) {
                changed = false;
                removedBefore = [];
            }
        } catch (err) {
            console.warn("Error Comparing", err, `"${diff.value}"`, storedLines);
        }

        const lineNumber = lineIndex + 1;
        const noContent = !actualCode || actualCode === "{";
        if (noContent) {
            consecutiveBlanks++;
        } else {
            consecutiveBlanks = 0;
        }

        extendDefinitionIfMatch(
            analyzed.defined.defines,
            REGEX.DEFINE,
            actualCode,
            lineNumber
        );
        extendDefinitionIfMatch(
            analyzed.defined.globals,
            REGEX.GLOBAL,
            actualCode,
            lineNumber
        );
        extendDefinitionIfMatch(
            analyzed.defined.constants,
            REGEX.CONSTANT,
            actualCode,
            lineNumber
        );
        extendFunctionDefinitionIfMatch(
            analyzed.defined.functions,
            functionMatches,
            actualCode,
            lineNumber
        );

        analyzed.lines.push({
            code: diff.value,
            changed,
            removedBefore,
            error: errors[lineIndex],
            number: lineNumber,
            consecutiveBlanks,
        });
        removedBefore = [];
        lineIndex++;
    }

    analyzed.lines = analyzed.lines.filter(
        l => l.consecutiveBlanks < 2
    );

    for (const key in analyzed.defined) {
        defineMarkers(analyzed, key);
    }

    console.log("Analyzed Shader", {analyzed, functionMatches});

    return analyzed;

    function defineMarkers(analyzed, key) {
        const symbols = analyzed.defined[key];
        for (let s = 0; s < symbols.length; s++) {
            const symbol = symbols[s];
            symbol.marker = {
                definition: `!${symbol.name}!`,
                usage: `$${symbol.name}$`,
                originalRegExp:
                    new RegExp(`(?<![$!])${symbol.name}(?![$!])`, "g")
            };

            analyzed.replaceMarkers.push({
                marker: symbol.marker.definition,
                isDefinition: true,
                symbol,
                key,
            });
            analyzed.replaceMarkers.push({
                marker: symbol.marker.usage,
                isDefinition: false,
                symbol,
                key
            });
        }
    }
}

function extendDefinitionIfMatch(targetList, regex, lineOfCode, lineNumber) {
    const match = lineOfCode.match(regex)?.groups;
    if (!match) {
        return;
    }
    targetList.push({
        ...match,
        lineOfCode: lineOfCode.trim(),
        lineNumber
    });
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
