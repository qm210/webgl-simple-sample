

export function takeMilliSeconds(since = 0) {
    return +(performance.now() - since).toFixed(3);
}

export function mapObject(obj, func) {
    return Object.fromEntries(Object.entries(obj)
        .map(([key, value]) => [key, func(value)])
    );
}
