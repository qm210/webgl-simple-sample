import REGEX from "../glslCode/regexp.js";

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

export function addInput (parent, state, control) {
    if (control.hidden) {
        return;
    }

    control.storageKey = `qm.${state.title}.${control.name}`;
    const storedState = sessionStorage.getItem(control.storageKey);
    if (storedState) {
        state[control.name] = JSON.parse(storedState);
    }

    const expected = state.expectedUniforms
        .find(uniform => uniform.name === control.name);

    if (!expected) {
        return;
    }

    switch (control.type) {
        case "cursorInput":
            return addCursorInput(parent, state, control);
        case "floatInput":
            return addFloatInput(parent, state, control);
        default:
            console.warn("Unknown input control", control);
    }
}

function sessionStoreControlState(state, control) {
    sessionStorage.setItem(
        control.storageKey,
        JSON.stringify(state[control.name])
    );
}

const addCursorInput = (parent, state, control) => {
    // control.keys needs 7 key names like ["W", "A", "S", "D", "R", "F", "Q"]
    const [front, left, back, right, up, down, reset] =
        control.keys.map(k => k.toUpperCase());

    const element = document.createElement("label");
    const moveKeys = control.keys.slice(0, 6).join("").toUpperCase();

    update();

    document.addEventListener("keydown", event => {
        if (!document.activeElement.matches("body")) {
            // something else focussed? then ignore key input here.
            return;
        }
        if (!state[control.name]) {
            state[control.name] = [0, 0, 0];
        }
        switch (event.key.toUpperCase()) {
            case front:
                state[control.name][2] -= 1.;
                break;
            case back:
                state[control.name][2] += 1.;
                break;
            case left:
                state[control.name][0] -= 1.;
                break;
            case right:
                state[control.name][0] += 1.;
                break;
            case up:
                state[control.name][1] += 1.;
                break;
            case down:
                state[control.name][1] -= 1.;
                break;
            case reset:
                state[control.name] = [0, 0, 0];
                break;
            default:
                return;
        }
        update();
        sessionStoreControlState(state, control);
    });

    parent.append(element);
    return element;

    function update() {
        let content = `${control.name} = vec3(${state[control.name]})`
        content += ` -> use <kbd>${moveKeys}</kbd> to move, <kbd>${reset}</kbd> to reset.`;
        element.innerHTML = content;
    }
}

export const addFloatInput = (parent, state, control) => {
    control.defaultValue ??= 0;
    control.step ??= 0.01;
    const digits = -Math.log10(control.step);

    const container = document.createElement("div");
    parent.appendChild(container);

    const input = document.createElement("input");
    const valueLabel = document.createElement("label");
    const minLabel = document.createElement("label");
    const maxLabel = document.createElement("label");
    const resetButton = document.createElement("button");
    resetButton.classList.add("small-button");
    resetButton.textContent = `reset: ${control.defaultValue}`;
    container.appendChild(valueLabel);
    container.appendChild(minLabel);
    container.appendChild(input);
    container.appendChild(maxLabel);
    container.appendChild(resetButton);

    state[control.name] ??= control.defaultValue;

    container.style.gap = "1rem";
    input.type = "range";
    input.step = control.step;
    input.style.flex = "3";
    valueLabel.style.flex = "1";
    minLabel.style.width = "0.1";
    maxLabel.style.flex = "0.1";

    update(true);

    input.addEventListener("input", event => {
        state[control.name] = event.target.value;
        update();
    });

    input.addEventListener("change", event => {
        state[control.name] = event.target.value;
        update(true);
        sessionStoreControlState(state, control);
    });

    resetButton.addEventListener("click", () => {
        state[control.name] = control.defaultValue;
        update(true);
        sessionStorage.removeItem(control.storageKey);
    });

    return container;

    function round(value) {
        return Math.round(parseFloat(value) / control.step) * control.step;
    }

    function update(full = false) {
        const value = round(state[control.name]);
        if (full) {
            const defaultMin = value === 0
                ? -1
                : value < 0
                    ? 2 * value
                    : 0;
            const defaultMax = value === 0
                ? +1
                : value > 0
                    ? 2 * value
                    : 0;
            input.min = control.min ?? round(defaultMin);
            input.max = control.max ?? round(defaultMax);
            minLabel.textContent = (+input.min).toFixed(digits);
            maxLabel.textContent = (+input.max).toFixed(digits);
        }
        input.value = value.toFixed(digits);
        valueLabel.textContent = `${control.name} = ${value.toFixed(digits)}`;
    }

};
