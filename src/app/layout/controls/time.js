
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
        track: svgChild(svg, "rect", "seek-track", {
            fill: "darkmagenta"
        }),
        ticks: {
            intervalSec: 10,
            pattern: svgChild(svg, "pattern", "track-ticks", {
                width: 100,
                height: 24,
                patternUnits: "userSpaceOnUse"
            }),
            markers: svgChild(svg, "rect", "seek-markers", {
                fill: "url(#track-ticks)",
            }),
        },
        handle: svgChild(svg, "rect", "seek-handle", {
            fill: "none",
        }),
        value: svgChild(svg, "text", "time-value", {
            "text-anchor": "end",
        }),
        rect: {
            bounds: null,
            track: null,
            markers: null,
            handle: null,
            value: null,
        },
        handleRange: {
            min: 0,
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
    el.value.textContent = "løl.";
    // <-- set some number-measure-style text to measure it later... ()_o

    el.callback.resize = () => {
        const r = el.rect;
        r.bounds = parent.getBoundingClientRect();
        const unit = {
            step: r.bounds.width / 36,
            text: el.value.getBBox().height,
        };
        r.track = {
            width: 30 * unit.step,
            x: 0,
            height: r.bounds.height - 8,
            y: 4,
            rx: 2,
        };
        r.handle = {
            width: unit.step,
            height: r.bounds.height - 4,
            y: 2
        };
        el.handleRange = {
            min: r.track.x,
            span: r.track.width - r.handle.width,
        };
        r.markers = {
            x: 0,
            width: el.handleRange.span + 8,
            y: r.track.y / 2,
            height: r.bounds.height - r.track.y,
        };
        r.value = {
            width: r.bounds.width - r.track.x - r.track.width,
            x: r.track.x + r.track.width + 3 * unit.step,
            height: r.bounds.height,
            y: unit.text - r.track.y / 2,
        };
        withRect(el.track, r.track);
        withRect(el.ticks.markers, r.markers);
        withRect(el.handle, r.handle);
        withRect(el.value, r.value);
        if (el.virgin) {
            el.ticks.pattern.append(
                svgChild(svg, "rect", "", {
                    x: r.handle.width / 2,
                    width: 2,
                    height: r.bounds.height,
                    fill: "darkorange",
                })
            );
            el.ticks.pattern.setAttribute("width", intervalPixels());
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
        el.handle.setAttribute(
            "stroke",
            state.play.running ? "black" : "darkorange"
        );
        if (!state.play.running) {
            if (el.remember.timestamp === state.play.previous.timestamp) {
                return;
            } else {
                el.remember.timestamp = state.play.previous.timestamp ?? undefined;
            }
        }
        el.value.textContent = state.time.toFixed(2);
        maybeExtendMaximum();
        el.handle.setAttribute(
            "x",
            secondsAsPixels(state.time, el, state, el.handleRange.min)
        );
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
    };

    el.do.toggle = () => {
        if (state.play.running) {
            state.play.running = false;
        } else {
            state.play.running = true;
            state.play.previous.timestamp = null;
        }
    };

    addDocumentListeners(el, state);
    addMouseInteraction(el, state);

    return el;

    function maybeExtendMaximum() {
        const extendMax = state.time - state.play.at.extend;
        if (extendMax <= 0) {
            return;
        }
        state.play.at.max += extendMax;
        state.play.at.extend += extendMax;
        el.ticks.pattern.setAttribute("width", intervalPixels());
    }

    function intervalPixels() {
        return secondsAsPixels(el.ticks.intervalSec, el, state);
    }
}

function secondsAsPixels(seconds, el, state, offset = 0) {
    // String is a no-cost inlined version to make linters happy while passing a number
    // i.e. .toString() would actually calculate something needlessly, thus be not-good.
    return String(el.handleRange.span * seconds / state.play.at.max + offset);
}

function pixelsAsSeconds(pixelWidth, el, state) {
    return pixelWidth * (state.play.at.max / el.handleRange.span);
}

function svgChild(svg, tag, id = "", attributes = {}) {
    const child = document.createElementNS(svg.namespaceURI, tag);
    if (id) {
        child.id = id;
    }
    for (const attribute of Object.entries(attributes)) {
        child.setAttribute(...attribute);
    }
    svg.appendChild(child);
    return child;
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
        animationFrame: null,
        ctm: null,
    };

    el.handle.addEventListener("mouseover", () => {
        el.handle.setAttribute("fill", el.handle.getAttribute("stroke"));
    });
    el.handle.addEventListener("mouseout", () => {
        el.handle.setAttribute("fill", "none");
    });

    el.svg.addEventListener("mousedown", event => {
        event.preventDefault();
        const pos = mousePosition(el, event);
        if (event.target === el.handle) {
            drag.original = readFloatAttributes(el.handle, "x", "opacity");
            drag.offset = pos.x - drag.original.x;
            drag.initial = pos.x;
            drag.ghost = el.handle.cloneNode(true);
            el.svg.appendChild(drag.ghost);
            drag.ghost.id = "dragging-handle";
            drag.ghost.setAttribute("opacity", 1);
            el.handle.setAttribute("opacity", 0.4);
        }
    }, {
        passive: false
    });

    el.svg.addEventListener("mousemove", event => {
        if (!drag.ghost) {
            return;
        }
        event.preventDefault();
        if (drag.animationFrame) {
            cancelAnimationFrame(drag.animationFrame);
        }
        drag.animationFrame = requestAnimationFrame(() => {
            const mouseX = mousePosition(el, event).x;
            console.log("CTM?", el.ctm);
            const x = Math.max(0,
                Math.min(el.handleRange.span,
                    mouseX - drag.offset,
                ));
            seekPixel(x);
            drag.ghost.setAttribute("x", x);
            drag.animationFrame = null;
        });
    }, {
        passive: false
    });


    document.addEventListener("mouseup", event => {
        if (!drag.ghost) {
            return;
        }
        const dropX = parseFloat(drag.ghost.getAttribute("x"));
        el.svg.removeChild(drag.ghost);
        drag.ghost = null;
        el.handle.setAttribute("opacity", drag.original.opacity);
        const doApply = false;
        if (doApply) {
            seekPixel(dropX - drag.initial);
        }
    });

    function seekPixel(delta) {
        el.do.jump({
            delta: pixelsAsSeconds(delta, el, state),
            min: 0,
            max: state.play.at.max
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

function readFloatAttributes(element, ...attributes) {
    const result = {}
    for (const attribute of attributes) {
        result[attribute] = parseFloat(element.getAttribute(attribute));
    }
    return result;
}