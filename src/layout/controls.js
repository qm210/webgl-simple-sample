
export function addButton(parent, {onClick, onRightClick, title = "", className = ""}) {
    const button = document.createElement("button");
    button.textContent = title;
    if (className) {
        button.className = className;
    }
    if (onClick) {
      button.addEventListener("click", onClick);
    }
    if (onRightClick) {
      button.addEventListener("contextmenu", onRightClick);
    }
    parent.appendChild(button);
    return button;
}

export const addValueLabel = (parent, {label, name}) => {
    const container = document.createElement("label");
    const span = document.createElement("span");
    span.id = name;
    container.innerHTML = `${label} `;
    container.appendChild(span);
    parent.appendChild(container);
    return span;
};
