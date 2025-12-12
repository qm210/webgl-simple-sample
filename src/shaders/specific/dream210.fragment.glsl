#version 300 es
precision mediump float;
out vec4 fragColor;
in vec2 uv;
in vec2 st;
in vec2 texSt;
in float aspRatio;
in mat2 uv2texSt;

// SHARED
uniform vec2 iResolution;
uniform vec4 iMouseDrag;
uniform float iTime;
uniform int iFrame;
uniform int passIndex;
uniform int debugOption;
uniform sampler2D texPrevious; // <-- evt. same wie texColor;
uniform sampler2D texNoiseBase;
// MAYBE NEED..?
uniform sampler2D texText0;
uniform sampler2D texText1;
uniform mediump sampler2DArray texTexts;
uniform sampler2D texMonaSchnoergel;
uniform sampler2D texMonaCity;
uniform sampler2D texMonaRainbow;
uniform sampler2D texMonaStars;
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
uniform float iCloudMorph;
// und für die extra noise base
uniform float iNoiseLevelA;
uniform float iNoiseLevelB;
uniform float iNoiseLevelC;
uniform float iNoiseScaleA;
uniform float iNoiseScaleB;
uniform float iNoiseScaleC;
uniform vec2 iOverallNoiseShift;
uniform float iOverallScale;
uniform float iOverallHashOffset;
uniform float iNoiseMorphingA;
uniform float iNoiseMorphingB;
uniform float iNoiseMorphingC;
uniform int iFractionalOctaves;
uniform float iFractionalScale;
uniform float iFractionalDecay;
uniform float iTurbulenceNormFactor;
uniform float iTurbulenceMeanOffset;
uniform vec2 iMarbleSqueeze;
uniform float iMarbleGranularity;
uniform float iMarbleGradingExponent;
uniform float iMarbleRange;
uniform float iColorStrength;
uniform vec3 iColorCosineFreq;
uniform vec3 iColorCosinePhase;

uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;
uniform float iFree5;

const vec4 c = vec4(1, 0, -1, 0.5);
const float pi = 3.141593;
const float twoPi = 2. * pi;
const float epsilon = 1.e-4;

const float BPM = 105.;
const float BEAT_SEC = 240. / BPM;

vec3 cmap_dream210(float t) {
    return vec3(0.19, 0.24, 0.40)
    +t*(vec3(3.42, -1.41, 4.13)
    +t*(vec3(-21.95, 22.09, -7.62)
    +t*(vec3(66.28, -51.41, -6.87)
    +t*(vec3(-80.01, 41.55, 23.40)
    +t*(vec3(33.21, -11.33, -11.18)
    +t*(vec3(-0.94, 0.52, -1.86)
    ))))));
}

vec3 colorPalette(float t) {
    // noch eine flexible zur cmap_dream210() dazu
    return vec3(0.5) + 0.5 * cos(iColorCosineFreq * t + iColorCosinePhase);
}

/////////////////////////

vec2 hash22(vec2 p)
{
    p = p*mat2(127.1,311.7,269.5,183.3);
    return -1.0 + 2.0 * fract(sin(p + .01 * iOverallHashOffset)*43758.5453123);
}

vec2 modulatedHash22(vec2 p, float phase) {
    return sin(twoPi * hash22(p) + phase);
}

float modulatedPerlin2D(vec2 p, float phase) {
    // Modifikation, um Phasenverschiebung in die Hashfunktion zu bekommen.
    // Das ist nicht äußerst performant, aber reicht hier, und zeigt eine Bandbreite
    // komplexer Effekte, die durch solche Pseudorandom-Noise-Überlagerungen kommen können.
    vec2 pi = floor(p);
    vec2 pf = p - pi;
    vec2 w = pf * pf * (3.-2.*pf);

    float f00 = dot(modulatedHash22(pi+vec2(.0,.0), phase),pf-vec2(.0,.0));
    float f01 = dot(modulatedHash22(pi+vec2(.0,1.), phase),pf-vec2(.0,1.));
    float f10 = dot(modulatedHash22(pi+vec2(1.0,0.), phase),pf-vec2(1.0,0.));
    float f11 = dot(modulatedHash22(pi+vec2(1.0,1.), phase),pf-vec2(1.0,1.));

    float xm1 = mix(f00,f10,w.x);
    float xm2 = mix(f01,f11,w.x);
    float ym = mix(xm1,xm2,w.y);
    return ym;
}

float noiseAbsoluteStackWithFurtherProcessing(vec2 p){
    // übersetzt aus https://www.shadertoy.com/view/Md3SzB
    // nur ein Beispiel für eine Anwendung nach weiteren Berechnungen
    p *= iNoiseScaleC;
    float s = modulatedPerlin2D(p, iNoiseMorphingC * iTime);
    s = sin(s * iMarbleGranularity + p.x * iMarbleSqueeze.x + p.y * iMarbleSqueeze.y);
    s = pow(0.5 + 0.5 * s, iMarbleGradingExponent);
    return 1. + iMarbleRange * (s - 1.24);
}

