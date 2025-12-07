#version 300 es
precision mediump float;
out vec4 fragColor;
in vec2 uv;
in vec2 st;
in float aspRatio;
in mat2 uv2texSt;

// SHARED
uniform vec2 iResolution;
uniform vec4 iMouseDrag;
uniform float iTime;
uniform int iFrame;
uniform int passIndex;
uniform int debugOption;
uniform sampler2D prevImage; // <-- evt. same wie texColor;

// FLUID SIMULATION --> also, stimulation
uniform float deltaTime;
uniform sampler2D texColor;
uniform sampler2D texVelocity;
uniform sampler2D texCurl;
uniform sampler2D texPressure;
uniform sampler2D texDivergence;
uniform sampler2D texPostSunrays;
uniform sampler2D texPostBloom;
uniform sampler2D texPostBloomDither;
uniform float iColorDissipation;
uniform float iVelocityDissipation;
uniform float iMaxInitialVelocity;
uniform float iCurlStrength;
uniform float iPressure;
uniform int pressureIterations;
// TODO: Random Spawn -- should go!
uniform float iSpawnSeed;
uniform float iSpawnAge;
uniform vec3 iSpawnColorHSV;
uniform float iSpawnHueGradient;
uniform float iSpawnRandomizeHue;
// for post processing
uniform float iBloomIntensity;
uniform float iBloomThreshold;
uniform float iBloomSoftKnee;
uniform vec2 iBloomDitherScale;
uniform float iSunraysWeight;
uniform float iSunraysIterations;
uniform float iSunraysDensity;
uniform float iSunraysDecay;
uniform float iSunraysExposure;
uniform float iGamma;
uniform float iVignetteInner;
uniform float iVignetteOuter;
uniform float iVignetteScale;
// <--- FLUID

// --> GLYPHS
const int N_GLYPHS = 97;
uniform sampler2D glyphTex;
layout(std140) uniform Glyphs {
    vec4 glyphDef[97];
};
const int START_ASCII = 33; // 33 if charset begins with "!"
uniform vec4 glyphDefM;
uniform vec3 iTextColor;
// <-- GLYPHS

// --> CLOUDS
uniform float iCloudYDisplacement;
uniform float iCloudLayerDistance;
uniform float iLightLayerDistance;
uniform float iCloudSeed;
uniform float iSkyQuetschung;
uniform int iSampleCount;
uniform int iCloudLayerCount;
uniform int iLightLayerCount;
uniform float iCloudAbsorptionCoeff;
uniform float iCloudAnisoScattering;
uniform int iCloudNoiseCount;
uniform int iLightNoiseCount;
uniform vec3 iNoiseScale;
uniform float iNoiseScaleB;
uniform vec3 vecSunPosition;
uniform vec3 vecSunColorYCH;
uniform float iSunExponent;
uniform vec3 vecTone1;
uniform vec3 vecTone2;
uniform float iAccumulateMix;
// und allgemein Noise (vllt duplicates)
uniform float iNoiseFreq;
uniform float iNoiseLevel;
uniform float iNoiseOffset;
uniform int iFractionalOctaves;
uniform float iFractionalScale;
uniform float iFractionalDecay;
uniform float iCloudMorph;

uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;
uniform float iFree5;

#define INIT_VELOCITY_PASS 0
#define INIT_COLOR_DENSITY_PASS 1
#define INIT_PRESSURE_PASS 2
#define INIT_CURL_FROM_VELOCITY 3
#define PROCESS_VELOCITY_VORTICITY 10
#define PROCESS_DIVERGENCE_FROM_VELOCITY 11
#define PROCESS_PRESSURE 12
#define PROCESS_GRADIENT_SUBTRACTION 13
#define PROCESS_ADVECTION 14
#define PROCESS_FLUID_COLOR_PASS 19
#define POST_PASS_BLOOM_PREFILTER 20
#define POST_PASS_BLOOM_BLUR 21
#define POST_PASS_SUNRAYS_MASK 30
#define POST_PASS_SUNRAYS_ACTUAL 31
#define POST_PASS_SUNRAYS_BLUR 32
#define RENDER_COLORS_PASS 40
#define ACCUMULATE_CLOUDS 60
#define RENDER_CLOUDS 61
#define TEXT_RENDERING_0 80
#define TEXT_RENDERING_1 81
#define TEXT_RENDERING_2 82
#define RENDER_FINALLY_TO_SCREEN 100

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

    vec2 texCoord = center + clamp(uv2texSt * uv, -halfSize, halfSize);
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

