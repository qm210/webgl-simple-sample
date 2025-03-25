import {assignGloballyUniqueClass, findParentOfClass} from "./helpers.js";


export function createScrollStackOn(parent) {
    const scrollStack = [];

    parent.addEventListener("contextmenu", (event) => {
        const stacked = scrollStack.pop();
        if (!stacked) {
            return;
        }

        event.preventDefault();
        stacked.element.scrollIntoView({
            behaviour: "smooth",
            block: "center"
        });
        assignGloballyUniqueClass(stacked.selectElement, "selected");
    });

    return scrollStack;
}

export function addShaderCodeEventListeners(parent, scrollStack) {
    const symbolElements =
        parent.getElementsByClassName("symbol");
    const lineElements =
        parent.getElementsByClassName("line");

    for (const element of symbolElements) {
        element.addEventListener("click", event => {
            const id = element.getAttribute("data");
            const target = document.getElementById(id);
            if (!target) {
                console.error("Target Element does not exist", id, element);
                return;
            }

            event.stopPropagation();
            const sourceLine = findParentOfClass(element, "line");
            const targetLine = findParentOfClass(target, "line");
            scrollStack.push({
                element,
                selectElement: sourceLine,
            });

            target.scrollIntoView({
                behaviour: "smooth",
                block: "start"
            });
            assignGloballyUniqueClass(targetLine, "selected");
        });
    }

    for (const element of lineElements) {
        element.addEventListener("click", () => {
            assignGloballyUniqueClass(element, "selected");
        });
    }
}
