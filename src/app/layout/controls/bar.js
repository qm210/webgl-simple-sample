import {initMouseState} from "../../mouse.js";
import {createDiv, createSmallButton} from "../dom.js";
import {sessionStoreControlState, updateVecLabel} from "./uniforms.js";
import {bundleUniforms, updateFromBundle} from "../../exchange.js";
import {createTimeSeeker} from "./time.js";


export function createMainControlBar(elements, state, controls) {
    const seeker = createTimeSeeker(elements.controlBar.time.seeker, state);
    elements.controlBar.time.frame.append(
        createDiv("Time", "value-label"),
        createDiv("", "half spacer"),
        elements.controlBar.time.seeker,
    );
    elements.controlBar.time.value.id = "iTime";
    elements.controlBar.time.update = seeker.callback.update;

    elements.controlBar.main.append(
        elements.controlBar.time.frame,
        createDiv("", "full-spacer"),
        ...createClipboardButtons(elements, state),
        createDiv("", "spacer"),
        createResetAllButton(elements, state, controls)
    );

    return {
        elements: elements.controlBar,
        seeker,
    };
}

function createResetAllButton(elements, state, controls) {
    const button = createSmallButton("Reset All", "right-align");
    button.addEventListener("click", event => {
        const allResetButtons = elements.uniformControls.querySelectorAll("button.reset");
        for (const button of allResetButtons) {
            button.click();
        }
        for (const control of controls.uniforms) {
            if (control.type === "cursorInput") {
                state[control.name] = control.defaultValue;
                const label = elements.uniforms[control.name].value;
                updateVecLabel(label, state, control);
                sessionStoreControlState(state, control);
            }
        }
        if (controls.onReset) {
            controls.onReset();
        }
        initMouseState(state, true);
        state.play.signal.reset = true;
        event.target.blur();
    });
    return button;
}

function createClipboardButtons(elements, state) {
    const copyButton = createSmallButton("→ Clipboard", "right-align");
    const pasteButton = createSmallButton("Paste", "right-align");

    copyButton.addEventListener("click", async () => {
        const originalContent = copyButton.textContent;
        try {
            const json = bundleUniforms(state);
            await navigator.clipboard.writeText(
                JSON.stringify(json, null, 4)
            );
            console.info("Copied to Clipboard", json);
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
            updateFromBundle(json, state, elements);
            pasteButton.textContent = "✔ pasted";
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

    return [copyButton, pasteButton];
}