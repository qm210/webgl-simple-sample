import {REGEX, SymbolType} from "./symbols.js";

export function countBlockDelimiters(code) {
    const delta = {
        braces: 0,
        comments: 0,
    }
    let match;
    while ((match = REGEX.BLOCK_DELIMITER.exec(code)) !== null) {
        delta.braces += !!match.groups.braceOpen - !!match.groups.braceClose;
        delta.comments += !!match.groups.commentOpen - !!match.groups.commentClose;
    }
    return {
        delta,
        justOpeningComment: code.startsWith("/*")
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

        const parsedBraces = line.code.trimmed
            .split('{')
            .map((part, index) =>
                ({
                    part,
                    index,
                    closing: part
                        .split('}')
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

export function enhancedFunctionsWithBody(analyzed) {
    const functions = analyzed.symbols.filter(
        s => s.symbolType === SymbolType.CustomFunction
    );

    let nextIndex = 0;
    for (let i = 0; i < analyzed.lines.length; i++) {

        const nextFunction = functions[nextIndex];
        if (!nextFunction) {
            break;
        }

        const line = analyzed.lines[i];
        const nextLinePosition = analyzed.lines[i + 1]?.positionInSource;
        const startsHere = nextLinePosition > nextFunction.sourcePosition;
        if (startsHere) {
            nextFunction.startsAtLine = line.number;
            nextFunction.endsAtLine = line.number + nextFunction.matched.lines.length - 1;

            // needs the scopes to be sorted!
            nextFunction.scope = analyzed.scopes
                .find(scope => scope.openedIn >= nextFunction.endsAtLine);

            if (line.belongsTo.unusedCode || line.scopeLevelAtStart > 0) {
                nextFunction.dismiss = true;
            }

            nextIndex++;
        }
    }

    return functions.filter(f => !f.dismiss);
}