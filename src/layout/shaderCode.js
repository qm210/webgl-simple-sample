import {diffLines} from "diff";

export function displayCode(element, shaderSource, errorLog, storageKey) {

    const lines = enrichedParse(shaderSource, storageKey, errorLog);

    const rendered = lines.map(renderEnrichedLine).join("");

    element.classList.add("code");
    element.innerHTML = `
        <div class="source">
            ${rendered}
        </div>
    `;
}

function renderEnrichedLine(line) {
    if (!line.code) {
        return `<div class="emptyline"></div>`;
    }

    let classes = "line";
    let title = "";
    let annotation = "";

    if (line.added) {
        classes += " changed";
        annotation = "changed";
    }
    if (line.removedBefore.length > 0) {
        classes += " removed-before";
        title = "Removed: " + line.removedBefore.join("\n");
    }
    if (line.error) {
        classes += " error";
        title = line.error.lines.join('; ') ?? "";
        annotation = line.error.lineNumber;
    }

    let attributes = "";
    if (title) {
        attributes += `title="${title}"`;
    }

    const elements = [
        `<div class="${classes}" ${attributes}>${line.code}</div>`
    ];
    if (annotation) {
        elements.push(
            `<div class="annotation">${annotation}</div>`
        );
    }

    return `
        <div style="position: relative">
            ${elements.join("")}
        </div>
    `;
}

function enrichedParse(source, storageKey, errorLog) {
    const stored = sessionStorage.getItem(storageKey) ?? "";
    if (storageKey) {
        sessionStorage.setItem(storageKey, source);
    }

    const errors = parseErrors(errorLog);

    const differences = diffLines(stored, source, {
        oneChangePerToken: true
    });

    const result = [];
    let removedBefore = [];
    for (const diff of differences) {
        if (!diff.removed) {
            result.push({
                code: diff.value,
                added: stored === "" ? false : diff.added,
                removedBefore,
                error: errors[result.length],
            });
            removedBefore = [];
        } else {
            removedBefore.push(diff.value);
        }
    }

    return result;
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
