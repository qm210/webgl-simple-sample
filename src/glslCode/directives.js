import {REGEX} from "./definitions.js";

const CONDITIONAL_DIRECTIVES =
    ["if", "elif", "else", "ifdef", "ifndef", "endif"];

export function handleDirectives(code, stack) {
    stack.current = [...code.matchAll(REGEX.DIRECTIVE)][0]?.groups;
    const keyword = stack.current?.keyword;
    if (!keyword) {
        return;
    }
    if (keyword === "define") {
        const define = [...code.matchAll(REGEX.DEFINE_DIRECTIVE)][0]?.groups;
        if (!define) {
            // TODO: if this really never happens again, might remove this check.
            console.warn("RegEx for define not parsed correctly", stack.current, code);
        } else {
            stack.defined.push(define);
        }
    } else if (keyword === "undef") {
        stack.defined = stack.defined
            .filter(d => d.name !== stack.current.expression);
    } else if (CONDITIONAL_DIRECTIVES.includes(keyword)) {
        handleConditionalDirectives(stack, keyword)
    }
}

function handleConditionalDirectives(stack, keyword) {
    const lastCondition = stack.conditions.pop();
    if (keyword === "endif") {
        return;
    } else if (keyword === "else" || keyword === "elif") {
        stack.conditions.push({
            ...lastCondition,
            inverted: !lastCondition?.inverted
        });
    }
    if (keyword === "if" || keyword === "elif") {
        stack.conditions.push({
            expression: stack.current.expression,
            inverted: false,
        });
    } else if (keyword === "ifdef" || keyword === "ifndef") {
        stack.conditions.push({
            expression: `defined(${stack.current.expression})`,
            inverted: keyword === "ifndef"
        });
    }
}