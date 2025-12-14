export function clamp(x, min, max) {
    return Math.min(Math.max(x, min), max);
}

export function binarySearchInsert(event, queue, key) {
    let low = 0, high = queue.length;
    while (low < high) {
        const mid = (low + high) >> 1;
        if (queue[mid][key] < event[key]) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    queue.splice(low, 0, event);
}

export async function evaluateReadData(buffer, mapFunc = undefined) {
    const isUnsignedByte = buffer instanceof Uint8Array;
    const asFloat = buffer instanceof Float32Array
        ? buffer
        : Float32Array.from(buffer, mapFunc);
    const data = {
        pixels: buffer.length / 4,
        min: rgba(Infinity),
        max: rgba(-Infinity),
        avg: rgba(0),
        span: rgba(0),
        buffer: {
            raw: buffer,
            asFloat,
        },
    };
    for (let i = 0; i < buffer.length; i += 4) {
        for (let c = 0; c < 4; c++) {
            let value = asFloat[i + c];
            if (value < data.min[c]) {
                data.min[c] = value;
            }
            if (value > data.max[c]) {
                data.max[c] = value;
            }
            data.avg[c] += value;
        }
    }
    for (let c = 0; c < 4; c++) {
        data.avg[c] /= data.pixels;
        data.span[c] = data.max[c] - data.min[c];
    }
    data.formatted = {
        avg: toStr(data.avg),
        min: toStr(data.min),
        max: toStr(data.max),
    };
    return data;

    function rgba(value) {
        return [value, value, value, value];
    }

    function toStr(rgba) {
        const list = rgba.map(format).join(", ");
        return `[${list}]`;
    }

    function format(value) {
        if (isUnsignedByte) {
            if (value < 0.001) {
                return " <= 0";
            }
            if (value > 0.999) {
                return " >= 1"
            }
        }
        return value.toFixed(3);
    }
}