float noiseStack(vec2 p){
    float a = 1., s = 0., noise;
    float sum = 0.;
    for (int i=0; i < iFractionalOctaves; i++) {
        noise = modulatedPerlin2D(iNoiseScaleA * p, iNoiseMorphingA * iTime);
        sum += a * noise;

        s += a;
        p *= iFractionalScale;
        a *= iFractionalDecay;
    }
    // Skalierung empirisch
    return 0.5 + 0.5 * (sum / s * 1.5);
}

void noiseBase(in vec2 uv, inout vec3 col) {
    uv *= iOverallScale;
    uv += iOverallNoiseShift;
    float noiseClouds = noiseStack(uv) * iNoiseLevelA;
    float noiseMarble = noiseAbsoluteStackWithFurtherProcessing(uv) * iNoiseLevelC;
    float totalNoise = noiseClouds * noiseMarble;
    totalNoise = clamp(totalNoise, 0., 1.);
    col = mix(
        vec3(totalNoise),
        cmap_dream210(totalNoise * iColorStrength),
        iColorStrength
    );
}

// GLYPHS:

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

void printQmSaysHi(in vec2 uv, inout vec4 col) {
    vec2 dims;
    vec4 textColor = vec4(iTextColor, 1.);
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
    vec4 glow = glowInner * c.xxyx + glowOuter * textColor;
    glow *= iFree3;

    float gradient = fwidth(d);
    float mask = smoothstep(0., 0.33, gradient);
    glow *= mask * smoothstep(iFree5, iFree4, abs(d));
    glow.rgb = pow(glow.rgb, vec3(1. + iFree2));

    float shape = smoothstep(0.01, 0., d);
    col = mix(col, c.yyyx, 0.4 * shape);

    // understanding the "size / dims / step" out in its scaling: rect around the M
    float dRectMBorder = abs(dR) - 0.001;
    // float dRectMHard = smoothstep(0.01, 0., dRectM);
    // float dRectMSmooth = smoothstep(0.1, 0., dRectM);
    dR = smoothstep(0.001, 0., dR);
    // col = mix(col, c.yyy, dRectM);

    col += dR * glow;

    // <-- UP TO HERE: QM WITH GLOW

    cursor *= 1.25;
    cursor.x -= 0.1;
    d = glyph(cursor, 115, dims);
    col = mix(col, textColor, d);
    cursor.x -= dims.x;
    d = glyph(cursor, 97, dims);
    col = mix(col, textColor, d);
    cursor.x -= dims.x;
    d = glyph(cursor, 121, dims);
    col = mix(col, textColor, d);
    cursor.x -= dims.x;
    cursor.x += 0.04;
    d = glyph(cursor, 115, dims);
    col = mix(col, textColor, d);
    cursor.x -= dims.x;
    cursor.x -= 0.2;
    d = glyph(cursor, 72, dims);
    col = mix(col, textColor, d);
    cursor.x -= dims.x;
    cursor.x += 0.04;
    d = glyph(cursor, 105, dims);
    col = mix(col, textColor, d);
    cursor.x -= dims.x;
    cursor.x -= 0.2;
    /*
    const vec4 textColor2 = vec4(0.8, 1., 0.5, 1.);
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
    */
}

