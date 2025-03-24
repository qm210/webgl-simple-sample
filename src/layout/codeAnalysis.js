import {diffLines} from "diff";

const REGEX = {
    DEFINE:
        /^\s*#define\s*(?<name>\w*)\s*(?<value>.*)\s*$/,
    GLOBAL:
        /^\s*(?<keyword>out|uniform|varying)\s*(?<type>\w*)\s*(?<name>\w*);/,
    CONSTANT:
        /^\s*const\s*(?<type>\w*)\s*(?<name>\w*)\s*=\s*(?<value>\S*);/,
    ERROR_LOG:
        /:\s*([0-9]*):([0-9]*):\s*(.*)/g,
    // <--this holds for WebGl2, as of March 2025 - e.g. error logs look like:
    // ERROR: 0:12: '=' : dimension mismatch
    // -> parse accordingly: /<ignore>: <number>:<number>: <rest>/
};

export function analyzeLines(source, errorLog, storageKey) {
    const stored = sessionStorage.getItem(storageKey) ?? "";
    if (storageKey) {
        sessionStorage.setItem(storageKey, source);
    }

    const errors = parseErrors(errorLog);
    const storedLines = stored.split("\n");
    const differences = diffLines(stored, source, {
        oneChangePerToken: true
    });

    const lines = [];
    let lineIndex = 0;
    let removedBefore = [];
    let consecutiveBlanks = 0;
    const defined = {
        defines: [],
        globals: [],
        constants: [],
    }

    for (const diff of differences) {
        if (diff.removed) {
            removedBefore.push(diff.value);
            continue;
        }

        const actualCode = diff.value.trim();
        let changed = diff.added && stored !== "";
        try {
            const onlyWhiteSpaceChanged = changed &&
                actualCode === storedLines[lineIndex].trim();
            if (onlyWhiteSpaceChanged) {
                changed = false;
                removedBefore = [];
            }
        } catch (err) {
            console.warn("Error Comparing", err, `"${diff.value}"`, storedLines);
        }

        if (!actualCode) {
            consecutiveBlanks++;
        } else {
            consecutiveBlanks = 0;
        }

        extendDefinitionIfMatch(
            defined.defines,
            REGEX.DEFINE,
            actualCode,
            lineIndex
        );
        extendDefinitionIfMatch(
            defined.globals,
            REGEX.GLOBAL,
            actualCode,
            lineIndex
        );
        extendDefinitionIfMatch(
            defined.constants,
            REGEX.CONSTANT,
            actualCode,
            lineIndex
        );

        lines.push({
            code: diff.value,
            changed,
            removedBefore,
            error: errors[lineIndex],
            number: lineIndex + 1,
            consecutiveBlanks,
            defined: structuredClone(defined),
        });
        removedBefore = [];
        lineIndex++;
    }

    return lines.filter(l => l.consecutiveBlanks < 2);
}

function extendDefinitionIfMatch(targetList, regex, lineOfCode, lineIndex) {
    const match = lineOfCode.match(regex)?.groups;
    if (match) {
        targetList.push({...match, lineNumber: lineIndex + 1});
    }
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
