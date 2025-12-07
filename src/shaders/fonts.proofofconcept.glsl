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

float glyph(in vec2 uv, int ascii, float scale, out vec2 step) {
    int index = ascii - START_ASCII;
    if (index < 0 || index >= N_GLYPHS) {
        return 0.;
    }
    // I chose vec4 such as:
    vec2 glyphCenter = glyphDef[index].xy;
    vec2 halfSize = glyphDef[index].zw;

    // u0 v0 u1 v1
    // vec4 glyphRect = vec4(351./512., 114./256., 387./512., 150./256.);
//    glyphCenter = vec2(0.72, 0.52);
    //    glyphSize = vec2(0.07, 0.14);

    // pos comes from uv normalization, texture is in st
    // vec2 stPos = 0.5 + 0.5 * invAsp * pos;
    // vec2 glyphCenter = 0.5 * (glyphRect.xy + glyphRect.zw);

    vec2 texCoord = glyphCenter + clamp(uv2st * uv, -halfSize, +halfSize);

    //    vec2 texCoord = uv2st * uv + glyphCenter;
    //    texCoord = clamp(texCoord, glyphCenter - 0.5 * glyphSize, glyphCenter + 0.5 * glyphSize);

    // scale glyphSize out variable to "uv" normalization
    // (but Keming has to be done manually anyway)
    step = 4. * vec2(aspRatio, 1) * halfSize;

    vec3 msd = texture(glyphTex, texCoord).rgb;
    float sdf = median(msd.r, msd.g, msd.b) - 0.5;
    return clamp(sdf/fwidth(sdf) + 0.5, 0., 1.0);
}

void main() {
    //vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    vec3 colGradient = 0.5 + 0.5*cos(iTime+st.xyx+vec3(0,2,4));
    fragColor = vec4(colGradient, 1.);

    vec2 step;
    vec2 cursor = uv - vec2(-1.33, 0.);
    float d;
    d = glyph(cursor, 81, 1., step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    d = glyph(cursor, 77, 1., step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x -= 0.1;
    d = glyph(cursor, 115, 1., step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    d = glyph(cursor, 97, 1., step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    d = glyph(cursor, 121, 1., step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x += 0.04;
    d = glyph(cursor, 115, 1., step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x -= 0.2;
    d = glyph(cursor, 72, 1., step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x += 0.04;
    d = glyph(cursor, 105, 1., step);
    fragColor.rgb = mix(fragColor.rgb, iTextColor, d);
    cursor.x -= step.x;
    cursor.x -= 0.2;
    const vec3 textColor2 = vec3(0.8, 1., 0.5);
    cursor *= 0.5;
    d = glyph(cursor, 92, 1., step);
    fragColor.rgb = mix(fragColor.rgb, textColor2, d);
    cursor.x -= step.x;
    d = glyph(cursor, 111, 1., step);
    fragColor.rgb = mix(fragColor.rgb, textColor2, d);
    cursor.x -= step.x - 0.04;
    d = glyph(cursor, 47, 1., step);
    fragColor.rgb = mix(fragColor.rgb, textColor2, d);
    cursor.x -= step.x;
}
