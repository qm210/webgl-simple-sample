import {describe, it, expect} from "vitest";
import {analyzeShader, parseScopes, SymbolType} from "../glslCode/analysis.js";

const sample = `
#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;

const float pi = 3.141593;

vec3 c = vec3(1,0,-1);

vec3 hsl2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

#define TEST_DIRECTIVE 1
            #define TEST_DIRECTIVE_WITH_ARGS(x) x

void main() {

    if (TEST_DIRECTIVE == 1) {
        discard;
    }

    fragColor = c.yxxx;
}
`;

const getDefines = analyzed =>
    analyzed.symbols
        .filter(s => s.symbolType === SymbolType.DefineDirective);

describe("Regex matching", () => {

    it ("standalone: finds define directives", () => {
        const analyzed = analyzeShader(`
            #define TEST_DIRECTIVE 1
            #define TEST_DIRECTIVE_WITH_ARGS(x) x
        `);
        const defines = getDefines(analyzed);

        expect(defines.length).toBe(2);
    });

    it ("sample: finds define directives", () => {
        const analyzed = analyzeShader(sample);
        const defines = getDefines(analyzed);

        expect(defines.length).toBe(2);
    });

    it ("standalone: the matcher.pattern regex works", () => {
        const code = `
        ...
        #define FROM_RGB(x) x
        ...
        </div></div><div class="line" id="fragment.source.line.203"><div class="line-number">203</div><div class="code">    col00 = FROM_RGB(col00);
        </div><div class="line" id="fragment.source.line.204"><div class="line-number">204</div><div class="code">    col01 = FROM_RGB(col01);
        ...
        `;
        const analyzed = analyzeShader(code);
        const defines = getDefines(analyzed);

        expect(defines.length).toBe(1);
    })
});

describe("Scope parsing", () => {

    const example = `
        #version 300 es

        in vec4 aPosition;
        
        void main() {
            float sum = 0.;
            for (int i=0; i<10; i++) {
                float inner = 10. * float(i.);
                sum += inner;
            }

            gl_Position = aPosition;
        }
    `;

    it ("works", () => {
        const analyzed = analyzeShader(example);
        const scopes = parseScopes(analyzed);

        expect(scopes).toBeDefined();

        // TODO
    });

});
