#version 300 es
precision mediump float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;
uniform int iPassIndex;
uniform int iQueryRepetitions;
uniform float iCutoffMin;
uniform float iCutoffMax;
uniform float iResultMin;
uniform float iResultMax;
uniform float iScale;
uniform int iStepIterations;
uniform float iStepLength;
uniform float iShenanigans;
uniform sampler2D textureA;
uniform sampler2D textureB;

const vec3 c = vec3(1, 0, -1);

float resultScale;

#define ZERO min(0, iFrame)

////////////////////////////////////////////////////////////////////////

#define MAX_STEPS 1000

float doMultiply(in vec2 uv) {
    float result = 1.;
    for (int i = ZERO; i < MAX_STEPS; i++) {
        result *= iStepLength;
    }
    return 0.5;
}

float doDivision(in vec2 uv) {
    float result = 1.;
    for (int i = ZERO; i < MAX_STEPS; i++) {
        result /= iStepLength;
    }
    return 0.5;
}

////////////////////////////////////////////////////////////////////////

const vec3 normal = vec3(1, 0, 0);

vec3 inbuiltReflect(in vec2 uv) {
    vec3 rayDir = normalize(vec3(uv, 1.));
    vec3 target = reflect(rayDir, normal);
    return 0.5 + 0.5 * normalize(target);
}

vec3 customReflect(in vec2 uv) {
    vec3 rayDir = normalize(vec3(uv, 1.));
    vec3 target = rayDir - 2. * dot(rayDir, normal) * normal;
    return 0.5 + 0.5 * normalize(target);
}

////////////////////////////////////////////////////////////////////////

vec3 useBranching(in vec2 uv) {
    float x = uv.x * iResolution.x;
    if (mod(floor(x / 10.0), 2.0) < 1.0) {
        return vec3(sin(x) * 0.5 + 0.5, 0.0, 0.0);
    } else {
        return vec3(0.0, cos(x) * 0.5 + 0.5, 0.0);
    }
}

vec3 useNoBranching(in vec2 uv) {
    float x = uv.x * iResolution.x;
    float cond = step(0.5, mod(floor(x / 10.0), 2.0));
    vec3 a = vec3(sin(x) * 0.5 + 0.5, 0.0, 0.0);
    vec3 b = vec3(0.0, cos(x) * 0.5 + 0.5, 0.0);
    return mix(a, b, cond);
}

////////////////////////////////////////////////////////////////////////

vec3 calcSomethingViaReturn(in vec2 uv) {
    return 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
}

void calcSomethingViaOutVar(out vec3 result, in vec2 uv) {
    result = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0,2,4));
}

////////////////////////////////////////////////////////////////////////

float inbuiltSmoothstep(vec2 uv) {
    float x = uv.y - uv.x;
    return smoothstep(0., 1., x);
}

float splineSmoothstep(vec2 uv) {
    float x = uv.y - uv.x;
    x = clamp(x, 0., 1.);
    x = x * x * (3. - 2. * x);
    return x;
}

////////////////////////////////////////////////////////////////////////

vec3 hash33(vec3 p3) {
    p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}

const float F3 =  0.3333333;
const float G3 =  0.1666667;

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

float mfnoise3(vec3 m) {
    /* const matrices for 3d rotation */
    const mat3 rot1 = mat3(-0.37, 0.36, 0.85,-0.14,-0.93, 0.34,0.92, 0.01,0.4);
    const mat3 rot2 = mat3(-0.55,-0.39, 0.74, 0.33,-0.91,-0.24,0.77, 0.12,0.63);
    const mat3 rot3 = mat3(-0.71, 0.52,-0.47,-0.08,-0.72,-0.68,-0.7,-0.45,0.56);

    return   0.5333333 * lfnoise3(m * rot1)
    + 0.2666667 * lfnoise3(2. * m * rot2)
    + 0.1333333 * lfnoise3(4. * m * rot3)
    + 0.0666667 * lfnoise3(8. * m);
}

float noise( in vec3 x ) {
    return mfnoise3(x);
}

vec3 hash31(float p)
{
    vec3 p3 = fract(vec3(p) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
}

float fbmA(vec3 p) {
    const bool lowRes = false;
    const float iCloudSeed = 11.07;
    p *= iScale;

    vec3 q = p + 1.e4*hash31(iCloudSeed);// + iTime * 0.5 * vec3(1.0, -0.2, -1.0);
    float g = noise(q);

    float f = 0.0;
    float scale = 0.5;
    float factor = 2.02;

    int maxOctave = 6;

    if(lowRes) {
        maxOctave = 3;
    }

    for (int i = 0; i < maxOctave; i++) {
        f += scale * noise(q);
        q *= factor;
        factor += 0.21;
        scale *= 0.5;
    }

    // somewhat match the value range of fbmB()
    return 1.25 * (f + 0.4);
}

float hash( float n )
{
    return fract(sin(n)*43758.5453);
}

float xt95noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f*f*(3.0-2.0*f);
    float n = p.x + p.y*57.0 + 113.0*p.z;

    float res = mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
    mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
    mix(mix( hash(n+113.0), hash(n+114.0),f.x),
    mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
    return res;
}

mat3 m = mat3(
    0.00,  0.80,  0.60,
    -0.80,  0.36, -0.48,
    -0.60, -0.48,  0.64
);

float fbmB( vec3 p )
{
    float f;
    p *= iScale;
    // somewhat match the scaling of fbmA():
    p *= 2.5;

    f  = 0.5000*xt95noise( p ); p = m*p*2.02;
    f += 0.2500*xt95noise( p ); p = m*p*2.03;
    f += 0.1250*xt95noise( p ); p = m*p*2.01;
    f += 0.0625*xt95noise( p );
    return f;
}

////////////////////////////////////////////////////////////////////////

void toFragColor(vec3 result) {
    fragColor.rgb = (result - iResultMin) * resultScale;
}

void toFragColor(float result) {
    if (result < iCutoffMin) {
        fragColor.rgb = c.xyy;
    } else if (result > iCutoffMax) {
        fragColor.rgb = c.xyx;
    } else {
        toFragColor(vec3(result));
    }
}

void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    if (iPassIndex == -1) {
        // Compare both queried passes left and right
        vec2 st = gl_FragCoord.xy / iResolution.xy;
        if (uv.x < -0.01) {
            st.x += 0.25;
            fragColor.rgb = texture(textureA, st).rgb;
        } else if (uv.x > 0.01) {
            st.x -= 0.25;
            fragColor.rgb = texture(textureB, st).rgb;
        } else {
            discard;
        }
        fragColor.a = 1.;
        return;
    }

    // common setup stuff that one comparison or the other might use
    uv /= iScale;
    vec3 ray = normalize(vec3(uv, 2.5 / iScale));
    resultScale = 1. / (iResultMax - iResultMin);
    bool passA = iPassIndex == 0;

    for (int i = ZERO; i < iQueryRepetitions; i++) {
//        toFragColor(passA ? doDivision(uv) : doMultiply(uv));
//        toFragColor(passA ? inbuiltReflect(uv) : customReflect(uv));
//        toFragColor(passA ? useBranching(uv) : useNoBranching(uv));
        toFragColor(passA ? fbmA(ray) : fbmB(ray));
//        toFragColor(passA ? inbuiltSmoothstep(uv) : splineSmoothstep(uv));

        /*
        if (passA) {
            toFragColor(calcSomethingViaReturn(uv));
        } else {
            vec3 resultB;
            calcSomethingViaOutVar(resultB, uv);
            toFragColor(resultB);
        }
        */
    }
}
