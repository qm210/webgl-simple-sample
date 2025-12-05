import {clamp} from "../../math.js";

export function createTimeSeeker(parent, state) {
    parent.innerHTML =
        `<svg xmlns="http://www.w3.org/2000/svg"
              width="100%"
              height="100%"
              ></svg>`;
    const svg = parent.firstElementChild;
    const el = {
        virgin: true,
        parent,
        svg,
        track: svgChild(svg, "rect", {
            id: "seek-track",
            fill: "#590059"
        }),
        markers: {
            loop: svgChild(svg, "rect", {

            })
        },
        ticks: {
            intervalSec: 4,
            pattern: svgChild(svg, "pattern", {
                id: "track-ticks",
                height: "100%",
                patternUnits: "userSpaceOnUse"
            }),
            markers: svgChild(svg, "rect", {
                id: "seek-markers",
                fill: "url(#track-ticks)",
            }),
        },
        handle: svgChild(svg, "rect", {
            id: "seek-handle",
        }),
        value: svgChild(svg, "text", {
            class: "clickable",
            "text-anchor": "end",
            textContent: "løl.",
            // <-- set some number-measure-style text to measure it later... ~\´()_o`/~
            title: "Click to enter value, Right Click to enter max value."
        }),
        icons: {
            toggle: svgChild(svg, "text", {
                class: "clickable",
                "text-anchor": "middle",
                title: "Toggle Play/Stop"
            }),
            loop: svgChild(svg, "text", {
                class: "clickable",
                "text-anchor": "middle",
                textContent: "\u21ba", // \u21A9",
                title: "Loop? (Right Click this for Range Input)"
            }),
        },
        rect: {
            bounds: null,
            track: null,
            markers: null,
            handle: null,
            value: null,
        },
        handleBar: {
            min: 0,
            max: 0,
            span: null,
        },
        callback: {
            update: undefined,
            resize: undefined,
        },
        do: {
            jump: undefined,
            toggle: undefined,
        },
        remember: {
            timestamp: undefined,
            toUpdate: false,
        }
    };

    el.callback.resize = () => {
        const r = el.rect;
        r.bounds = parent.getBoundingClientRect();
        const unit = {
            step: r.bounds.width / 36,
            text: el.value.getBBox().height,
            tick: 3,
            padding: 4
        };
        r.track = {
            width: 30 * unit.step,
            x: 0,
            height: r.bounds.height - 2 * unit.padding,
            y: unit.padding,
            rx: unit.padding / 2,
        };
        r.handle = {
            width: unit.step,
            x: unit.padding / 2,
            height: r.bounds.height - unit.padding,
            y: unit.padding / 2
        };
        el.handleBar.span = r.track.width - r.handle.width;
        el.handleBar.min = r.track.x + r.handle.x;
        el.handleBar.max = el.handleBar.min + el.handleBar.span;
        r.markers = {
            x: 0,
            width: r.track.width,
            y: r.track.y / 2,
            height: r.bounds.height - r.track.y,
        };
        r.value = {
            width: unit.step,
            x: r.track.x + r.track.width + 2.5 * unit.step,
            height: r.bounds.height,
            y: unit.text - r.track.y / 2,
        };
        withRect(el.track, r.track);
        withRect(el.ticks.markers, r.markers);
        withRect(el.handle, r.handle);
        withRect(el.value, r.value);
        let x = r.value.x + r.value.width;
        for (const icon of Object.values(el.icons)) {
            r.icon = {...r.value, x, width: unit.step};
            withRect(icon, r.icon);
            x += r.icon.width;
        }
        if (el.virgin) {
            el.ticks.pattern.append(
                svgChild(svg, "rect", {
                    x: r.handle.width / 2 + el.handleBar.min / 2,
                    width: unit.tick,
                    height: r.bounds.height,
                    fill: "#ffffff77",
                })
            );
            el.ticks.pattern.setAttribute("width", intervalPixels(el, state));
            delete el.virgin;
        }
        if (el.remember.toUpdate) {
            el.remember.toUpdate = false;
            el.callback.update();
        }
    };

    el.callback.update = () => {
        if (el.virgin) {
            // if called too early, we need to wait for the first resize, and THEN return.
            el.remember.toUpdate = true;
            return;
        }
        applyStateDependantStyling(el, state);
        if (!state.play.running) {
            if (el.remember.timestamp === state.play.previous.timestamp) {
                return;
            } else {
                el.remember.timestamp = state.play.previous.timestamp ?? undefined;
            }
        }
        el.value.textContent = state.time.toFixed(2);
        mightAutoExtendRange();
        moveHandle(el, state);
    };

    el.do.jump = ({to = undefined, delta = undefined, min = undefined, max = undefined}) => {
        state.play.previous.time = state.time;
        state.play.previous.timestamp = null;
        state.time = (to ?? state.time) + (delta ?? 0);
        if (state.time < min) {
            state.time = min;
        }
        if (state.time > max) {
            state.time = max;
        }
        mightAutoExtendRange();
    };

    el.do.toggle = (force = undefined) => {
        if (state.play.running || force === false) {
            state.play.running = false;
        } else {
            state.play.running = true;
            state.play.previous.timestamp = null;
        }
    };

    el.do.toggleLoop = ({start, end, active} = {}) => {
        if (start !== undefined) {
            state.play.loop.start = start;
        }
        if (end !== undefined) {
            state.play.loop.end = end;
        }
        state.play.loop.active =
            active ?? !state.play.loop.active;
    }

    addDocumentListeners(el, state);
    addMouseInteraction(el, state);

    return el;

    function mightAutoExtendRange() {
        if (state.play.loop.active) {
            return;
        }
        const extendAbove = state.play.range.max - state.play.range.autoExtendMargin;
        const extend = state.time - extendAbove;
        if (extend <= 0) {
            return;
        }
        adjustMaxRange(el, state, {delta: extend});
    }
}

