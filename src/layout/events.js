import {assignGloballyUniqueClass, findParentOfClass} from "./helpers.js";


export function createScrollStackOn(parent) {
    const scrollStack = [];

    parent.addEventListener("contextmenu", (event) => {
        const stackElement = scrollStack.pop();
        if (!stackElement) {
            return;
        }

        event.preventDefault();
        stackElement.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
        selectContainingLine(stackElement);
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
            event.stopPropagation();
            const id = element.getAttribute("data");
            scrollToElementId(id, element, scrollStack);
        });
    }

    for (const element of lineElements) {
        element.addEventListener("click", () => {
            selectContainingLine(element);
        });
    }
}

export function scrollToElementId(id, sourceElement, scrollStack) {
    const target = document.getElementById(id);
    if (!target) {
        console.error("Target Element does not exist:", id, "Source Element:", sourceElement);
        return;
    }

    target.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
    selectContainingLine(target);

    if (sourceElement && scrollStack) {
        scrollStack.push(sourceElement);
    }
}

function selectContainingLine(element) {
    const lineParent = findParentOfClass(element, "line");
    assignGloballyUniqueClass(lineParent, "selected");

    if (lineParent?.id) {
        sessionStorage.setItem("selected.line.id", lineParent.id);
    }
}


export function scrollToFirstInterestingLine() {
    let interestingLine =
        document.querySelector(".line.error")
        ?? document.querySelector(".line.changed")
        ?? document.querySelector(".line.removed-before");

    if (interestingLine) {
        setTimeout(() => {
            interestingLine.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }, 200);
    }
}