#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform float iGamma;
uniform vec3 palA;
uniform vec3 palB;
uniform vec3 palC;
uniform vec3 palD;
uniform float iWhatever;

vec4 c = vec4(1., 0., -1., .5);
const float pi = 3.141592;
const float twoPi = 2. * pi;
const float eps = 1.e-7;

vec3 hsl2rgb(in vec3 col) {
    vec3 rgb = clamp( abs(mod(col.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return col.z + col.y * (rgb-0.5)*(1.0-abs(2.0*col.z-1.0));
}

vec3 hueShift(in vec3 col, in float shift) {
    vec3 P = vec3(0.55735)*dot(vec3(0.55735),col);
    vec3 U = col-P;
    vec3 V = cross(vec3(0.55735),U);
    col = U*cos(shift*6.2832) + V*sin(shift*6.2832) + P;
    return vec3(col);
}

vec3 rgb2hsl(in vec3 col) {
    float minc = min( col.r, min(col.g, col.b) );
    float maxc = max( col.r, max(col.g, col.b) );
    vec3  mask = step(col.grr,col.rgb) * step(col.bbg,col.rgb);
    vec3 h = mask * (vec3(0.0,2.0,4.0) + (col.gbr-col.brg)/(maxc-minc + eps)) / 6.0;
    return vec3(fract( 1.0 + h.x + h.y + h.z ),              // H
    (maxc-minc)/(1.0-abs(minc+maxc-1.0) + eps),  // S
    (minc+maxc)*0.5 );                           // L
}

vec3 rgb2hsv(vec3 c) {
    vec4 k = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.zy, k.wz), vec4(c.yz, k.xy), (c.z<c.y) ? 1.0 : 0.0);
    vec4 q = mix(vec4(p.xyw, c.x), vec4(c.x, p.yzx), (p.x<c.x) ? 1.0 : 0.0);
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0*d+eps)), d / (q.x+eps), q.x);
}

vec3 hsv2rgb(vec3 c) {
    c.x *= 6.0;
    vec3 rgb = clamp( vec3(-1.0+abs(c.x-3.0),
    2.0-abs(c.x-2.0),
    2.0-abs(c.x-4.0)), 0.0, 1.0 );
    return c.z * mix( vec3(1.0), rgb, c.y);
}

const mat3 Msrgb = mat3(
    0.4124564, 0.2126729, 0.0193339,
    0.3575761, 0.7151522, 0.1191920,
    0.1804375, 0.0721750, 0.9503041
), M1 = mat3(
    0.8189330101, 0.0329845436, 0.0482003018,
    0.3618667424, 0.9293118715, 0.2643662691,
    -0.1288597137, 0.0361456387, 0.6338517070
), M2 = mat3(
    0.2104542553, 1.9779984951, 0.0259040371,
    0.7936177850, -2.4285922050, 0.7827717662,
    -0.0040720468, 0.4505937099, -0.8086757660
);

// Convert rgb to xyz (sRGB) - compare http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
vec3 rgb2xyz_srgb(vec3 rgb) {
    return Msrgb * rgb;
}

// Convert xyz to rgb (sRGB) - compare http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
vec3 xyz2rgb_srgb(vec3 xyz) {
    return inverse(Msrgb) * xyz;
}

// Convert xyz to oklab - compare https://bottosson.github.io/posts/oklab/
vec3 xyz2oklab(vec3 xyz) {
    return M2 * pow(M1 * xyz, c.xxx/3.);
}

// Convert oklab to xyz - compare https://bottosson.github.io/posts/oklab/
vec3 oklab2xyz(vec3 lab) {
    return inverse(M1) * pow(inverse(M2) * lab, 3.*c.xxx);
}

// Convert oklab to oklch - compare https://bottosson.github.io/posts/oklab/
vec3 oklab2oklch(vec3 lab) {
    return vec3(lab.x, length(lab.yz), atan(lab.z, lab.y));
}

// Convert oklch to oklab - compare https://bottosson.github.io/posts/oklab/
vec3 oklch2oklab(vec3 lch) {
    return vec3(lch.x, lch.y * vec2(cos(lch.z), sin(lch.z)));
}

// Abkürzungen
vec3 rgb2oklab(vec3 rgb) {
    return xyz2oklab(rgb2xyz_srgb(rgb));
}
vec3 oklab2rgb(vec3 oklab) {
    return xyz2rgb_srgb(oklab2xyz(oklab));
}

