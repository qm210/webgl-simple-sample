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
