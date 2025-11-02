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
        console.warn(
            "Could not find expected uniform", control.name,
            "(is it declared?), control:", control, "state:", state
        );
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
    sessionStorage.setItem(
        control.storageKey,
        JSON.stringify(state[control.name])
    );
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

export const asFloatInput = (elements, state, control, onUpdate = undefined) => {
    control.defaultValue ??= 0;
    control.step ??= 0.01;
    const digits = -Math.log10(control.step);

    state[control.name] ??= control.defaultValue;

    elements.reset.textContent = `reset: ${control.defaultValue}`;
    elements.control.type = "range";
    elements.control.step = control.step;
    elements.control.style.flex = "3";

    update(true);

    elements.control.addEventListener("input", event => {
        state[control.name] = event.target.value;
        update();
    });

    elements.control.addEventListener("change", event => {
        state[control.name] = event.target.value;
        update(true);
        sessionStoreControlState(state, control);
    });

    elements.reset.addEventListener("click", () => {
        state[control.name] = control.defaultValue;
        update(true);
        sessionStorage.removeItem(control.storageKey);
    });

    return elements;

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
            elements.control.min = control.min ?? round(defaultMin);
            elements.control.max = control.max ?? round(defaultMax);
            elements.min.textContent = (+elements.control.min).toFixed(digits);
            elements.max.textContent = (+elements.control.max).toFixed(digits);
        }
        elements.control.value = value.toFixed(digits);
        elements.value.textContent = ` = ${value.toFixed(digits)}`;
        if (onUpdate) {
            onUpdate(elements.control.value);
        }
    }
};

export const asVec3Input = (elements, state, control) => {
    elements.control = document.createElement("div");
    elements.control.style.gap = "0.5rem";

    const componentControls = [];
    for (let i = 0; i < 3; i++) {
        const componentElements = createInputControlElements();
        asFloatInput(componentElements, state, control, updateAll);
        componentControls.push(componentElements.control);
        componentElements.control.value = control.defaultValue[i];
        elements.control.appendChild(componentElements.control);
        elements.min = componentElements.min;
        elements.max = componentElements.max;
    }

    elements.reset.addEventListener("click", () => {
        state[control.name] = control.defaultValue;
        componentControls.forEach((input, index) => {
            input.value = control.defaultValue[index];
        });
        updateAll();
    });

    updateAll();

    return elements;

    function updateAll() {
        state[control.name] = componentControls.map(i => +i.value);
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

    return elements;

    function update() {
        elements.value.textContent = `= vec3(${state[control.name]})`;
    }
}