vec3 rgb2oklch(vec3 rgb) {
    return oklab2oklch(xyz2oklab(rgb2xyz_srgb(rgb)));
}
vec3 oklch2rgb(vec3 lch) {
    return xyz2rgb_srgb(oklab2xyz(oklch2oklab(lch)));
}

float sdCircle( in vec2 p, in float r )
{
    return length(p)-r;
}

vec3 cosPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d){
    // cf. https://iquilezles.org/articles/palettes/
    //     https://dev.thi.ng/gradients/
    //
    return a + b * cos(twoPi*(c * t + d));
}

vec3 uniformPalette(float t) {
    vec3 color = cosPalette(t, palA, palB, palC, palD);
    return clamp(color, 0., 1.);
}

float polar(vec2 v) {
    float angle = atan(v.y, v.x);
    if (angle < 0.) {
        angle += twoPi;
    }
    return angle;
}

void applyGrid(inout vec3 col, in vec2 uv) {
    const float gridSize = 0.5;
    uv = mod(uv, gridSize);
    float dMin = min(uv.x, uv.y);
    float dMax = max(uv.x, uv.y);
    float thick = 0.01;
    float frame = step(thick, dMin) * step(dMax, gridSize - thick);
    // note: in 1D this is the same, but in 2D these differ:
    // frame = step(thick, dMin) - step(gridStep - thick, dMax);
    col *= 0.5 + 0.5 * frame;
}

void background(out vec3 col, vec2 uv) {
    col = c.yyy;
    col = uniformPalette(uv.x + 1.);

    applyGrid(col, uv);

    // Ursprung markieren
    float d = sdCircle(uv, 0.02);
    d = abs(d) - 0.005;
    col = mix(c.yyy, col, smoothstep(0., 0.001, d));
}

void gammaCorrection(inout vec3 col) {
    col = pow(col, vec3(1./iGamma));
}

void drawRing(inout vec3 col, in vec3 colRing, vec2 uv) {
    float d = sdCircle(uv, 0.5);
    d = abs(d) - 0.2;
    col = mix(col, colRing, smoothstep(0.01, 0., d));
}

void drawPaletteRing(inout vec3 col, vec2 uv, float theta) {
    vec3 colRing = uniformPalette(theta);
    drawRing(col, colRing, uv);
}

#define CASE_STUDY_HSV_HSL 0
#define CASE_STUDY_HSV_OKLCH 0
#define DEMONSTRATE_COSINE_PALETTE 1
#define RAINBOW_RING 1

void drawColors(inout vec3 col, vec2 uv, bool right) {
    // (*) was ist das hier anschaulich, welche Werte nimmt es an?
    float theta = polar(uv) / twoPi;
    float r = length(uv);

    // just for seeing the "third dimension"
    float wave = 0.5 - 0.5 * cos(twoPi * 0.1 * iTime);
    vec3 colHSV = vec3(theta, r, wave);
    vec3 colHSL;
    col = hsv2rgb(colHSV);

    #if CASE_STUDY_HSV_HSL
        colHSL = vec3(theta, r, wave);
        if (right) {
            col = hsl2rgb(colHSL);
        }
        return;
    #endif

    #if CASE_STUDY_HSV_OKLCH
        if (right) {
            vec3 colOKLCH = vec3(wave, r, theta);
            col = oklch2rgb(colOKLCH);
        }
        return;
    #endif

    #if DEMONSTRATE_COSINE_PALETTE
        drawPaletteRing(col, uv, theta);
        if (right) {
            gammaCorrection(col);
        }
        return;
    #endif

    // Fallback: "Rainbow Ring"
    #if RAINBOW_RING
        col = c.xxx;
        applyGrid(col, uv);
        vec3 colRing = right
            ? oklch2rgb(vec3(wave, .3, twoPi * theta))
            : hsv2rgb(vec3(theta, 1., wave));
        drawRing(col, colRing, uv);
    #endif
}

void main() {
    vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    float aspRatio = iResolution.x / iResolution.y;

    vec3 col;

    if (uv.x < -0.005) {
        uv.x += 0.5 * aspRatio;
        background(col, uv);
        drawColors(col, uv, false);
    }
    else if (uv.x > 0.005) {
        uv.x -= 0.5 * aspRatio;
        background(col, uv);
        drawColors(col, uv, true);
    }
    else {
        discard;
    }

    fragColor = vec4(col, 1);
}