function intervalPixels(el, state) {
    return secondsAsPixels(el.ticks.intervalSec, el, state);
}

function secondsAsPixels(seconds, el, state, offset = 0) {
    // String is a no-cost inlined version to make linters happy while passing a number
    // i.e. .toString() would actually calculate something needlessly, thus be not-good.
    // console.log("SAP", el.handleBar.span, seconds, state.play.range.max, offset, "=", String(el.handleBar.span * seconds / state.play.range.max + offset));
    return String(el.handleBar.span * seconds / state.play.range.max + offset);
}

function pixelsAsSeconds(handlePosition, el, state) {
    return (handlePosition - el.handleBar.min) * (state.play.range.max / el.handleBar.span);
}

function moveHandle(el, state) {
    const handleX = secondsAsPixels(state.time, el, state, el.handleBar.min);
    el.handle.setAttribute("x", handleX);
}

function adjustMaxRange(el, state, {delta, max, omitUpdate}) {
    max ??= state.play.range.max;
    delta ??= 0;
    state.play.range.max = max + delta;
    el.ticks.pattern.setAttribute("width", intervalPixels(el, state));
    if (omitUpdate) {
        return;
    }
    moveHandle(el, state);
}

function svgChild(svg, tag, attributes = {}) {
    const child = document.createElementNS(svg.namespaceURI, tag);
    for (const [name, value] of Object.entries(attributes)) {
        if (name === "textContent") {
            child.textContent = String(value);
        } else if (name === "title") {
            const grandchild =
                svgChild(svg, "title", {textContent: value});
            child.appendChild(grandchild);
        } else {
            child.setAttribute(name, String(value));
        }
    }
    svg.appendChild(child);
    return child;
}

function applyStateDependantStyling(el, state) {
    if (state.play.running) {
        el.handle.setAttribute("stroke", "black");
        el.icons.toggle.textContent = "\u23f9";
        el.icons.toggle.setAttribute("color", "red");
    } else {
        el.handle.setAttribute("stroke", "darkorange");
        el.icons.toggle.textContent = "\u25b6";
        el.icons.toggle.setAttribute("color", "black");
    }

    if (state.play.loop.active) {
        el.icons.loop.setAttribute("stroke", "darkgreen");
    } else {
        el.icons.loop.setAttribute("stroke", "gray");
    }


}

function withRect(element, rect) {
    element.setAttribute("x", rect.x ?? 0);
    element.setAttribute("y", rect.y ?? 0);
    element.setAttribute("width", rect.width ?? 1);
    element.setAttribute("height", rect.height ?? 1);
    element.setAttribute("rx", rect.rx ?? 0);
    return element;
}

function withRelativeRect(element, source, factors = {}) {
    const bounds = source.getBBox();
    const rect = {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rx: source.getAttribute("rx") || 0
    };
    for (const [attribute, value] of Object.entries(factors)) {
        rect[attribute] *= value;
    }
    return withRect(element, rect);
}

function addDocumentListeners(el, state) {
    const resizer = new ResizeObserver(() =>
        el.callback.resize()
    );
    resizer.observe(el.parent);

    const storageKey = "qm.state.play";
    window.addEventListener("beforeunload", () => {
        sessionStorage.setItem(storageKey, JSON.stringify({
            time: state.time,
            frame: state.iFrame,
            play: state.play
        }));
        resizer.disconnect();
    });

    const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    if (stored && stored.play) {
        state.play.running = stored.play.running;
        if (stored.range) {
            state.play.range = stored.range
        }
        if (stored.loop) {
            state.play.loop = stored.loop;
        }
        if (stored.markers) {
            state.play.markers = stored.markers;
        }
        state.time = stored.time ?? 0;
        state.iFrame = stored.frame ?? -1;
    }
}

