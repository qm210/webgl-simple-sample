export function takeMilliSeconds(since = 0) {
    return +(performance.now() - since).toFixed(3);
}