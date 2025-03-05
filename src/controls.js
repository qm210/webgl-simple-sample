
export function addButton(parent, {onClick, onRightClick, title = "", className = ""}) {
    const b = document.createElement("button");
    b.textContent = title;
    b.className = className;
    if (onClick) {
      b.addEventListener("click", onClick);
    }
    if (onRightClick) {
      b.addEventListener("contextmenu", onRightClick);
    }
    parent.appendChild(b);
    return b;
}
