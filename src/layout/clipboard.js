import {createSmallButton} from "./controls.js";

const HEADER = {
    IDENTIFIER: "qm210.uniforms",
    VERSION: 1,
};

const uniformNameMap = {
    iTime: "time",
    iResolution: "resolution",
    iFrame: "frameIndex"
};

function bundleUniforms(state) {
    const result = {
        ...HEADER,
        uniforms: []
    };
    for (const uniform of state.expectedUniforms) {
        const value = state[uniform.name] ?? state[uniformNameMap[uniform.name]]
        result.uniforms.push({
            type: uniform.type,
            name: uniform.name,
            value
        });
    }
    return result;
}

function unpackBundle(state, json) {
    if (json.IDENTIFIER !== HEADER.IDENTIFIER) {
        throw Error(`This is JSON, but bad IDENTIFIER ${json.IDENTIFIER}`);
    } else if (json.VERSION !== 1) {
        throw Error(`This is JSON, but unknown VERSION ${json.VERSION}`);
    }
    const loaded = Object.fromEntries(
        json.uniforms.map(obj => [obj.name, obj])
    );
    for (const uniform of state.expectedUniforms) {
        if (uniform.type !== loaded[uniform.name].type) {
            console.warn("Uniform doesn't match type, ignore:", loaded[uniform.name]);
            continue;
        }
        const uniformKey = uniformNameMap[uniform.name] ?? uniform.name;
        state[uniformKey] = loaded[uniform.name].value;
    }
}

export function createClipboardButtons(elements, state, controls) {
    const copyButton = createSmallButton("→ Clipboard", "right-align");
    const pasteButton = createSmallButton("Paste", "right-align");

    copyButton.addEventListener("click", async () => {
        const originalContent = copyButton.textContent;
        try {
            const json = bundleUniforms(state);
            await navigator.clipboard.writeText(
                JSON.stringify(json, null, 4)
            );
            console.log("Copied to Clipboard", json);
            copyButton.textContent = "✔ copied";
        } catch (error) {
            console.error(error);
            copyButton.textContent = "✘ failed";
        }
        setTimeout(() => {
            copyButton.textContent = originalContent;
        }, 1000);
    });

    pasteButton.addEventListener("click", async () => {
        const originalContent = pasteButton.textContent;
        const originalState = {...state};
        try {
            const text = await navigator.clipboard.readText();
            const json = JSON.parse(text);
            unpackBundle(state, json);
            pasteButton.textContent = "✔ pasted";

            // const allInputs = elements.controls.querySelectorAll("input");
            for (const uniform of json.uniforms) {
                const input = elements.uniforms[uniform.name]?.control;
                if (!(input instanceof HTMLInputElement)) {
                    continue;
                }
                input.value = uniform.value;
            }

        } catch (error) {
            console.error(error);
            state = {...originalState};
            pasteButton.textContent = "✘ failed";
            pasteButton.style.color = "red";
            pasteButton.style.outlineColor = "red";
        }
        setTimeout(() => {
            pasteButton.textContent = originalContent;
            pasteButton.style.color = "";
            pasteButton.style.outlineColor = "";
        }, 1000);
    });

    return [copyButton, pasteButton];}