float sdRect(in vec2 uv, in vec2 size)
{
    vec2 q = abs(uv)-size;
    return length(max(q,0.0)) + min(max(q.x,q.y),0.0);
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

void qmSaysHi(in vec2 uv, out vec3 col) {
    vec2 dims;
    vec2 cursor = uv - vec2(-1.44, 0.);
    cursor *= 0.8;
    float d = 100., dR = 100.;

    vec2 pos = cursor + c.yx * 0.2 * sin(iTime * 1.4);
    d = min(d, sdGlyph(pos, 81, dims));
    dR = min(dR, sdRect(pos, 0.5 * dims));
    cursor.x -= dims.x;

    pos = cursor - c.yx * 0.15 * cos(iTime);
    d = min(d, sdGlyph(pos, 77, dims));
    dR = min(dR, sdRect(pos, 0.5 * dims));
    cursor.x -= dims.x;

    //#define JUST_QUICK_OUTPUT
    //    #ifdef JUST_QUICK_OUTPUT
    //        col = vec3(0.5 + 0.1 * d * iFree3);
    //        return;
    //    #endif

    float glowInner = exp(-50. * (1. + iFree0) * d * d) * 0.6;
    float glowOuter = exp(-8. * (1. + iFree1) * d) * 0.4 * smoothstep(-0.04, 0., d);
    vec3 glow = glowInner * c.xxy + glowOuter * iTextColor;
    glow *= iFree3;

    float gradient = fwidth(d);
    float mask = smoothstep(0., 0.33, gradient);
    glow *= mask * smoothstep(iFree5, iFree4, abs(d));
    glow = pow(glow, vec3(1. + iFree2));

    float shape = smoothstep(0.01, 0., d);
    col = mix(col, c.yyy, 0.4 * shape);

    // understanding the "size / dims / step" out in its scaling: rect around the M
    float dRectMBorder = abs(dR) - 0.001;
    // float dRectMHard = smoothstep(0.01, 0., dRectM);
    // float dRectMSmooth = smoothstep(0.1, 0., dRectM);
    dR = smoothstep(0.001, 0., dR);
    // col = mix(col, c.yyy, dRectM);

    col += glow * dR;

    // <-- UP TO HERE: QM WITH GLOW

    cursor *= 1.25;
    cursor.x -= 0.1;
    d = glyph(cursor, 115, dims);
    col = mix(col, iTextColor, d);
    cursor.x -= dims.x;
    d = glyph(cursor, 97, dims);
    col = mix(col, iTextColor, d);
    cursor.x -= dims.x;
    d = glyph(cursor, 121, dims);
    col = mix(col, iTextColor, d);
    cursor.x -= dims.x;
    cursor.x += 0.04;
    d = glyph(cursor, 115, dims);
    col = mix(col, iTextColor, d);
    cursor.x -= dims.x;
    cursor.x -= 0.2;
    d = glyph(cursor, 72, dims);
    col = mix(col, iTextColor, d);
    cursor.x -= dims.x;
    cursor.x += 0.04;
    d = glyph(cursor, 105, dims);
    col = mix(col, iTextColor, d);
    cursor.x -= dims.x;
    cursor.x -= 0.2;
    const vec3 textColor2 = vec3(0.8, 1., 0.5);
    cursor *= 0.5;
    d = glyph(cursor, 92, dims);
    col = mix(col, textColor2, d);
    cursor.x -= dims.x;
    d = glyph(cursor, 111, dims);
    col = mix(col, textColor2, d);
    cursor.x -= dims.x - 0.04;
    d = glyph(cursor, 47, dims);
    col = mix(col, textColor2, d);
    cursor.x -= dims.x;

}

void main() {
    //vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    vec3 colGradient = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
    fragColor = vec4(colGradient, 1.);

    qmSaysHi(uv, fragColor.rgb);
}

