import {createDiv, createElement} from "./helpers.js";
import {initMouseState} from "./mouse.js";

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

export const addFreeRow = ({parent, label, id, content, valuePrefix}) => {
    const name = createElement("label", label);
    const container = createDiv("", "free-row");
    container.id = id;
    const value = createDiv("", "value-label");
    if (valuePrefix) {
        container.appendChild(
            createDiv(valuePrefix, "value-label")
        );
    }
    container.appendChild(value);
    if (content instanceof Array) {
        content.forEach(c => container.appendChild(c));
    } else if (content) {
        container.appendChild(content);
    }
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
        case "int":
        case "intInput":
            control.integer = true;
            return asFloatInput(input, state, control);
        case "float":
        case "floatInput":
            return asFloatInput(input, state, control);
        case "vec2":
        case "vec2Input":
            return asVecInput(2, input, state, control);
        case "vec3":
        case "vec3Input":
            return asVecInput(3, input, state, control);
        case "vec4":
        case "vec4Input":
            return asVecInput(4, input, state, control);
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

function createSmallButton(title, ...extraClasses) {
    const button = document.createElement("button");
    button.classList.add("small-button", ...extraClasses);
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
        reset: createSmallButton("reset", "reset"),
    };
    if (control) {
        elements.value.id = control.name;
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
    control.defaultValue ??= control.log ? 1 : 0;

    elements.reset.textContent = `reset: ${control.defaultValue}`;
    asSlider(elements.control, control);

    updateSlider(elements, state, control, true);

    elements.control.addEventListener("input", event => {
        state[control.name] = valueFrom(event, control);
        updateSlider(elements, state, control, false);
    });
    elements.control.addEventListener("change", event => {
        state[control.name] = valueFrom(event, control);
        updateSlider(elements, state, control, true);
        sessionStoreControlState(state, control);
    });

    elements.reset.addEventListener("click", () => {
        state[control.name] = control.defaultValue;
        updateSlider(elements, state, control,true);
        sessionStoreControlState(state, control);
    });

    return elements;

    function valueFrom(event, control) {
        let value = parseFloat(event.target.value);
        if (control.log) {
            value = Math.pow(10, value);
        }
        if (control.integer) {
            value = Math.round(value);
        }
        return value;
    }
};

function asSlider(inputElement, control) {
    control.step ??=
        control.min > 0 && control.min < 0.01
            ? 0.001 : 0.01;
    if (control.log && control.min > 0 && control.max > control.min) {
        control.step = Math.min(control.min, 0.001);
        control.min = Math.log10(control.min);
        control.max = Math.log10(control.max);
    }
    if (control.min !== undefined) {
        inputElement.min = control.min;
    }
    if (control.max !== undefined) {
        inputElement.max = control.max;
    }
    inputElement.type = "range";
    inputElement.step = control.step;
    inputElement.style.flex = "1";
}

function updateSlider(elements, state, control, full = false, givenValue = undefined) {
    let value = round(givenValue ?? state[control.name]);
    if (control.log) {
        value = Math.log10(value);
    }
    const digits = control.integer ? 0 : -Math.log10(control.step);
    if (full) {
        const defaultMin =
            value === 0 ? -1
            : value > 0 ? 0
            : 2 * value;
        const defaultMax =
            value === 0 ? +1
            : value < 0 ? 0
            : 2 * value;
        elements.control.min = round(control.min ?? defaultMin);
        elements.control.max = round(control.max ?? defaultMax);
        elements.min.textContent = toDigits(elements.control.min);
        elements.max.textContent = toDigits(elements.control.max);
    }
    elements.control.value = value;
    value = toDigits(value);
    elements.value.textContent = ` = ${value}`;
    return value;

    function round(value) {
        return Math.round(value / control.step) * control.step;
    }

    function toDigits(value) {
        value = +value;
        if (control.log) {
            value = Math.pow(10, value);
        }
        return value.toFixed(digits);
    }
}

export const asVecInput = (dim, elements, state, control) => {
    elements.control = document.createElement("div");
    elements.control.style.gap = "0.5rem";

    let normFactor = 1;
    if (control.normalize) {
        control.min = control.log ? 1e-6 : -1;
        control.max = 1;
        normFactor = 1 / (squareNorm(state[control.name]) || 1);
    }

    const sliders = [];
    for (let i = 0; i < dim; i++) {
        const componentInput = document.createElement("input");
        sliders.push(componentInput);
        elements.control.appendChild(componentInput);
        asSlider(componentInput, control);
        state[control.name][i] *= normFactor;
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
        if (control.normalize) {
            const norm = Math.sqrt(
                sliders.reduce((sum, slider) =>
                        sum + (slider.value * slider.value),
                    0
                )
            );
            sliders.forEach(slider => {
                slider.value /= norm;
            });
        }
        state[control.name] = sliders.map(s => +s.value);
        updateVecLabel(elements.value, state, control);
    }
};

function squareNorm(vec) {
    return Math.sqrt(vec.reduce(
        (sum, comp) => sum + comp * comp,
        0
    ));
}

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
                shiftComponent(2, control.step);
                break;
            case back:
                shiftComponent(2, -control.step);
                break;
            case left:
                shiftComponent(0, -control.step);
                break;
            case right:
                shiftComponent(0, control.step);
                break;
            case up:
                shiftComponent(1, control.step);
                break;
            case down:
                shiftComponent(1, -control.step);
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
        updateVecLabel(elements.value, state, control)
    }

    function shiftComponent(index, shift) {
        state[control.name] = state[control.name].map((value, i) =>
            index !== i ? value :
                value + shift
        );
    }
}

function updateVecLabel(labelElement, state, control) {
    let value = state[control.name];
    if (value instanceof Array) {
        value = value
            .map(i => i.toFixed(2))
            .join(",");
    }
    labelElement.textContent = `= (${value})`;
}

export function createResetAllButton(elements, state, controls) {
    const button = createSmallButton("Reset All", "right-align");
    button.addEventListener("click", event => {
        const allResetButtons = elements.controls.querySelectorAll("button.reset");
        for (const button of allResetButtons) {
            button.click();
        }
        for (const control of controls.uniforms) {
            if (control.type === "cursorInput") {
                state[control.name] = control.defaultValue;
                const label = elements.uniformLabels[control.name];
                updateVecLabel(label, state, control);
                sessionStoreControlState(state, control);
            }
        }
        initMouseState(state);
        state.resetSignal = true;
        event.target.blur();
    });
    return button;
}
