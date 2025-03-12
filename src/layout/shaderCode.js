export function renderWithErrors(shaderSource, errorLog) {

    const errors = parseErrors(errorLog);

    const lines = shaderSource
        .split('\n')
        .map((line, row) =>
            renderLineWithError(line, errors[row])
        )
        .join('\n');

    return `
        <div class="source">
            ${lines}
        </div>
    `;
}

function renderLineWithError(line, errors) {
    if (!errors) {
        return renderAsIs(line);
    }
    const allErrors = errors.lines.join('; ');
    return `
        <div style="position: relative">
            <pre class="error line" title="${allErrors}">${line}</pre>
            <div class="annotation">${errors.lineNumber}</div>
        </div>
    `;
}

export function renderAsIs(shaderSource) {
    // render empty lines a bit smaller to allow for more content
    if (!shaderSource) {
        return "<div style='height: 0.7em'></div>";
    }
    return `<pre>${shaderSource}</pre>`;
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