function addMouseInteraction(el, state) {
    const drag = {
        ghost: null,
        offset: 0,
        initial: 0,
        original: {},
        throttleFrame: null,
        ctm: null,
    };

    el.handle.addEventListener("mouseover", () => {
        el.handle.setAttribute("fill", el.handle.getAttribute("stroke"));
    });
    el.handle.addEventListener("mouseout", () => {
        el.handle.setAttribute("fill", "none");
    });

    el.svg.addEventListener("mousedown", event => {
        const pos = mousePosition(event);
        if (event.target === el.handle) {
            drag.original = parseFloatAttributes(el.handle, "x", "opacity");
            drag.original.rangeMax = state.play.range.max;
            drag.original.wasRunning = state.play.running;
            el.do.toggle(false);

            drag.initial = pos.x;
            drag.offset = pos.x - drag.original.x;
            drag.ghost = el.handle.cloneNode(true);
            el.svg.appendChild(drag.ghost);
            drag.ghost.id = "ghost-handle";
            drag.ghost.setAttribute("opacity", 1);
            drag.ghost.setAttribute("fill", "currentColor");
            el.handle.setAttribute("opacity", 0.4);
        }
    }, {
        passive: false
    });

    document.addEventListener("mousemove", event => {
        if (!drag.ghost) {
            return;
        }
        event.preventDefault();
        cancelAnimationFrame(drag.throttleFrame);
        const mouseX = mousePosition(event).x;
        drag.throttleFrame = requestAnimationFrame(() => {
            const x = clamp(mouseX - drag.offset, el.handleBar.min, el.handleBar.max);
            seekPixel(x);
            drag.ghost.setAttribute("x", x);
            drag.throttleFrame = null;
        });
    }, {
        passive: false
    });

    document.addEventListener("mouseup", event => {
        if (!drag.ghost) {
            return;
        }
        cancelAnimationFrame(drag.throttleFrame);
        const elementBelow = document.elementFromPoint(event.clientX, event.clientY);
        const dropOnGhost = elementBelow === drag.ghost;
        const dropX = parseFloat(drag.ghost.getAttribute("x"));
        if (dropOnGhost) {
            seekPixel(dropX - drag.initial);
        } else {
            adjustMaxRange(el, state, {
                max: drag.original.rangeMax
            });
        }
        el.svg.removeChild(drag.ghost);
        drag.ghost = null;
        el.handle.setAttribute("opacity", drag.original.opacity);
        el.do.toggle(drag.original.wasRunning);
    });

    el.handle.addEventListener("dblclick", () => {
        console.log("was?", state.play.running);
        el.do.toggle();
        console.log("iiiis?", state.play.running);
    });

    el.value.addEventListener("click", () => {
        promptForSecondToJump(el, state);
    });

    el.value.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const second =
            promptFloat(el, state.play.range.max, "Enter new MAX Second:");
        if (second) {
            state.play.range.max = second;
        }
    });

    el.icons.loop.addEventListener("click", () => {
        el.do.toggleLoop();
    });

    el.icons.loop.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        console.log(state.play.loop);
        const seconds = promptFloatArray(
            el,
            [state.play.loop.start, state.play.loop.end],
            "Enter new Loop START and END Second (Space-Separated, any NaN for max. interval):",
        );
        if (seconds.length !== 2) {
            alert(`Discard Input: ${seconds} because it has not 2 elements.`);
            return;
        }
        [state.play.loop.start = state.play.loop.end] = seconds;
        state.play.loop.active = true;
    });

    function seekPixel(pixelWidth) {
        const second = pixelsAsSeconds(pixelWidth, el, state);
        el.do.jump({
            to: second,
            min: 0,
            max: state.play.range.max
        });
    }

    function mousePosition(event) {
        if (!drag.ctm) {
            drag.ctm = el.svg.getScreenCTM();
        }
        return {
            x: (event.clientX - drag.ctm.e) / drag.ctm.a,
            y: (event.clientY - drag.ctm.f) / drag.ctm.d
        };
    }
}

function parseFloatAttributes(element, ...attributes) {
    const result = {}
    for (const attribute of attributes) {
        const value = parseFloat(element.getAttribute(attribute));
        if (!Number.isNaN(value)) {
            result[attribute] = value;
        }
    }
    return result;
}

function parseFloatLeniently(input) {
    const result = parseFloat(input.replace(",", "."));
    return Number.isNaN(result) ? null : result;
}

export function promptFloat(el, defaultValue, message) {
    const input = window.prompt(
        message ?? "Enter new Value:",
        (defaultValue ?? "").toString()
    );
    return parseFloatLeniently(input);
}

export function promptForSecondToJump(el, state) {
    const time = promptFloat(el, state.time, "Jump to Second:");
    el.do.jump({to: time});
}

export function promptFloatArray(el, defaultValues, message, separator = " ") {
    const input = window.prompt(
        message ?? `Enter new values. separated with \"${separator}\":`,
        defaultValues.join(separator)
    );
    return input
        .split(separator)
        .filter(s => s.length > 0)
        .map(parseFloatLeniently);
}
