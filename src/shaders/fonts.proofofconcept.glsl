#version 300 es
precision mediump float;
out vec4 fragColor;
in vec2 uv;
in vec2 st;
in float aspRatio;
in mat2 uv2st;

uniform vec2 iResolution;
uniform vec4 iMouseDrag;
uniform float iTime;
uniform int iFrame;

const int N_GLYPHS = 97;
uniform sampler2D glyphTex;
layout(std140) uniform Glyphs {
    vec4 glyphDef[97];
};
const int START_ASCII = 33; // 33 if charset begins with "!"
uniform vec4 glyphDefM;

uniform vec3 iTextColor;

uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;
uniform float iFree5;


const vec4 c = vec4(1, 0, -1, 0.5);

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

float sdGlyph(in vec2 uv, int ascii, out vec2 size) {
    int index = ascii - START_ASCII;
    if (index < 0 || index >= N_GLYPHS) {
        return 0.;
    }
    // I chose vec4 such as:
    vec2 center = glyphDef[index].xy;
    vec2 halfSize = glyphDef[index].zw;

    vec2 texCoord = center + clamp(uv2st * uv, -halfSize, halfSize);
    vec3 msd = texture(glyphTex, texCoord).rgb;

    size = 4. * vec2(aspRatio, 1) * halfSize;

    // unsure whether this really is the same understanding of SDF
    // as we know it from everywhere. Tried to get as good as it got.
    float sdf = 0.5 - median(msd.r, msd.g, msd.b);
    return sdf;
}

float glyph(in vec2 uv, int ascii, out vec2 step) {
    float sdf = sdGlyph(uv, ascii, step);
    // return clamp(-sdf/fwidth(sdf) + 0.5, 0., 1.0);
    return clamp(-sdf/fwidth(sdf) + 0.5, 0., 1.0);
}

// that is a bad idea:
float maskedSdGlyph(in vec2 uv, int ascii, out vec2 size) {
    // seems to be zero at the straight edges for infinite distance. that is bad.
    float sdf = sdGlyph(uv, ascii, size);
    // try to mask it with this approximation of a rectangle SDF.?
//    vec2 p = abs(uv) - 0.5 * size;
//    float mask = max(p.x, p.y);
//    mask = smoothstep(0.0, 0.01, mask);
//    return sdf + mask;
    // nah. circular?
    float mask = length(uv/size) - 0.5;
    mask = smoothstep(0.0, 0.8, mask);
//    return mask;
//    return mask * sdf;
    return sdf + mask;
    float masked = sdf - max(0., mask * sdf);
    return max(0., mask * sdf);
    return sdf - mask * sdf;
    return max(mask, sdf);

    //return sdf * clamp(1./fwidth(sdf), 0., 2.);
    // return sdf * mix(0., 1., exp(-100. * fwidth(sdf) * ));
}

void main() {
    //vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    vec3 colGradient = 0.5 + 0.5*cos(iTime+st.xyx+vec3(0,2,4));
    fragColor = vec4(colGradient, 1.);

    vec2 step;
    vec2 cursor = uv - vec2(-1.44, 0.);
    cursor *= 0.8;
    float d = 1.e5;
    d = min(d, sdGlyph(cursor, 81, step));

    cursor.x -= step.x;
    d = min(d, sdGlyph(cursor, 77, step));
    cursor.x -= step.x;

    //#define JUST_QUICK_OUTPUT
//    #ifdef JUST_QUICK_OUTPUT
//        fragColor.rgb = vec3(0.5 + 0.1 * d * iFree3);
//        return;
//    #endif

    float glowInner = exp(-50. * (1. + iFree0) * d * d) * 0.6;
    float glowOuter = exp(-8. * (1. + iFree1) * d) * 0.4 * smoothstep(-0.04, 0., d);
    vec3 glow = glowInner * c.xxy + glowOuter * iTextColor;
    glow *= iFree3;

    float gradient = fwidth(d);
    float mask = smoothstep(0., 0.33, gradient);
    glow *= mask * smoothstep(iFree5, iFree4, abs(d));
    glow = pow(glow, vec3(iFree2));

    fragColor.rgb += glow;

    float shape = smoothstep(0.01, 0., d);
    fragColor.rgb = mix(fragColor.rgb, c.yyy, 0.4 * shape);

    // <-- UP TO HERE: QM WITH GLOW

    cursor *= 1.25;
    cursor.x -= 0.1;
    d = glyph(cursor, 115, step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    d = glyph(cursor, 97, step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    d = glyph(cursor, 121, step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x += 0.04;
    d = glyph(cursor, 115, step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x -= 0.2;
    d = glyph(cursor, 72, step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x += 0.04;
    d = glyph(cursor, 105, step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x -= 0.2;
    const vec3 textColor2 = vec3(0.8, 1., 0.5);
    cursor *= 0.5;
    d = glyph(cursor, 92, step);
    fragColor.rgb = mix(fragColor.rgb, textColor2, d);
    cursor.x -= step.x;
    d = glyph(cursor, 111, step);
    fragColor.rgb = mix(fragColor.rgb, textColor2, d);
    cursor.x -= step.x - 0.04;
    d = glyph(cursor, 47, step);
    fragColor.rgb = mix(fragColor.rgb, textColor2, d);
    cursor.x -= step.x;
}

