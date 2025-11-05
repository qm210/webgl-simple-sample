import {createDiv, createElement} from "./helpers.js";

export function addButton({parent, onClick, onRightClick, title = "", className = ""}) {
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
    if (parent) {
        parent.appendChild(button);
    }
    return button;
}

export const addFreeRow = ({parent, label, id, content}) => {
    const name = createElement("label", label);
    const container = createDiv("", "free-row");
    container.id = id;
    const value = createDiv("", "value-label");
    if (content) {
        container.appendChild(content);
    }
    container.appendChild(value);
    parent.appendChild(name);
    parent.appendChild(container);
    return {container, name, value, content};
};

export function createInputElements(state, control) {

    const expected = state.expectedUniforms.find(
        uniform => uniform.name === control.name
    );
    if (!expected) {
        console.warn("Could not find expected uniform", control.name, "(is it declared?), ", control, state);
        return;
    }

    control.storageKey = `qm.${state.title}.${control.name}`;
    const storedState = sessionStorage.getItem(control.storageKey);
    if (storedState) {
        state[control.name] = JSON.parse(storedState);
    }
    if (state[control.name] === undefined) {
        state[control.name] = control.defaultValue;
        if (control.defaultValue === undefined) {
            console.warn("Uniform control has no defaultValue defined: ", control.name, control);
        } else if (control.defaultValue instanceof Array) {
            state[control.name] = [...control.defaultValue];
        }
    }

    if (control.hidden) {
        return;
    }

    const input = createInputControlElements(control);
    switch (control.type) {
        case "floatInput":
            return asFloatInput(input, state, control);
        case "vec3Input":
            return asVec3Input(input, state, control);
        case "cursorInput":
            return asCursorInput(input, state, control);
        default:
            console.warn("Control type has no elements definition (yet)", control);
            return undefined;
    }
}

function sessionStoreControlState(state, control) {
    if (state[control.name] === control.defaultValue) {
        sessionStorage.removeItem(control.storageKey);
    } else {
        sessionStorage.setItem(
            control.storageKey,
            JSON.stringify(state[control.name])
        );
    }
}

function createSmallButton(title) {
    const button = document.createElement("button");
    button.classList.add("small-button");
    button.textContent = title;
    return button;
}

const createInputControlElements = (control) => {
    const elements = {
        name: document.createElement("label"),
        value: createDiv("", "value-label"),
        control: document.createElement("input"),
        min: document.createElement("label"),
        max: document.createElement("label"),
        reset: createSmallButton("reset"),
    };
    if (control) {
        elements.name.textContent = control.name;
    }
    elements.min.style.fontSize = "small";
    elements.min.style.width = "0.1";
    elements.min.style.textAlign = "right";
    elements.max.style.fontSize = "small";
    elements.max.style.textAlign = "left";
    return elements;
};

export const asFloatInput = (elements, state, control) => {
    control.defaultValue ??= 0;

    elements.reset.textContent = `reset: ${control.defaultValue}`;
    asSlider(elements.control, control);

    updateSlider(elements, state, control, true);

    elements.control.addEventListener("input", event => {
        state[control.name] = event.target.value;
        updateSlider(elements, state, control, false);
    });
    elements.control.addEventListener("change", event => {
        state[control.name] = event.target.value;
        updateSlider(elements, state, control, true);
        sessionStoreControlState(state, control);
    });

    elements.reset.addEventListener("click", () => {
        state[control.name] = control.defaultValue;
        updateSlider(elements, state, control,true);
        sessionStoreControlState(state, control);
    });

    return elements;
};

function asSlider(inputElement, control) {
    control.step ??= 0.01;
    inputElement.type = "range";
    inputElement.step = control.step;
    if (control.min !== undefined) {
        inputElement.min = control.min;
    }
    if (control.max !== undefined) {
        inputElement.max = control.max;
    }
    inputElement.style.flex = "3";
}

function round(value, control) {
    return Math.round(parseFloat(value) / control.step) * control.step;
}

function updateSlider(elements, state, control, full = false, value = undefined) {
    value ??= state[control.name];
    value = round(value, control);
    const digits = -Math.log10(control.step);
    if (full) {
        const defaultMin =
            value === 0 ? -1
            : value > 0 ? 0
            : 2 * value;
        const defaultMax =
            value === 0 ? +1
            : value < 0 ? 0
            : 2 * value;
        elements.control.min = control.min ?? round(defaultMin);
        elements.control.max = control.max ?? round(defaultMax);
        elements.min.textContent = (+elements.control.min).toFixed(digits);
        elements.max.textContent = (+elements.control.max).toFixed(digits);
    }
    elements.control.value = value.toFixed(digits);
    elements.value.textContent = ` = ${value.toFixed(digits)}`;
    return elements.control.value;
}

export const asVec3Input = (elements, state, control) => {
    elements.control = document.createElement("div");
    elements.control.style.gap = "0.5rem";

    const sliders = [];
    for (let i = 0; i < 3; i++) {
        const componentInput = document.createElement("input");
        sliders.push(componentInput);
        elements.control.appendChild(componentInput);
        asSlider(componentInput, control);
        componentInput.value =
            updateSlider(elements, state, control, true, state[control.name][i]);
        componentInput.addEventListener("input", event => {
            updateSlider(elements, state, control, false, event.target.value);
            updateAll();
        });
        componentInput.addEventListener("change", event => {
            updateSlider(elements, state, control, true, event.target.value);
            updateAll();
            sessionStoreControlState(state, control);
        });
    }

    elements.reset.addEventListener("click", () => {
        state[control.name] = control.defaultValue;
        sliders.forEach((input, index) => {
            input.value = control.defaultValue[index];
        });
        updateAll();
        sessionStoreControlState(state, control);
    });

    updateAll();

    return elements;

    function updateAll() {
        state[control.name] = sliders.map(i => +i.value);
        const componentsText = state[control.name]
            .map(i => i.toFixed(2))
            .join(", ");
        elements.value.textContent = ` = vec3(${componentsText})`;
    }
};

const asCursorInput = (elements, state, control) => {
    // control.keys needs 7 keydown event names like ["W", "A", "S", "D", "R", "F", "Q"]
    const [front, left, back, right, up, down, reset] =
        control.keys.map(k => k.toUpperCase());
    const moveKeys = control.keys.slice(0, 6).join("").toUpperCase();
    elements.control = document.createElement("label");
    elements.control.innerHTML = ` -> use <kbd>${moveKeys}</kbd> to move, <kbd>${reset}</kbd> to reset.`;
    elements.reset.style.visibility = "collapse";

    control.step ??= 1;

    update();

    document.addEventListener("keydown", event => {
        if (!document.activeElement.matches("body")) {
            // something else focussed? then ignore key input here.
            return;
        }
        switch (event.key.toUpperCase()) {
            case front:
                state[control.name][2] -= control.step;
                break;
            case back:
                state[control.name][2] += control.step;
                break;
            case left:
                state[control.name][0] -= control.step;
                break;
            case right:
                state[control.name][0] += control.step;
                break;
            case up:
                state[control.name][1] += control.step;
                break;
            case down:
                state[control.name][1] -= control.step;
                break;
            case reset:
                state[control.name] = control.defaultValue;
                break;
            default:
                return;
        }
        update();
        sessionStoreControlState(state, control);
    });

    return elements;

    function update() {
        elements.value.textContent = `= vec3(${state[control.name]})`;
    }
}
