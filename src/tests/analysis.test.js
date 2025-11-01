import {describe, it, expect} from "vitest";
import {analyzeShader, extendAnalysis, parseScopes, SymbolType} from "../glslCode/analysis.js";
import REGEX from "../glslCode/regex.js";

export const sample = `
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

const sampleUnusedFunction = `
    
        vec3 unused( in vec3 c ){
            float h = 0.0;
            float s = 0.0;
            float l = 0.0;
            float r = c.r;
            float g = c.g;
            float b = c.b;
            float cMin = min( r, min( g, b ) );
            float cMax = max( r, max( g, b ) );
        
            l = ( cMax + cMin ) / 2.0;
            if ( cMax > cMin ) {
                float cDelta = cMax - cMin;
        
                s = l < .0 ? cDelta / ( cMax + cMin ) : cDelta / ( 2.0 - ( cMax + cMin ) );
        
                if ( r == cMax ) {
                    h = ( g - b ) / cDelta;
                } else if ( g == cMax ) {
                    h = 2.0 + ( b - r ) / cDelta;
                } else {
                    h = 4.0 + ( r - g ) / cDelta;
                }
        
                if ( h < 0.0) {
                    h += 6.0;
                }
                h = h / 6.0;
            }
            return vec3( h, s, l );
        }
                
        #define FROM_RGB(x) x
        #define TO_RGB(x) x

        void main() {
            vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
        
            float insideSquare = float(abs(uv.x) <= 1.);
        
            uv = 0.5 * uv + 0.5;
        
            vec3 col00 = vec3(0,0,0);
            vec3 col01 = vec3(1,1,1);
            vec3 col10 = vec3(0,0,1);
            vec3 col11 = vec3(1,1,0);
        
            col00 = FROM_RGB(col00);
            col01 = FROM_RGB(col01);
            col10 = FROM_RGB(col10);
            col11 = FROM_RGB(col11);
        
            vec3 gradient = mix(
                mix(col00, col10, uv.x),
                mix(col01, col11, uv.x),
                uv.y
            );
        
            gradient = TO_RGB(gradient);
        
            gradient *= insideSquare;
        
            fragColor = vec4(gradient, 1.);
        }
    `;

const getDefines = analyzed =>
    analyzed.symbols
        .filter(s => s.symbolType === SymbolType.DefineDirective);

describe("Regex matching", () => {

    it ("standalone: finds define directives", async () => {
        const code = `
            #define TEST_DIRECTIVE 1
            #define TEST_DIRECTIVE_WITH_ARGS(x) x
        `;
        const defineMatches = [...code.matchAll(REGEX.DEFINE_DIRECTIVE)];
        expect(defineMatches.length).toBe(2);

        const analyzed = await extendAnalysis(analyzeShader(code));
        const defines = getDefines(analyzed);
        expect(defines.length).toBe(2);

    });

    it ("sample: finds define directives", async () => {
        const analyzed = await extendAnalysis(analyzeShader(sample));
        const defines = getDefines(analyzed);

        expect(defines.length).toBe(2);
    });

    it ("standalone: the matcher.pattern regex works", async () => {
        const code = `
        ...
        #define FROM_RGB(x) x
        ...
        </div></div><div class="line" id="fragment.source.line.203"><div class="line-number">203</div><div class="code">    col00 = FROM_RGB(col00);
        </div><div class="line" id="fragment.source.line.204"><div class="line-number">204</div><div class="code">    col01 = FROM_RGB(col01);
        ...
        `;
        const analyzed = await extendAnalysis(analyzeShader(code));
        const defines = getDefines(analyzed);

        expect(defines.length).toBe(1);
    });

    it ("sample: matches whole function", () => {
        const target = sampleUnusedFunction.matchAll(REGEX.FUNCTION);
        expect(target).toBeDefined();
    });

    it ("CONSTANT RegExp works", () => {
        const code = "const vec3 c = vec3(1,0,-1);"
        const target = code.matchAll(REGEX.CONSTANT);
        expect(target).toBeDefined();
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

    it ("works", async () => {
        const analyzed = await extendAnalysis(analyzeShader(example));
        const scopes = parseScopes(analyzed.lines);

        expect(scopes).toBeDefined();

        // TODO
    });

    it ("works for functions with multi-line signatures", async () => {
        const ugly = `
            const float irrelevant = 3.;
        
            void 
theUglyFunction

  (
                in vec3 pos,
                inout float d,
                )
                
                {
                
                   if (true) {
                   
                     discard;
                   }}
                   
                   void another() { return; }
                   
                   float blablablaluberluber = 0.;
        `;
        const analyzed = await extendAnalysis(analyzeShader(ugly));
        expect(analyzed.functions.length).toBe(2);
    });

});

describe("Function Matching", () => {

    it ("does the extended function matching", async () => {
        const analyzed = await extendAnalysis(analyzeShader(sample));

        const target = analyzed.unusedSymbols
            .find(s => s.name === "hsl2rgb");

        expect(target).toBeDefined();
        expect(target.definitionSpansLines).toBe(5);
    });
});
