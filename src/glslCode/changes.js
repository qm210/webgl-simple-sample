import {REGEX} from "./definitions.js";

const ChangeType = {
    Added: "Added",
    Changed: "Changed",
    Removed: "Removed",
};

export function handleConsecutiveChanges(analyzed, cursor, diff) {
    const type = (
        diff.removed ? ChangeType.Removed :
        diff.added ? ChangeType.Added :
        null
    );
    const consecutive = cursor.consecutiveChanged;
    if (type !== null && consecutive.type !== null) {
        if (consecutive.type !== type) {
            consecutive.type = ChangeType.Changed;
        }
        consecutive.endIndex = cursor.index;
        consecutive.diffs.push(diff);
    } else {
        if (consecutive.type !== null) {
            const lineNumber = consecutive.startIndex + 1;
            analyzed.changedBlockAt[lineNumber] = consecutive;
        }
        cursor.consecutiveChanged = {
            type,
            startIndex: cursor.index,
            endIndex: cursor.index,
            diffs: type === null ? [] : [diff]
        };
    }
}

export function enhanceChangedBlocks(analyzed) {
    for (const line of analyzed.lines) {
        if (analyzed.changedBlockAt[line.number]) {
            line.changedBlock = analyzed.changedBlockAt[line.number]
            line.changedBlock.removed = line.changedBlock.diffs
                .filter(d => d.removed);
            line.changedBlock.indent = commonIndentation(line.changedBlock.removed);
        }
    }
}

export function commonIndentation(diffs) {
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

