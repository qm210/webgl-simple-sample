import {assignGloballyUniqueClass, findParentOfClass} from "./helpers.js";


const storedLineId = sessionStorage.getItem("selected.line.id");

// TODO: think about whether this is actually good...
const initiallyScrollToLineId = false;

export function addStartupListeners() {


    document.addEventListener("DOMContentLoaded", () => {
        let interestingLine =
            document.querySelector(".line.error")
            ?? document.querySelector(".line.annotated");

        if (!interestingLine && storedLineId && initiallyScrollToLineId) {
            interestingLine = document.getElementById(storedLineId);
            selectContainingLine(interestingLine);
        }

        if (interestingLine) {
            interestingLine.scrollIntoView({
                behaviour: "smooth",
                block: "center"
            });
        }
    });

}

export function createScrollStackOn(parent) {
    const scrollStack = [];

    parent.addEventListener("contextmenu", (event) => {
        const stackElement = scrollStack.pop();
        if (!stackElement) {
            return;
        }

        event.preventDefault();
        stackElement.scrollIntoView({
            behaviour: "smooth",
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
        behaviour: "smooth",
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
