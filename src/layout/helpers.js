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
