#version 300 es
precision highp float;

// this is the Hello-World-Shader of shadertoy,
// but translated for our WebGl2 use case.
//
// Note: the pipeline has to be adjusted for this!

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform float iWhatever;

vec4 c = vec4(1., 0., -1., .5);

mat2 rotate(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s,  c); // <-- ??
}

float sdBox( in vec2 p, in vec2 b, float angle)
{
    p *= rotate(angle);
    vec2 d = abs(p)-b;
    return length(max(d,0.0)) + min(max(d.x,d.y),0.0);
}

float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float sdEquilateralTriangle(vec2 p, float size) {
    const float k = sqrt(3.0);
    p /= -size;
    p.x = abs(p.x) - 1.0;
    p.y = p.y + 1.0/k;
    if(p.x + k * p.y > 0.0) p = vec2(p.x - k*p.y, -k*p.x - p.y) / 2.0;
    p.x -= clamp(p.x, -2.0, 0.0);
    return -length(p)*sign(p.y);
}

float polar(vec2 v) {
    // what is that, geometrically for a vec2?
    return atan(v.y, v.x);
}

const float pi_half = 1.57;

float sdArrow(inout vec3 col, in vec2 uv, vec2 from, vec2 to) {
    const float arrowSize = .04;
    to = mix(to, from, arrowSize);
    vec2 head = uv - to;
    head *= rotate(-pi_half - polar(to - from));
    float dHead = sdEquilateralTriangle(head, arrowSize);
    // what is... that??
    // what does min() do, in graphical words?
    float d = sdSegment(uv, from, to);
    d = min(d - 0.01, dHead);
    // what is that smoothstep again?
    return smoothstep(0.0, 0.001, -d);
}

void someOtherFunction(inout vec3 col, in vec2 uv) {
    float phi = iTime;
    float d = sdBox(uv - vec2(-0.7, 0.1), vec2(0.4, .25), phi);
    col.b = 0.75 * sin(80. * d);

    col.b = exp(-30. * d);
    // col.b = clamp(col.b, 0., 1.);
    col.b *= 0.5; // warum ist das deckend blau?
}

struct Arrow {
    vec2 vec;
    vec3 color;
};

void vectorStuff(inout vec3  col, in vec2 uv) {
    vec2 vecA = vec2(1, 0);
    float d = sdArrow(col, uv, vec2(0), vecA);
    col.g = mix(col.g, 0., d);

    vec2 vecB = vec2(0, -.5);
    d = sdArrow(col, uv, vecA, vecA + vecB);
    col.r = mix(col.r, 0., d);

    vec2 vecC = normalize(vec2(0.35, 1.7));
    // vecC *= rotate(iTime);
    d = sdArrow(col, uv, c.yy, vecC);
    col = mix(col, c.xxx, d);
}

vec3 someFunction() {
    float r = 0.7;
    // r += 0.3 * sin(6.283 * iTime);
    return vec3(r, 0., 1.);
}

void main() {
    vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(uv.xyx+vec3(4, 0, 4));

    col.b = 0.1 * iWhatever;

    if (length(uv) < 0.05) {
        // col *= 0.4;
    }

    if (length(uv - vec2(-1., 0.5)) < 0.05) {
        col.g = 0.;
    }

    if (abs(length(uv - vec2(-0.5, -0.5)) - 0.08) < 0.015) {
        col = someFunction();
    }

    col.r += 0.5 * exp(-fract(uv.x));

    someOtherFunction(col, uv);

    vectorStuff(col, uv);

    // Output to screen
    fragColor = vec4(col, 1.0);
}
