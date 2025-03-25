

const storageKey = "showcase.key";

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

    return state;
}
