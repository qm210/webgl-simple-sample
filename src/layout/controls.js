import {createDiv} from "./helpers.js";

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
    container.textContent = `${label} `;
    container.appendChild(span);
    parent.appendChild(container);
    return span;
};

export const addCursorInput = (parent, state, control) => {
    const element = document.createElement("label");
    element.textContent = `${control.name}: Use WASDRF to move, Q to reset`;

    const storedState = JSON.parse(sessionStorage.getItem(control.name));
    if (storedState) {
        state[control.name] = storedState;
    }

    document.addEventListener("keydown", event => {
        if (!document.activeElement.matches("body")) {
            // something else focussed? then ignore key input here.
            return;
        }
        if (!state[control.name]) {
            state[control.name] = [0, 0, 0];
        }
        switch (event.key) {
            case "w":
                state[control.name][2] -= 1.;
                break;
            case "s":
                state[control.name][2] += 1.;
                break;
            case "a":
                state[control.name][0] -= 1.;
                break;
            case "d":
                state[control.name][0] += 1.;
                break;
            case "r":
                state[control.name][1] += 1.;
                break;
            case "f":
                state[control.name][1] -= 1.;
                break;
            case "q":
                state[control.name] = [0, 0, 0];
                break;
            default:
                return;
        }
        sessionStorage.setItem(
            control.name,
            JSON.stringify(state[control.name])
        );
    });

    parent.append(element);
}
