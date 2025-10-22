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
const float eps = 1.e-7;

vec3 hsl2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

vec3 HueShift (in vec3 Color, in float Shift)
{
    vec3 P = vec3(0.55735)*dot(vec3(0.55735),Color);

    vec3 U = Color-P;

    vec3 V = cross(vec3(0.55735),U);

    Color = U*cos(Shift*6.2832) + V*sin(Shift*6.2832) + P;

    return vec3(Color);
}

vec3 rgb2hsl( in vec3 col ){
    float minc = min( col.r, min(col.g, col.b) );
    float maxc = max( col.r, max(col.g, col.b) );
    vec3  mask = step(col.grr,col.rgb) * step(col.bbg,col.rgb);
    vec3 h = mask * (vec3(0.0,2.0,4.0) + (col.gbr-col.brg)/(maxc-minc + eps)) / 6.0;
    return vec3(fract( 1.0 + h.x + h.y + h.z ),              // H
                (maxc-minc)/(1.0-abs(minc+maxc-1.0) + eps),  // S
                (minc+maxc)*0.5 );                           // L
}

vec3 rgb2hsv(vec3 c)
{
    vec4 k = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.zy, k.wz), vec4(c.yz, k.xy), (c.z<c.y) ? 1.0 : 0.0);
    vec4 q = mix(vec4(p.xyw, c.x), vec4(c.x, p.yzx), (p.x<c.x) ? 1.0 : 0.0);
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0*d+eps)), d / (q.x+eps), q.x);
}

vec3 hsv2rgb(vec3 c)
{
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

#define FROM_RGB(x) x
#define TO_RGB(x) x

//#define FROM_RGB rgb2hsv
//#define TO_RGB hsv2rgb

//#define FROM_RGB rgb2hsl
//#define TO_RGB hsl2rgb

//#define FROM_RGB rgb2oklab
//#define TO_RGB oklab2rgb

//#define FROM_RGB rgb2oklch
//#define TO_RGB oklch2rgb


float sdCircle( in vec2 p, in float r )
{
    return length(p)-r;
}

void applyGrid(inout vec3 col, in vec2 uv) {
    const float gridStep = 0.5;
    uv = mod(uv, gridStep);
    float dMin = min(uv.x, uv.y);
    // war in Vorlesung: fract(...) == mod(..., 1.)
    // float d = min(mod(uv.x, gridStep), fract(uv.y));
    col *= 1. - 0.5 * (step(dMin, 0.005)); // <- in lesson: step(d,0) - step(d,.01)
}

void main() {
    vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    // background
    vec3 bgCol = vec3(0.5 * abs(uv.x), 0.6 ,0.5 + uv.y);
    vec3 col = bgCol * iWhatever;

    applyGrid(col, uv);

    float d = sdCircle(uv, 0.02);
    col = mix(c.yyy, col, smoothstep(0., 0.01, d));

    fragColor = vec4(col, 1.0);
    return;

    // rings
    d = sdCircle(uv - vec2(0., 0.), 0.3);
    d = 0.5 - 0.5*cos(20.*d);
    vec3 ringCol = d * (0.5 + 0.5*cos(iTime+uv.xyx+vec3(0, 2, 4)));

    // einfachste blending-methoden - aber bei RGB wird das halt Matsch
    float blendingFactor = 0.5;
    col = mix(bgCol, ringCol, blendingFactor);
    // col = max(bgCol, ringCol);
    // col = min(bgCol, ringCol);
    // col = bgCol * ringCol;

    // brighter / darker
    // col = 0.5 + 0.5 * col;
    // col = 0.5 * col;

    // contrast
    const float contrast = 2.;
    col = (col - 0.5) * contrast + 0.5;

    // gamma correction
    const float gamma = 1./2.2;
    col = pow(col, vec3(gamma));

    // grayscale
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    // col = vec3(gray);

    // Output to screen
    fragColor = vec4(col, 1.0);
}
