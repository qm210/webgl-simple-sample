import REGEX from "../glslCode/regex.js";
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

export const addValueRow = (parent, {label, name}) => {
    const container = createDiv(`${label} `, "value-row");
    const span = document.createElement("span");
    span.id = name;
    container.appendChild(span);
    parent.appendChild(container);
    return span;
};

export function createInputElements(state, control) {
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
        console.warn("Could not find expected uniform", control, state);
        return;
    }

    switch (control.type) {
        case "cursorInput":
            return createCursorInput(state, control);
        case "floatInput":
            return createFloatInput(state, control);
        case "vec3Input":
            return createVec3Input(state, control);
        default:
            return undefined;
    }
}

function sessionStoreControlState(state, control) {
    sessionStorage.setItem(
        control.storageKey,
        JSON.stringify(state[control.name])
    );
}

const createCursorInput = (state, control) => {
    // control.keys needs 7 key names like ["W", "A", "S", "D", "R", "F", "Q"]
    const [front, left, back, right, up, down, reset] =
        control.keys.map(k => k.toUpperCase());

    const container = document.createElement("label");
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

    return {container};

    function update() {
        let content = `${control.name} = vec3(${state[control.name]})`
        content += ` -> use <kbd>${moveKeys}</kbd> to move, <kbd>${reset}</kbd> to reset.`;
        container.innerHTML = content;
    }
}

function createSmallButton(title) {
    const button = document.createElement("button");
    button.classList.add("small-button");
    button.textContent = title;
    return button;
}

export const createFloatInput = (state, control, onUpdate = undefined) => {
    control.defaultValue ??= 0;
    control.step ??= 0.01;
    const digits = -Math.log10(control.step);

    const container = document.createElement("div");
    const input = document.createElement("input");
    const nameLabel = document.createElement("label");
    const valueLabel = createDiv("", "value-label");
    const minLabel = document.createElement("label");
    const maxLabel = document.createElement("label");
    const resetButton = createSmallButton(`reset: ${control.defaultValue}`);

    state[control.name] ??= control.defaultValue;

    container.style.gap = "1rem";
    input.type = "range";
    input.step = control.step;
    input.style.flex = "3";
    minLabel.style.fontSize = "small";
    minLabel.style.width = "0.1";
    maxLabel.style.fontSize = "small";

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

    return {container, nameLabel, valueLabel, minLabel, input, maxLabel, resetButton};

    function round(value) {
        return Math.round(parseFloat(value) / control.step) * control.step;
    }

    function update(full = false) {
        const value = round(state[control.name]);
        if (full) {
            const defaultMin =
                value === 0
                    ? -1
                    : value < 0
                        ? 2 * value
                        : 0;
            const defaultMax =
                value === 0
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
        nameLabel.textContent = control.name;
        valueLabel.textContent = ` = ${value.toFixed(digits)}`;
        if (onUpdate) {
            onUpdate(input.value);
        }
    }
};

export const createVec3Input = (state, control) => {
    const container = document.createElement("div");
    container.style.gap = "0.5rem";
    const nameLabel = document.createElement("label");
    const valueLabel = createDiv("", "value-label");
    let minLabel, maxLabel;
    const resetButton = createSmallButton("reset");

    const componentInputs = [];
    for (let i = 0; i < 3; i++) {
        const inputs = createFloatInput(state, control, updateAll);
        componentInputs.push(inputs.input);
        inputs.input.value = control.defaultValue[i];
        container.appendChild(inputs.input);

        minLabel = inputs.minLabel;
        maxLabel = inputs.maxLabel;
    }

    resetButton.addEventListener("click", () => {
        state[control.name] = control.defaultValue;
        componentInputs.forEach((input, index) => {
            input.value = control.defaultValue[index];
        });
        updateAll();
    });

    updateAll();
    return {container, nameLabel, valueLabel, resetButton, minLabel, maxLabel};

    function updateAll() {
        state[control.name] = componentInputs.map(i => +i.value);
        const componentsText = state[control.name]
            .map(i => i.toFixed(2))
            .join(", ");
        nameLabel.textContent = control.name;
        valueLabel.textContent = ` = vec3(${componentsText})`;
    }
};
