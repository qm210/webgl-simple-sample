/**
 * Helper function for aspectRatio
 * @param geometry {width, height, aspectRatio} - canvas dimensions, specify any two
 * @return {{width, height}} - the resolution in integer pixels.
 */
export function asResolution({width, height, aspectRatio}) {
    if (aspectRatio) {
        return {
            width: Math.round(height * aspectRatio),
            height: Math.round(height),
        };
    }
    return {
        width: Math.round(width || height * aspectRatio),
        height: Math.round(height ?? width / aspectRatio),
    };
}

export function resolutionScaled(newHeight, oldWidth, oldHeight) {
    const res = {
        width: Math.floor(newHeight * oldWidth / oldHeight),
        height: Math.floor(newHeight),
    };
    res.resolution = [res.width, res.height];
    res.texelSize = [1 / res.width, 1 / res.height];
    return res;
}

export function initialOrStoredResolution(canvas, geometry) {
    const canvasRect = canvas.getBoundingClientRect();
    geometry.height = loadStoredResolutionHeight()
        ?? geometry.height
        ?? canvasRect.height;
    if (!geometry.aspectRatio && !geometry.width) {
        geometry.width = canvasRect.width;
    }
    return asResolution(geometry);
}

function loadStoredResolutionHeight() {
    const resolution = JSON.parse(localStorage.getItem("qm.resolution") ?? "null");
    return resolution?.height ?? null;
}

export function storeResolution(width, height) {
    localStorage.setItem("qm.resolution", JSON.stringify({width, height}));
}

export function updateResolutionInState(state, glContext) {
    const width = glContext.drawingBufferWidth;
    const height = glContext.drawingBufferHeight;
    state.resolution = [width, height];
    state.texelSize = [1 / width, 1 / height];
    return {width, height};
}
