import {diffLines} from "diff";
import {createDiv} from "./helpers.js";

export function appendCodeBlock(parent, shaderSource, errorLog, storageKey) {
    if (!shaderSource) {
        return;
    }

    const element = document.createElement("div");

    const lines = prepareAnnotatedLines(shaderSource, errorLog, storageKey);

    const rendered = lines.map(renderAnnotatedLine).join("");

    element.classList.add("code-block");
    element.innerHTML = `
        <div class="source">
            ${rendered}
        </div>
    `;

    parent.appendChild(element);
}

function renderAnnotatedLine(line) {
    if (!line.code) {
        return `<div class="empty-line"></div>`;
    }

    const element = createDiv("", "line");

    const errors = line.error
        ?.inRow
        .map(error => error.message)
        .join('; ') ?? "";

    let annotation = "";

    if (line.changed) {
        element.classList.add("changed");
        element.title = "Line Changed"
        annotation = "changed";
    }
    if (line.removedBefore.length > 0) {
        element.classList.add("removed-before");
        element.title = "Was Removed: " + line.removedBefore.join("\n");
    }
    if (errors) {
        element.classList.add("error");
        element.title = errors;
        annotation = errors;
    }

    element.appendChild(
        createDiv(line.number, "line-number")
    );
    element.appendChild(
        createDiv(line.code, "code")
    );

    if (annotation) {
        element.appendChild(
            createDiv(annotation, "annotation")
        );
        element.classList.add("annotated");
    }

    return element.outerHTML;
}

function prepareAnnotatedLines(source, errorLog, storageKey) {
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

    for (const diff of differences) {
        if (diff.removed) {
            removedBefore.push(diff.value);
            continue;
        }

        let changed = diff.added && stored !== "";
        try {
            const onlyWhiteSpaceChanged = changed &&
                diff.value.trim() === storedLines[lineIndex].trim();
            if (onlyWhiteSpaceChanged) {
                changed = false;
                removedBefore = [];
            }
        } catch (err) {
            console.warn("WHAT??", diff.value, storedLines);
            console.warn(err);
        }

        lines.push({
            code: diff.value,
            changed,
            removedBefore,
            error: errors[lineIndex],
            number: lineIndex + 1,
        });
        removedBefore = [];
        lineIndex++;
    }

    return lines;
}

// this holds for WebGl2, as of March 2025 - e.g. error logs look like:
// ERROR: 0:12: '=' : dimension mismatch
// -> parse accordingly: /<ignore>: <number>:<number>: <rest>/
const ERROR_LINE = /:\s*([0-9]*):([0-9]*):\s*(.*)/g;

function parseErrors(errorLog) {
    if (!errorLog) {
        return {};
    }

    const errors = {};

    for (const line of errorLog.split('\n')) {
        const parsed = [...line.matchAll(ERROR_LINE)][0];
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
