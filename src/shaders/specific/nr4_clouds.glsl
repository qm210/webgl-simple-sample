#version 300 es

precision highp float;
out vec4 outColor;

uniform float iTime;
uniform vec2 iResolution;
uniform int iFrame;
uniform vec4 iMouseDrag;
uniform float iMouseWheel;
uniform int passIndex;
uniform int debugOption;
uniform sampler2D prevImage;

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

uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;

const vec3 c = vec3(1,0,-1);
const float pi = 3.14159;

bool accumulate;
bool useFbmB;
bool useModdedFbm;

// Created by David Hoskins and licensed under MIT.
// See https://www.shadertoy.com/view/4djSRW.

// vec3->vec3 hash function
vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}

// vec2->float hash function
float hash12(vec2 p)
{
    vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// float->float hash function
float hash11(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

// float->vec3 hash function
vec3 hash31(float p)
{
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
}

// End of David Hoskin's MIT licensed code.

// Copyright © 2013 Nikita Miropolskiy and licensed under MIT.
// Available at https://www.shadertoy.com/view/XsX3zB.
// Modified by NR4 for size-coding.

/* skew constants for 3d simplex functions */
const float F3 =  0.3333333;
const float G3 =  0.1666667;

/* 3d simplex noise */
float lfnoise3(vec3 p) {
    /* 1. find current tetrahedron T and it's four vertices */
    /* s, s+i1, s+i2, s+1.0 - absolute skewed (integer) coordinates of T vertices */
    /* x, x1, x2, x3 - unskewed coordinates of p relative to each of T vertices*/

    /* calculate s and x */
    vec3 s = floor(p + dot(p, vec3(F3)));
    vec3 x = p - s + dot(s, vec3(G3));

    /* calculate i1 and i2 */
    vec3 e = step(vec3(0), x - x.yzx);
    vec3 i1 = e*(1.0 - e.zxy);
    vec3 i2 = 1.0 - e.zxy * (1. - e);

    /* x1, x2, x3 */
    vec3 x1 = x - i1 + G3;
    vec3 x2 = x - i2 + 2. * G3;
    vec3 x3 = x - 1. + 3. * G3;

    /* 2. find four surflets and store them in d */
    vec4 w, d;

    /* calculate surflet weights */
    w.x = dot(x, x);
    w.y = dot(x1, x1);
    w.z = dot(x2, x2);
    w.w = dot(x3, x3);

    /* w fades from 0.6 at the center of the surflet to 0.0 at the margin */
    w = max(0.6 - w, 0.);

    /* calculate surflet components */
    d.x = dot(hash33(s) - .5, x);
    d.y = dot(hash33(s + i1) - .5, x1);
    d.z = dot(hash33(s + i2) - .5, x2);
    d.w = dot(hash33(s + 1.) - .5, x3);

    /* multiply d by w^4 */
    w *= w;
    w *= w;
    d *= w;

    /* 3. return the sum of the four surflets */
    return dot(d, vec4(52.));
}

// End of Nikita Miropolskiy's MIT licensed code.

// Copyright © 2013 Nikita Miropolskiy and licensed under MIT.
// Available at https://www.shadertoy.com/view/XsX3zB.
// Modified by NR4 for size-coding.

/* const matrices for 3d rotation */
const mat3 rot1 = mat3(-0.37, 0.36, 0.85,-0.14,-0.93, 0.34,0.92, 0.01,0.4);
const mat3 rot2 = mat3(-0.55,-0.39, 0.74, 0.33,-0.91,-0.24,0.77, 0.12,0.63);
const mat3 rot3 = mat3(-0.71, 0.52,-0.47,-0.08,-0.72,-0.68,-0.7,-0.45,0.56);

/* directional artifacts can be reduced by rotating each octave */
float mfnoise3(vec3 m) {
    return   0.5333333 * lfnoise3(m * rot1)
    + 0.2666667 * lfnoise3(2. * m * rot2)
    + 0.1333333 * lfnoise3(4. * m * rot3)
    + 0.0666667 * lfnoise3(8. * m);
}

// End of Nikita Miropolskiy's MIT licensed code.

float xt95noise(vec3 m);
float xt95mfnoise3(vec3 m) {
    // scaled to produce a range like mfnoise3
    return (
        0.5333333 * xt95noise(m * rot1)
        + 0.2666667 * xt95noise(2. * m * rot2)
        + 0.1333333 * xt95noise(4. * m * rot3)
        + 0.0666667 * xt95noise(8. * m)
    ) * 1.62 - 0.005;
}

// Paint with antialiasing
float sm(in float d)
{
    return smoothstep(1.5/iResolution.y, -1.5/iResolution.y, d);
}

// method by fizzer
vec3 hashHs(vec3 n, float seed)
{
    float u = hash11( 78.233 + seed);
    float v = hash11( 10.873 + seed);
    float a = 6.2831853 * v;
    u = 2.0*u - 1.0;
    return normalize( n + vec3(sqrt(1.0-u*u) * vec2(cos(a), sin(a)), u) );
}

// Copyright (C) gltracy https://www.shadertoy.com/view/lsXSz7.
// Licensed under CC-BY-SA-NC 4.0 Unported
// and modified by NR4 with a more realistic microfacet approximation

vec3 radiance(
vec3 n, // macro surface normal
vec3 l, // direction from vertex to light
vec3 v, // direction from vertex to view
float m, // roughness
vec3 cdiff, // diffuse color
vec3 cspec, // specular color
vec3 clight // light color
) {
    // half vector
    vec3 h = normalize(l + v);

    // dot
    float dot_n_h = max(dot(n, h), .001);
    float dot_n_v = max(dot(n, v), .001);
    float dot_n_l = max(dot(n, l), .001);
    float dot_h_v = max(dot(h, v), .001); // dot_h_v == dot_h_l

    // Geometric Term
    // Cook-Torrance
    //          2 * ( N dot H )( N dot L )    2 * ( N dot H )( N dot V )
    // min( 1, ----------------------------, ---------------------------- )
    //                 ( H dot V )                   ( H dot V )
    float g = 2. * dot_n_h / dot_h_v;
    float G = min(min(dot_n_v, dot_n_l) * g, 1.);

    // Normal Distribution Function ( cancel 1 / pi )
    // Beckmann distribution
    //         ( N dot H )^2 - 1
    //  exp( ----------------------- )
    //         ( N dot H )^2 * m^2
    // --------------------------------
    //         ( N dot H )^4 * m^2
    float sq_nh = dot_n_h * dot_n_h;
    float sq_nh_m = sq_nh * (m * m);
    float D = exp((sq_nh - 1.) / sq_nh_m) / (sq_nh * sq_nh_m);

    // Specular Fresnel Term : Schlick approximation
    // F0 + ( 1 - F0 ) * ( 1 - ( H dot V ) )^5
    vec3 Fspec = cspec + (1. - cspec) * pow(1. - dot_n_v, 5.);

    // Diffuse Fresnel Term : violates reciprocity...
    // F0 + ( 1 - F0 ) * ( 1 - ( N dot L ) )^5
    vec3 Fdiff = cspec + (1. - cspec) * pow(1. - dot_n_l, 5.);

    // Cook-Torrance BRDF
    //          D * F * G
    // ---------------------------
    //  4 * ( N dot V )( N dot L )
    vec3 brdf_spec = Fspec * D * G / (dot_n_v * dot_n_l * 4.);

    // Lambertian BRDF ( cancel 1 / pi )
    vec3 brdf_diff = cdiff * (1. - Fdiff);

    // Microfacet BRDF
    // https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf
    float msq = m * m;
    float mqu = msq * msq;
    float d = (dot_n_h * mqu - dot_n_h) * dot_n_h + 1.;
    float brdf_ggx = mqu / (pi * d * d);

    // Punctual Light Source ( cancel pi )
    return (brdf_spec + brdf_diff + brdf_ggx) * clight * dot_n_l;
}

// End of gltracy's CC-BY-SA-NC 4.0 Unported code.

/*
const int CLOUD_SCENE_MODE_DENSITY_COLOR = 0;

vec4 cloudScene(vec3 x, int mode) {
    float d = mfnoise3(x);
    if(mode == CLOUD_SCENE_MODE_DENSITY_COLOR) {
        return vec4(d, vec3(.5));
    }
}

const float CLOUD_MARCHER_NORMAL_PRECISION = 5.e-4;
vec3 cloudNormal(vec3 x, vec4 s) {
    return normalize(vec3(
        cloudScene(x + CLOUD_MARCHER_NORMAL_PRECISION * c.xyy, CLOUD_SCENE_MODE_DENSITY_COLOR).x,
        cloudScene(x + CLOUD_MARCHER_NORMAL_PRECISION * c.yxy, CLOUD_SCENE_MODE_DENSITY_COLOR).x,
        cloudScene(x + CLOUD_MARCHER_NORMAL_PRECISION * c.yyx, CLOUD_SCENE_MODE_DENSITY_COLOR).x
    ) - s.x);
}

const float CLOUD_MARCHER_STEP_SIZE = 1.e-2;

vec3 marchClouds(vec2 uv) {
    vec3 light = 4.*c.zzz;
    vec3 o = vec3(uv, 1.);
    vec3 dir = normalize(vec3(uv, -1));
    float t = 0.;
    vec4 res = c.yyyy;
    for(int i=0; i<iLayerCount; ++i) {
        vec3 x = o + t * dir;

        vec4 s = cloudScene(x, CLOUD_SCENE_MODE_DENSITY_COLOR);
        float density = s.x;
        vec3 color = s.yzw;
        float totalTransmittance = 1.0;
        float lightEnergy = 0.0;
        if(density > 0.) {
            vec4 color = vec4(vec3(density), density);
            vec3 n = cloudNormal(x, s);
            vec3 cr = color.gba;
            vec3 lx = normalize(light-x);
            vec3 rads = .04 * radiance(n, lx, normalize(o - x), .9, cr.xyz, cr.xyz, cr.xyz);
            // Lambert/beer

            res += vec4(max(rads, 0.), 0.);
        }

        t += CLOUD_MARCHER_STEP_SIZE;
    }

    return res.xyz;
}
*/

float sdSphere(vec3 p, float radius) {
    return length(p) - radius;
}

float BeersLaw (float dist, float absorption) {
    return exp(-dist * absorption);
}

float noise( in vec3 x ) {
    // try for comparison (but this looses granularity) just
    // return lfnoise3(x);
    return mfnoise3(x);
}

float hash( float n )
{
    return fract(sin(n)*43758.5453);
}

float xt95noise( in vec3 x )
{
    // match spatial scale of noise(), this seems like a factor of 2.6 .. 3.0:
    x *= iNoiseScaleB;

    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n = p.x + p.y*57.0 + 113.0*p.z;

    float res = mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
    mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
    mix(mix( hash(n+113.0), hash(n+114.0),f.x),
    mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);

    // also, match value range of output (I measured these values)
    return 1.24 * res - 0.673;
}

mat3 m = mat3(
    0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
);

float fbmB( vec3 p, int maxOctave)
{
    // fbmB() original: just use xt95noise
    // fbmB() modded: use noise() for the base octave // <--
    // fbmB() modded: use xt95mfnoise3() for the base octave //
    float a = 0.5;
    float b = 2.02;
    float f = useModdedFbm ? xt95mfnoise3(p) : a * xt95noise(p);
    for (int i = 0; i < maxOctave - 1; i++) {
        p = m*p;
        p *= b;
        b += (i == 1 ? -0.02 : 0.01);
        a *= 0.5;
        f += a*xt95noise( p );
    }
    return 0.78 * f + 0.02;
}

float fbmA(vec3 q, int maxOctave) {
    // fbmA() original: NR4's fbm with just noise()
    // fbmB() modded: use xt95mfnoise3() = mfnoise3 with xt95noise() instead

    float f = 0.0;
    float scale = 0.5;
    float factor = 2.02;

    for (int i = 0; i < maxOctave; i++) {
        f += scale * (useModdedFbm ? xt95mfnoise3(q) : noise(q));
        q *= factor;
        factor += 0.21;
        scale *= 0.5;
    }

    return f;
}

float fbm(vec3 p, bool forLight) {
    p += 1.e4*hash31(iCloudSeed);// + iTime * 0.5 * vec3(1.0, -0.2, -1.0);
    p *= iNoiseScale;
    int maxOctave = forLight ? iLightNoiseCount : iCloudNoiseCount;
    return useFbmB ? fbmB(p, maxOctave) : fbmA(p, maxOctave);
}

float scene(vec3 p, bool forLight) {
    float y = p.y - 0.01 * iCloudYDisplacement + (0.08 * sin(iTime));
    p.x += 0.1 * iTime;
    p.y += 0.02 * iTime;
    float f = fbm(p, forLight);
    return f - y;
}

float lightmarch(vec3 position, vec3 rayDirection) {
    vec3 lightDirection = normalize(vecSunPosition);
    float totalDensity = 0.0;
    // float marchSize = 0.03;
    float marchSize = 0.01 * iLightLayerDistance;

    for (int step = 0; step < iLightLayerCount; step++) {
        position += lightDirection * marchSize * float(step);

        float lightSample = scene(position, true);
        totalDensity += lightSample;
    }

    float transmittance = BeersLaw(totalDensity, iCloudAbsorptionCoeff);
    return transmittance;
}

float HenyeyGreenstein(float g, float mu) {
    float gg = g * g;
    return (1.0 / (4.0 * pi))  * ((1.0 - gg) / pow(1.0 + gg - 2.0 * g * mu, 1.5));
}

float MARCH_SIZE;
float raymarch(vec3 rayOrigin, vec3 rayDirection, float offset) {
    float depth = 0.0;
    depth += MARCH_SIZE * offset;
    vec3 p = rayOrigin + depth * rayDirection;
    vec3 sunDirection = normalize(vecSunPosition);

    float totalTransmittance = 1.0;
    float lightEnergy = 0.0;

    float phase = HenyeyGreenstein(iCloudAnisoScattering, dot(rayDirection, sunDirection));

    for (int i = 0; i < iCloudLayerCount; i++) {
        float density = scene(p, false);

        // We only draw the density if it's greater than 0
        if (density > 0.0) {
            float lightTransmittance = lightmarch(p, rayDirection);
            float luminance = .055 + density * phase;

            totalTransmittance *= lightTransmittance;
            lightEnergy += totalTransmittance * luminance;
        }

        depth += MARCH_SIZE;
        p = rayOrigin + depth * rayDirection;
    }

    return lightEnergy;
}

uint part1by1 (uint x) {
    x = (x & 0x0000ffffu);
    x = ((x ^ (x << 8u)) & 0x00ff00ffu);
    x = ((x ^ (x << 4u)) & 0x0f0f0f0fu);
    x = ((x ^ (x << 2u)) & 0x33333333u);
    x = ((x ^ (x << 1u)) & 0x55555555u);
    return x;
}

uint compact1by1 (uint x) {
    x = (x & 0x55555555u);
    x = ((x ^ (x >> 1u)) & 0x33333333u);
    x = ((x ^ (x >> 2u)) & 0x0f0f0f0fu);
    x = ((x ^ (x >> 4u)) & 0x00ff00ffu);
    x = ((x ^ (x >> 8u)) & 0x0000ffffu);
    return x;
}

uint pack_morton2x16(uvec2 v) {
    return part1by1(v.x) | (part1by1(v.y) << 1);
}

uvec2 unpack_morton2x16(uint p) {
    return uvec2(compact1by1(p), compact1by1(p >> 1));
}

uint inverse_gray32(uint n) {
    n = n ^ (n >> 1);
    n = n ^ (n >> 2);
    n = n ^ (n >> 4);
    n = n ^ (n >> 8);
    n = n ^ (n >> 16);
    return n;
}

// https://www.shadertoy.com/view/llGcDm
int hilbert( ivec2 p, int level )
{
    int d = 0;
    for( int k=0; k<level; k++ )
    {
        int n = level-k-1;
        ivec2 r = (p>>n)&1;
        d += ((3*r.x)^r.y) << (2*n);
        if (r.y == 0) { if (r.x == 1) { p = (1<<n)-1-p; } p = p.yx; }
    }
    return d;
}

// https://www.shadertoy.com/view/llGcDm
ivec2 ihilbert( int i, int level )
{
    ivec2 p = ivec2(0,0);
    for( int k=0; k<level; k++ )
    {
        ivec2 r = ivec2( i>>1, i^(i>>1) ) & 1;
        if (r.y==0) { if(r.x==1) { p = (1<<k) - 1 - p; } p = p.yx; }
        p += r<<k;
        i >>= 2;
    }
    return p;
}

// knuth's multiplicative hash function (fixed point R1)
uint kmhf(uint x) {
    return 0x80000000u + 2654435789u * x;
}

uint kmhf_inv(uint x) {
    return (x - 0x80000000u) * 827988741u;
}

// mapping each pixel to a hilbert curve index, then taking a value from the Roberts R1 quasirandom sequence for it
uint hilbert_r1_blue_noise(uvec2 p) {
    #if 1
    uint x = uint(hilbert( ivec2(p), 17 )) % (1u << 17u);
    #else
    //p = p ^ (p >> 1);
    uint x = pack_morton2x16( p ) % (1u << 17u);
    //x = x ^ (x >> 1);
    x = inverse_gray32(x);
    #endif
    x = kmhf(x);
    return x;

    // based on http://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/
    /*
    const float phi = 2.0/(sqrt(5.0)+1.0);
    return fract(0.5+phi*float(x));
    */
}

// mapping each pixel to a hilbert curve index, then taking a value from the Roberts R1 quasirandom sequence for it
float hilbert_r1_blue_noisef(uvec2 p) {
    uint x = hilbert_r1_blue_noise(p);
    #if 0
    return float(x >> 24) / 256.0;
    #else
    return float(x) / 4294967296.0;
    #endif
}

// inverse
uvec2 hilbert_r1_blue_noise_inv(uint x) {
    x = kmhf_inv(x);
    return uvec2(ihilbert(int(x), 17));
}

vec3 cmap_pastel(float t) {
    return vec3(0.92, 0.82, 0.68)
    +t*(vec3(2.25, 0.95, -0.50)
    +t*(vec3(-24.81, -10.77, -16.68)
    +t*(vec3(123.32, 35.33, 88.11)
    +t*(vec3(-289.81, -73.14, -176.72)
    +t*(vec3(301.16, 79.71, 159.25)
    +t*(vec3(-112.18, -32.13, -53.50)
    ))))));
}

const mat3 rgb2yiq = mat3(
    0.299,  0.5959,  0.2215,
    0.587, -0.2746, -0.5227,
    0.114, -0.3213,  0.3112
);

vec3 rgbToYCh(vec3 rgb) {
    vec3 yiq = rgb2yiq * rgb;
    float C = length(yiq.yz);
    float h = atan(yiq.z, yiq.y);
    return vec3(yiq.x, C, h);
}
vec3 ychToRgb(float Y, float C, float h) {
    float I = C * cos(h);
    float Q = C * sin(h);
    float R = Y + 0.9469 * I + 0.6236 * Q;
    float G = Y - 0.2748 * I - 0.6357 * Q;
    float B = Y - 1.1000 * I + 1.7000 * Q;
    return clamp(vec3(R, G, B), 0.0, 1.0);
}

void cloudImage(out vec4 color, vec2 fragCoord, int sampleIndex) {

    vec2 uv = fragCoord.xy/iResolution.xy;
    uv -= 0.5;
    uv.x *= iResolution.x / iResolution.y;

    // Ray Origin - camera
    vec3 ro = vec3(0.0, 0.0, 5.0);
    // Ray Direction
    vec3 rd = normalize(vec3(uv, -1.0));



    // Sun and Sky
//    vec3 sunColor = vec3(1.0,0.5,0.3);
     vec3 sunColor = ychToRgb(vecSunColorYCH.x, vecSunColorYCH.y, vecSunColorYCH.z);
    vec3 sunDirection = normalize(vecSunPosition);
    float sun = clamp(dot(sunDirection, rd), 0.0, 1.0);
    /*
    // Base sky color
    color.rgb = vec3(0.7,0.7,0.90);
    // Add vertical gradient
    color.rgb -= 0.8 * vec3(0.90,0.75,0.90) * rd.y;
    */
    color.rgb = cmap_pastel(fract(1. - .9 * pow(uv.y + .5, iSkyQuetschung)));
    // Add sun color to sky
    color.rgb += 0.5 * sunColor * pow(sun, iSunExponent);

    float blueNoise = hilbert_r1_blue_noisef(uvec2(fragCoord.xy));//texture2D(uBlueNoise, fragCoord.xy / 1024.0).r;
    float offset = fract(blueNoise + float(sampleIndex%32) / sqrt(0.5));
    //float offset = fract(hash12(fragCoord) + float(sampleIndex%32) / sqrt(0.5));
    //  float offset =  fract(hash12(fragCoord) + float(sampleIndex%32) / sqrt(0.5));;
//    float offset = 0.;
//     Cloud
    float res = raymarch(ro, rd, offset);
    color.rgb = color.rgb + sunColor * res;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Vogel-ordered Gauss DOF.
    vec2 uv = (fragCoord - .5 * iResolution.xy) / iResolution.y;
    vec4 col = c.yyyy;
    const float gold = 2.4;
    float sampleCount = float(iSampleCount);
    for(float i = .75; i < sampleCount; i += 1.) {
        float x = i / sampleCount;
        float p = gold * i;
        vec2 z =
            // Pixel size.
            .5 / iResolution.y
            // Vogel order.
            * sqrt(x) * vec2(cos(p), sin(p))
            // Adjust width for DOF effect.
            * 1.
            ;
        vec4 c1;
        x *= pi * pi;
        vec2 newFragCoord = (uv - z) * iResolution.y + .5 * iResolution.xy;
        //pixel_3d(c1, newFragCoord);
        int sampleIndex = int(i);
        if (accumulate) {
            sampleIndex += iFrame;
        }
        cloudImage(c1, newFragCoord, sampleIndex);
        col +=
            // Remap to texture coordinates.
            c1;
    }
    fragColor = col / sampleCount;
    /*
    // Grain.
    vec2 uvn = fragCoord.xy/iResolution.xy;
    fragColor += .01*iGrain * (2. * hash12(1.e4 * uvn) - 1.);

    // Vignette.
    uvn *=  1. - uvn.yx;
    fragColor *= pow(uvn.x*uvn.y * 15., iVignette);
    fragColor = clamp(fragColor, 0., 1.);*/
}

void main() {
    vec2 uv = (gl_FragCoord.xy - .5 * iResolution.xy) / iResolution.y;
    accumulate = (debugOption & 1) != 0;
    useFbmB = (debugOption & 2) != 0;
    useModdedFbm = (debugOption & 4) != 0;
    bool debugRead = (debugOption & 8) != 0;

    if (debugRead) {
        vec3 ray = normalize(vec3(uv, -1));
        outColor.r = fbmA(ray, 6);
        outColor.g = fbmB(ray, 6);
        outColor.b = mfnoise3(ray);
        outColor.a = xt95mfnoise3(ray);
        return;
    }

    vec4 color = vec4(0.0);

    MARCH_SIZE = .01 * iCloudLayerDistance;

    mainImage(color, gl_FragCoord.xy);

    vec4 prevColor = texture(prevImage, gl_FragCoord.xy/iResolution.xy);

    if (passIndex == 0) {
        outColor = vec4(color.rgb, 1.0);

        if (accumulate && iFrame > 0) {
            if (iAccumulateMix < 0.) {
                outColor += prevColor;
            } else {
                outColor = mix(outColor, prevColor, iAccumulateMix);
            }
        }
    }
    if (passIndex == 1) {
        vec3 col = prevColor.rgb / prevColor.a;
        // ACES filmic curve
//        const float a = 2.51;
//        const float b = 0.03;
//        const float c = 2.43;
//        const float d = 0.59;
//        const float e = 0.14;
        float a = vecTone1.x;
        float b = vecTone1.y;
        float c = vecTone1.z;
        float d = vecTone2.x;
        float e = vecTone2.y;
        float gamma = vecTone2.z;
        col = (col * (a * col + b)) / (col * (c * col + d) + e);
        col = pow(clamp(col, 0.0, 1.0), vec3(gamma));
        outColor = vec4(col, 1.);
    }
}
