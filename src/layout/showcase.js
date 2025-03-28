import REGEX from "../glslCode/regex.js";


const storageKey = "qm.showcase.key";

export function prepareShowcase(showcase, glContext) {

    const state = showcase.init(glContext);
    state.title = showcase.title;

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
        state.post?.source.fragment
    );

    return state;
}

function readUniforms(...sources) {
    const result = [];
    for (const source of sources) {
        if (!source) {
            continue;
        }
        for (const match of source.matchAll(REGEX.GLOBAL)) {
            if (match.groups?.keyword !== "uniform") {
                continue;
            }
            result.push(match.groups);
        }
    }
    return result;
}
