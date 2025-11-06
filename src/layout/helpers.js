export function createElement(tag, content, classes) {
    const element = document.createElement(tag);
    if (classes) {
        element.classList.add(...classes.split(" "));
    }
    element.textContent = content?.toString() ?? "";
    return element;
}

export const createDiv = (...args) =>
    createElement("div", ...args);

export function appendElement(parent, content, tagName = "div", classes = "") {
    const element = createElement(tagName, content, classes);
    parent.appendChild(element);
    return element;
}

export function createSpan({text, id, classes, title, data}) {
    const span = document.createElement("span");
    span.textContent = text ?? "";
    for (const className of classes ?? []) {
        span.classList.add(className);
    }
    if (id) {
        span.id = id;
    }
    if (title) {
        span.title = title;
    }
    if (data) {
        span.setAttribute("data", data);
    }
    return span;
}

export function appendButton(parent, text, onClickHandler) {
    const button = document.createElement("button");
    button.textContent = text;
    button.addEventListener("click", onClickHandler);
    parent.appendChild(button);
}

export function assignGloballyUniqueClass(element, className) {
    if (!element) {
        return;
    }
    const selected = [...document.getElementsByClassName(className)];
    for (const previous of selected) {
        previous.classList.remove(className);
    }
    element.classList.add(className);
}

export function findParentOfClass(element, className) {
    // (yeah. name not exactly right, the element itself can also match.)
    let result = element;
    while (result && !result.classList.contains(className)) {
        result = result.parentElement;
    }
    return result;
}
