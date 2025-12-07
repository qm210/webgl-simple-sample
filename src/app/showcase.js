import {REGEX} from "../glslCode/definitions.js";


const storageKey = "qm.showcase.key";

export function prepareShowcase(showcase, glContext) {

    const state = showcase.init(glContext);
    state.title = showcase.title;
    state.showcaseId = showcase.path;

    if (showcase.title) {
        document.title = showcase.title;
    }

    const storedKey = sessionStorage.getItem(storageKey);
    if (storedKey !== state.title) {
        sessionStorage.clear();
    }
    sessionStorage.setItem(storageKey, state.title);

    state.expectedUniforms = readUniforms(
        state.source.fragment,
        state.source.vertex,
        state.post?.source.fragment,
        state.post?.source.vertex
    );

    return state;
}

export function reconfigureShowcase(state, showcase, glContext, updates) {
    // delete everything that exists (program etc.)
    // or at least, that is about to be updated
    if (updates.vertex) {
        // ...
    }
    if (updates.fragment) {
        // ...
    }
    console.log("reconfigure Showcase", state, updates);
    throw Error("Not Implemented");
    return prepareShowcase(showcase, glContext);
}

function readUniforms(...sources) {
    const result = [];
    for (const source of sources) {
        if (!source) {
            continue;
        }
        for (const match of source.matchAll(REGEX.SHADER_VARIABLE)) {
            if (match.groups?.keyword !== "uniform") {
                continue;
            }
            result.push(match.groups);
        }
    }
    return result;
}
