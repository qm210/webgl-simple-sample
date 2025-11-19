import {extendAnalysis} from "./analysis.js";
import {withGlslHighlighting, withSymbolsHighlighted} from "./highlighting.js";
import {addShaderCodeEventListeners, addShaderControlsEventListeners, scrollToElementId} from "../layout/events.js";
import {createDiv} from "../layout/helpers.js";
import {idForLine} from "../layout/shaderCode.js";

export function deferExtendedAnalysis(elements) {
    return Promise.all(
        elements.register.map(code =>
            extendAnalysis(code.analyzed)
                .then(extended => {
                    applyExtendedAnalysis(
                        extended,
                        code.references,
                        elements,
                    );
                })
                .catch(error => {
                    console.error("Analysis failed, guess your shader's broken anyway.");
                    console.info(error);
                })
        )
    );
}

function applyExtendedAnalysis(analyzed, references, elements) {
    const {header, sources} = references;
    enrichHeader(header, analyzed);

    for (const line of analyzed.lines) {
        const element = references[line.number];

        let code = element.code.innerHTML;
        code = withGlslHighlighting(code);
        code = withSymbolsHighlighted(code, analyzed.symbols, line.number);
        element.code.innerHTML = code;

        if (element.line.classList.contains("error")) {
            continue;
        }

        if (line.belongsToUnusedBlock) {
            element.line.classList.add("unused-definition");
            element.annotation.textContent = "unused";
        }
    }

    addShaderCodeEventListeners(analyzed, sources, elements.scrollStack);
    addShaderControlsEventListeners(analyzed, elements);

    for (const element of sources.getElementsByClassName("symbol")) {
        const symbolName = element.getAttribute("data");
        const symbol = analyzed.symbols.find(symbol => symbol.name === symbolName);
        if (!symbol) {
            continue;
        }
        const code = symbol.code ?? symbol.matched.trimmed;
        const lineInfo = `line ${symbol.definedInLine}`;
        element.title = `${lineInfo}: ${code}`;
    }
}

function enrichHeader(element, analyzed) {
    const main = analyzed.symbols.find(f => f.name === "main");
    if (!main) {
        return;
    }

    const mainLink = createDiv(
        `main() in l. ${main.definedInLine}`,
        "quicklink"
    );
    element.appendChild(mainLink);

    mainLink.addEventListener("click", () => {
        scrollToElementId(idForLine(analyzed.shaderKey, main.definedInLine))
    });
}