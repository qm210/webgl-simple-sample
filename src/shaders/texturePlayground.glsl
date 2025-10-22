#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform float iGamma;
uniform float iSomething;
uniform float iSeed;
uniform sampler2D iTexture0;
uniform sampler2D iTexture1;
uniform sampler2D iTexture2;
uniform float iTexture2AspectRatio;

vec4 c = vec4(1., 0., -1., .5);

const float twoPi = 6.28319;

float sdCircle( in vec2 p, in float r )
{
    return length(p)-r;
}

void applyGrid(inout vec3 col, in vec2 uv, float gridStep) {
    uv = mod(uv, gridStep);
    // <-- verallgemeinert fract(x) == mod(x, 1.)
    float dMin = min(uv.x, uv.y);
    col *= 1. - 0.5 * (step(dMin, 0.005));
    // (*) Ein Problem hiermit kann sein, dass die Gitterlinien immer direkt _nach_ der
    //     gemeinten Koordinate liegen. Daher z.B. unten die horizonale Linie sichtbar, oben nicht.
    //     Wie kann man hier Symmetrie herstellen, d.h. die Linie mittig um die Gitterwerte legen?
    // Hint:
    // https://graphtoy.com/?f1(x,t)=1-0.5*(step(x,0.1))&v1=true&f2(x,t)=step(0.,x)&v2=true&f3(x,t)=&v3=false&f4(x,t)=&v4=false&f5(x,t)=&v5=false&f6(x,t)=&v6=false&grid=1&coords=0.055959188393239614,-0.021704530457179908,1.6215668511724766
}

vec2 hash22(vec2 p)
{
    p = p*mat2(127.1,311.7,269.5,183.3);
    p = -1.0 + 2.0 * fract(sin(p)*43758.5453123);
    return sin(p*6.283 + iSeed);
}

float perlin_noise(vec2 p)
{
    vec2 pi = floor(p);
    vec2 pf = p-pi;

    vec2 w = pf*pf*(3.-2.*pf);

    float f00 = dot(hash22(pi+vec2(.0,.0)),pf-vec2(.0,.0));
    float f01 = dot(hash22(pi+vec2(.0,1.)),pf-vec2(.0,1.));
    float f10 = dot(hash22(pi+vec2(1.0,0.)),pf-vec2(1.0,0.));
    float f11 = dot(hash22(pi+vec2(1.0,1.)),pf-vec2(1.0,1.));

    float xm1 = mix(f00,f10,w.x);
    float xm2 = mix(f01,f11,w.x);

    float ym = mix(xm1,xm2,w.y);
    return ym;
}

const int fractionSteps = 1;
const float fractionalScale = 2.;
const float fractionalWeight = 0.5;

float fractionalNoiseSum(vec2 p){
    // p *= 4.;
    float a = 1., r = 0., s = 0.;
    for (int i=0; i < fractionSteps; i++) {
        r += a * perlin_noise(p);
        s += a;
        p *= fractionalScale;
        a *= fractionalWeight;
    }
    return r / s;
}


void main() {
    vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    vec3 col = c.xxx;

    // (*) just for orientation, a small circle
    float d = sdCircle(uv, 0.02);
    // Compare: a) draw pure d
    col = mix(col, c.xxx, d); // or even just: d * c.xxx;
    // With: b) common shape drawing via smoothstep() and mix():
    // col = mix(c.yyy, c.xxx, smoothstep(0., 0.001, d));

    applyGrid(col, uv, 0.5);

    if (uv.x > 0. && uv.y > 0.) {
        // (*) vergleicht das mit der Quelldatei, passt das so?
        col = texture(iTexture0, uv).rgb; // .rgb == .xyz
    }

    vec2 st = gl_FragCoord.xy / iResolution.y;
    st.x /= iTexture2AspectRatio;
    st.y = 1. - st.y;
    // Als Oneliner:
    // st = gl_FragCoord.xy * vec2(1. / iTexture2AspectRatio, -1.) / iResolution.y + vec2(0, 1);
    vec3 col1 = texture(iTexture1, st).rgb;
    vec3 col2 = texture(iTexture2, st).rgb;
    col = col2;

    // Blending Methods:
    // Maximum = Nur Aufhellen
    // col = max(col, col2);
    // Minimum = Nur Abdunkeln
    // col = min(col, col2);
    // Multiplizieren: Dunkelt auch ab
    // col *= col2;
    // Dividieren: ist Quatsch (eher "artsy")
    // col /= col2;
    // col = (1. - (1. - col) * (1. - col2));

    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = vec3(gray);
    col = pow(col, vec3(1./iGamma));

    col = mix(col, col2, iSomething);

    // contrast
//    float contrast = iSomething + 1.;
//    col = (col - 0.5) * contrast + 0.5;

    // Einfacher Gauß'scher Weichzeichner (Gaussian Blur)
    /*
    col = c.yyy;
    float weightSum = 0.;
    const float delta = 0.005;
    const float range = 0.01;
    const float gaussWidth = 2. * delta;
    for (float ds = -range; ds <= range; ds += delta) {
        for (float dt = -range; dt <= range; dt += delta) {
            vec2 shift = vec2(ds, dt);
            float weight = exp(-length(shift) / gaussWidth);
            col += weight * texture(iTexture2, st + shift).rgb;
            weightSum += weight;
        }
    }
    // col /= weightSum;
    */

    /*
    col = vec3(fractionalNoiseSum(uv * 2.));
    col = 0.5 + 0.5 * col;

    applyGrid(col, uv, 0.25);
    */

    fragColor = vec4(col, 1.0);
    return;
}