void printYay(in vec2 uv, inout vec4 col) {
    vec2 dims;
    float d = 100., dR = 100.;
    const vec4 textColor2 = vec4(0.8, 1., 0.5, 1.);
    vec2 cursor = uv - vec2(-1.22, 0.);
    cursor *= 0.15;
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

/////

float mask(vec2 st, vec4 limits) {
    return step(limits.s, st.x) * step(st.x, limits.p)
         * step(limits.t, st.y) * step(st.y, limits.q);
}

vec4 maskedTexture(sampler2D sampler, vec2 stTex, vec4 stLimits) {
    // fix y and then force transparency outside the [stLimits.st, stLimits.pq] range
    stTex.y = 1. - stTex.y;
    vec4 texColor = texture(sampler, stTex);
    texColor.a *= mask(stTex, stLimits);
    return texColor;
}

vec4 textureCenteredAt(sampler2D sampler, vec2 uv) {
    // puts the texture centered at (0,0),
    // transform as usual uv -> rot * (uv - shift) / scale
    vec2 texRes = vec2(textureSize(sampler, 0));
    vec2 aspScale = texRes.y / texRes;
    return maskedTexture(sampler, uv * aspScale + 0.5, c.yyxx);
}

vec4 textureToArea(sampler2D sampler, vec2 uv, vec4 rectBLTR) {
    vec2 stTex = (uv - rectBLTR.st) / (rectBLTR.pq - rectBLTR.st);
    return maskedTexture(sampler, stTex, c.yyxx);
}

vec4 textureToArea(sampler2D sampler, vec2 uv, vec4 uvLBRT, vec4 stLBRT) {
    // to map the part stLBRT in texture coordinates to rectangle uvLBRT on screen
    vec2 stTex = (uv - uvLBRT.st) / (uvLBRT.pq - uvLBRT.st);
    stTex = mix(stLBRT.st, stLBRT.pq, stTex);
    // <-- stTex = stTex * (stLBRT.pq - stLBRT.st) + stLBRT.st;
    return maskedTexture(sampler, stTex, stLBRT);
}

void finalComposition(in vec2 uv) {
    vec4 previous = texture(texPrevious, st);
    vec4 noiseBase = texture(texNoiseBase, st);

    vec4 tex = texture(texTexts, vec3(st, 1));
    fragColor.rgb = mix(fragColor.rgb, c.xyw, tex.a);

    vec3 col = fragColor.rgb;

    vec2 uvCenter = 0.15 * vec2(sin(3. * iTime), cos(3. * iTime));
    tex = textureCenteredAt(texMonaCity, (uv - uvCenter) * 0.5);
    float pos210 = floor(mod(2. * iTime, 3.)) * 0.333;
    vec4 tex2 = textureToArea(texMonaSchnoergel, uv, vec4(-.5, -.5, .5, .5), vec4(pos210, 0., pos210 + 0.333, 1.));
    tex.a *= 1. - tex2.a;
    fragColor.rgb = mix(fragColor.rgb, tex.rgb, tex.a);
    fragColor.rgb *= 1. - 0.3 * tex2.a;
    fragColor.rgb -= mix(c.yyy, col.brg, tex2.a);

    tex = texture(texTexts, vec3(st, 0));
    fragColor.rgb = mix(fragColor.rgb, tex.rgb, tex.a);

    // col = noiseBase.rgb;
    col = fragColor.rgb;
    col = pow(col, vec3(1. / iGamma));

    float vignetteShade = dot(st - 0.5, st - 0.5) * iVignetteScale;
    col *= smoothstep(iVignetteInner, iVignetteOuter, vignetteShade);

    fragColor.rgb = col;
    fragColor.a = 1.;
}

// Try Nomenclature:
// (I skipped the PASS_ but chose to keep the _)
// _INIT_ = Write new data from different inputs on a texture
// _PROCESS_ = connected quantities are transformed as a a whole,
//             maybe with the 2nd word === the target of that pass
// _CALC_ = A rather pure calculation from another texture, i.e.
//          where an INIT is from rather few data, and while PROCESS
//          is often a heavier thing, CALC is the straightaway stuff.
// _RENDER_ = Write some image data as a final step in its path
//          (no content transformation of similar fashion follows),
//          expected to be a bit more complex than _INIT_
// _POST_ = a PROCESS that works on RENDER results mostly for aesthetics,
//        or otherwise technologically distinct from the render method.
//
// Also, loose grouped, in sections of 10, but just for the fun of it.
#define _INIT_VELOCITY 0
#define _INIT_COLOR_DENSITY 1
#define _INIT_PRESSURE_PASS 2
#define _CALC_CURL_FROM_VELOCITY 3
#define _PROCESS_VELOCITY_BY_CURL 10
#define _CALC_DIVERGENCE_FROM_VELOCITY 11
#define _PROCESS_PRESSURE 12
#define _PROCESS_GRADIENT_SUBTRACTION 13
#define _PROCESS_ADVECTION 14
#define _PROCESS_COLOR_DENSITY 19
#define _POST_BLOOM_PREFILTER 20
#define _POST_BLOOM_BLUR 21
#define _POST_SUNRAYS_CALC_MASK 30
#define _POST_SUNRAYS_ACTUAL 31
#define _POST_SUNRAYS_BLUR 32
#define _RENDER_COLORS_PASS 40
#define _ACCUMULATE_CLOUDS 60
#define _RENDER_CLOUDS 61
#define _INIT_TEXT0 80
#define _INIT_TEXT1 81
#define _INIT_TEXT2 82
#define _INIT_TEXT3 83
#define _RENDER_NOISE_BASE 90
#define _RENDER_FINALLY_TO_SCREEN 100

void main() {
    switch (passIndex) {
        case _RENDER_NOISE_BASE:
            noiseBase(uv, fragColor.rgb);
            return;
        case _INIT_TEXT0:
            fragColor = c.yyyy;
            printQmSaysHi(uv, fragColor);
            return;
        case _INIT_TEXT1:
            fragColor = c.yyyy;
            printYay(uv, fragColor);
            return;
        case _RENDER_FINALLY_TO_SCREEN:
            // "Hello Shadertoy" for making it obvious you forgot something.
            fragColor.rgb = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
            finalComposition(uv);
            break;
    }
    fragColor.a = 1.;
}

