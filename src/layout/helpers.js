export function createDiv(content, classes) {
    const div = document.createElement("div");
    if (classes) {
        div.classList.add(...classes.split(" "));
    }
    div.textContent = content?.toString() ?? "";
    return div;
}

export function appendText(parent, tagName, textContent) {
    const element = document.createElement(tagName);
    element.textContent = textContent;
    parent.appendChild(element);
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
