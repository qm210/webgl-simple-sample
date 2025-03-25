export function createDiv(content, classes) {
    const div = document.createElement("div");
    if (classes) {
        div.classList.add(...classes.split(" "));
    }
    div.textContent = content.toString();
    return div;
}

export function appendText(parent, tagName, textContent) {
    const element = document.createElement(tagName);
    element.textContent = textContent;
    parent.appendChild(element);
}

export function renderSpan({text, id, className, title, data}) {
    const span = document.createElement("span");
    span.textContent = text ?? "";
    if (className) {
        span.className = className;
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
    return span.outerHTML;
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

