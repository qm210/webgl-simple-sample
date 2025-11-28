#version 300 es

precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;
uniform vec4 iMouseDrag;
uniform float iMouseWheel;
uniform float iSceneRotation;
uniform float iScenePitch;
uniform float iFieldOfViewDegrees;
uniform vec3 vecDirectionalLight;
uniform float iDiffuseAmount;
uniform float iSpecularAmount;
uniform float iSpecularExponent;
uniform float iHalfwaySpecularMixing;
uniform vec3 vecSkyColor;
uniform float iBacklightAmount;
uniform float iSubsurfaceAmount;
uniform float iAmbientOcclusionScale;
uniform float iAmbientOcclusionRadius;
uniform float iAmbientOcclusionIterations;
uniform int iShadowCastIterations;
uniform float iShadowSharpness;
uniform int iRayMarchingIterations;
uniform float iMarchingMinDistance;
uniform float iMarchingMaxDistance;
uniform int iRayTracingIterations;
uniform float iMetalReflectance;
uniform float iMetalNoisiness;
uniform float iEtaGlassRefraction;
uniform float iCloudsAbsorptionCoeff;
uniform float iCloudsShadowCoeff;
uniform float iCloudVisitingFrequency;
uniform vec2 iCloudDistance;
uniform vec3 iCloudDimensions;
uniform float iCloudsMaxDensity;
uniform float iCloudsScaleFactor;
uniform float iCloudMorphSpeed;
uniform float iCloudNoisiness;
uniform int iVolumetricMarchingIterations;
uniform float iVolumetricMarchingStep;
uniform float iVolumetricAlphaThreshold;
uniform int iVolumetricShadowIterations;
uniform float iVolumetricShadowStep;
uniform float iVolumetricJitterAmount;
uniform float iVolumetricJitterSpeed;
uniform float iGammaCorrection;
uniform float iNoiseLevel;
uniform float iNoiseFreq;
uniform float iNoiseOffset;
uniform int iFractionalOctaves;
uniform float iFractionalScale;
uniform float iFractionalDecay;
uniform float iCalcNormalEpsilon;
uniform int modeDebugRendering;

// for you to play around with, put 'em wherever you want:
uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;

const float pi = 3.141593;
const float twoPi = 2. * pi;
const vec4 c = vec4(1., 0. , -1., .5);
const float epsilon = 1.e-4;

// Das "material"-Float berechnete zuletzt ja die Farbe aus der Palettenfunktion,
// aber wir nehmen hier ein Integer (siehe auch unten "struct Hit")
const int UNDEFINED_MATERIAL = 0;
const int NO_MATERIAL = -1;
const int FLOOR_MATERIAL = 1;
const int STANDARD_OPAQUE_MATERIAL = 2;
const int GLASS_MATERIAL = 3;
const int METAL_MATERIAL = 4;
const int PLAIN_DEBUGGING_MATERIAL = 99;
const int CLOUD_MATERIAL = 50;

const vec3 directionalLightColor = vec3(1.30, 1.00, 0.70);

mat3 rotX(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    // Obacht: GLSL-Matrizen sind "column-major", d.h. die ersten drei Einträge sind die erste Spalte, etc.
    // Auf die einzelnen Spalten zugreifen lässt sich per: vec3 zweiteSpalte = matrix[1];
    return mat3(
        1.0, 0.0, 0.0,
        0.0,   c,   s,
        0.0,  -s,   c
    );
}

mat3 rotY(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
          c, 0.0,  -s,
        0.0, 1.0, 0.0,
          s, 0.0,   c
    );
}

mat3 rotZ(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat3(
          c,   s, 0.0,
         -s,   c, 0.0,
        0.0, 0.0, 1.0
    );
}

//------------------------------------------------------------------

vec3 materialPalette(float parameter) {
    return 0.2 + 0.2 * sin(parameter * 2.0 + vec3(0.0,1.0,2.0));
}

float sdPlane( vec3 p )
{
    return p.y;
}

float sdSphere( vec3 p, float s )
{
    return length(p)-s;
}

float sdBox( vec3 p, vec3 b )
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float sdTorus( vec3 p, vec2 t )
{
    return length( vec2(length(p.xz)-t.x,p.y) )-t.y;
}

float sdSolidAngle(vec3 pos, vec2 c, float ra)
{
    vec2 p = vec2( length(pos.xz), pos.y );
    float l = length(p) - ra;
    float m = length(p - c*clamp(dot(p,c),0.0,ra) );
    return max(l,m*sign(c.y*p.x-c.x*p.y));
}

// Pseudorandom-Hashes

// 2d input -> 2d output
vec2 hash22(vec2 p) {
    float n = sin(dot(p, vec2(127.1, 311.7))) * 43758.5453;
    // iNoiseOffset: braucht man nicht, ist nur eine Chance auf mehr Abwechslung
    n += iNoiseOffset;
    return fract(vec2(n, n * 1.2154));
}

// 3d input -> 3d output
vec3 hash33(vec3 p3)
{
    p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy + p3.yxx)*p3.zyx);
}

// für die Noise-Berge

float perlin2D(vec2 p)
{
    vec2 pi = floor(p);
    vec2 pf = p - pi;
    vec2 w = pf * pf * (3.-2.*pf);

    float f00 = dot(hash22(pi+vec2(.0,.0)),pf-vec2(.0,.0));
    float f01 = dot(hash22(pi+vec2(.0,1.)),pf-vec2(.0,1.));
    float f10 = dot(hash22(pi+vec2(1.0,0.)),pf-vec2(1.0,0.));
    float f11 = dot(hash22(pi+vec2(1.0,1.)),pf-vec2(1.0,1.));

    float xm1 = mix(f00,f10,w.x);
    float xm2 = mix(f01,f11,w.x);
    float ym = mix(xm1,xm2,w.y);
    return ym;
}

float fractalBrownianMotion(vec2 p) {
    float v = 0.;
    float a = 1.;
    float s = 0.;
    for (int i = 0; i < iFractionalOctaves; i++) {
        v += a * perlin2D(p);
        s += a;
        p = p * iFractionalScale;
        a *= iFractionalDecay;
    }
    // return v;
    // <-- ist das eigentliche fbm(), aber führt hier schnell zu zu starken Werten
    return v / s;
}

float sdNoiseMountains(vec3 p) {
    float height = max(0., length(p.xz) - 3.);
    // <-- -3. damit mittlere Arena ungestört bleibt
    float noise = fractalBrownianMotion(p.xz * iNoiseFreq);
    height *= iNoiseLevel * (1. + noise);
    return p.y - height;
}

// Mehr Noise für die Wolken

float hash11( float n )
{
    return fract( n*17.0*fract( n*0.3183099 ) );
}

// Inigo Quilez's https://iquilezles.org/articles/morenoise/
// Rainforest ShaderToy https://www.shadertoy.com/view/4ttSWf
float valueNoise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 w = fract(x);
    vec3 u = w*w*w*(w*(w*6.0-15.0)+10.0);
    float n = p.x + 317.0*p.y + 157.0*p.z;
    float a = hash11(n+0.0);
    float b = hash11(n+1.0);
    float c = hash11(n+317.0);
    float d = hash11(n+318.0);
    float e = hash11(n+157.0);
    float f = hash11(n+158.0);
    float g = hash11(n+474.0);
    float h = hash11(n+475.0);
    float k0 =   a;
    float k1 =   b - a;
    float k2 =   c - a;
    float k3 =   e - a;
    float k4 =   a - b - c + d;
    float k5 =   a - c - e + g;
    float k6 =   a - b - e + f;
    float k7 = - a + b + c - d + e - f - g + h;
    return -1.0+2.0*(k0 + k1*u.x + k2*u.y + k3*u.z + k4*u.x*u.y + k5*u.y*u.z + k6*u.z*u.x + k7*u.x*u.y*u.z);
}

float generalizedFBMforTheClouds( in vec3 p )
{
    const mat3 m3 = mat3(
        0.00,  0.80,  0.60,
        -0.80,  0.36, -0.48,
        -0.60, -0.48,  0.64
    );

    float f = 2.0;
    float s = 0.5;
    float a = 0.0;
    float b = 0.5;
    for( int i=0; i<4; i++ )
    {
        float n = valueNoise(p);
        a += b*n;
        b *= s;
        p = f*m3*p;
    }
    return a;
}

float bounceParabola(float g, float T, float t) {
    t = fract(t/T) - 0.5;
    return 0.25*g - g*t*t;
}

float sdBouncyBox(vec3 pos, vec3 size, float bounceHeight, float bounceOffset, float gravity, float period, float phase) {
    float bounceY = bounceHeight * bounceParabola(gravity, period, phase) - bounceOffset;
    pos.y -= max(0., bounceY);
    float sqY = 1. - min(0., bounceY);
    float squeezedGap = (1. - 1./sqY) * size.y;
    pos.y += squeezedGap;
    float sqXZ = 1./sqY;
    sqXZ *= 1. + (sqY-1.) * 2. * pow((pos.y + 0.6 * size.y), 2.);
    // was mathematisch eine Diagonalmatrix wäre (skaliert nur jede Komponente für sich),
    // wird in GLSL als vec3 * vec3 dargestellt (was in der Mathematik nicht definiert ist)
    vec3 squeeze = vec3(sqXZ, sqY, sqXZ);
    pos = squeeze * pos;
    return sdBox(pos, size);
}

//-- Sinnvolle structs machen auf Dauer mehr Freude. Is echt so. ------

struct Ray {
    vec3 origin;
    vec3 dir;
    /// "pos" hier mitgeführt, um potentiell Mehrfachberechnung zu sparen:
    vec3 pos;
    /// und jetzt auch im Ray, weil thematisch zugehörig:
    vec3 attenuation;
    vec4 clouds;
};

struct Hit {
    float t;
    int material;
    // Wir machen "material" heute allein zum Index für die _Art_ Material (ergo "int").
    // Eine intrinsische Farbe bekommt ein Objekt durch ein Extrafeld:
    vec3 baseColor;
    // weil thematisch zugehörig (auch wenn erst "im Nachgang" bestimmt), hier auch der Normalenvektor:
    vec3 normal;
    // Texturen bleiben heute weg, also brauchen wir die Oberflächenkordinate nicht:
    // vec2 surfaceCoord;
};

const vec3 NORMAL_UNDETERMINED = c.yyy;
const vec3 NORMAL_ON_FLOOR = c.yxy;

struct Traced {
    vec3 color;
    // sind jetzt in Ray:
    // vec3 attenuation;
    // vec4 clouds;
    Hit hit;
};

struct DebugValues {
    int bounces;
    int lastMarchingSteps;
    Hit firstHit;
    Hit lastHit;
    vec3 attenuation;
    int volumetricSteps;
    vec4 volumetricColor;
};

////// zum debuggen nützlich
#define SHOW_DEBUG_MARKERS 0
#define N_DEBUG_MARKERS 3
vec3 debuggingMarkers[N_DEBUG_MARKERS] = vec3[N_DEBUG_MARKERS](
    c.xyy,
    c.wyy,
    c.yyy
);

//------------------------------------------------------------------------------

// Varianten von opUnion für Hit, bei der Gelegenheit gleich umbenannt:

Hit takeCloser(Hit d1, Hit d2)
{
    if (d1.t < d2.t) return d1;
    return d2;
}

Hit takeCloser( Hit d1, float t2, int material2, vec3 intrinsicColor2)
{
    if (d1.t < t2) return d1;
    return Hit(t2, material2, intrinsicColor2, NORMAL_UNDETERMINED);
}

Hit withBoundingVolume(Hit res, float t, int material, vec3 intrinsicColor)
{
    if (t < 0.) {
        // SDF only has an effect where we're inside the object
        return Hit(t, material, intrinsicColor, NORMAL_UNDETERMINED);
    }
    return res;
}

Hit map(in vec3 pos)
{
    Hit res = Hit(pos.y, FLOOR_MATERIAL, c.xxx, NORMAL_ON_FLOOR);

    float noiseY = sdNoiseMountains(pos - vec3(0.8,0.0,-1.6));
    if (noiseY < res.t) {
        res.t = noiseY;
        res.normal = NORMAL_UNDETERMINED;
    }

    // Primitives ( = Geometrien, die zumindest mathematisch "einfach" beschrieben sind)

    float torusOffset = 1.1 * sin(twoPi * 0.13 * iTime);
    res = takeCloser(res,
        sdTorus((pos-vec3(.5 + torusOffset, 0.30, 0.5)).xzy, vec2(0.25, 0.05)),
        STANDARD_OPAQUE_MATERIAL,
        materialPalette(7.1)
    );
    res = takeCloser(res,
        sdSphere(pos-vec3(0.25, 0.4, 1.0), 0.4),
        STANDARD_OPAQUE_MATERIAL,
        materialPalette(26.9)
    );
    res = takeCloser(res,
        sdBouncyBox(rotY(0.73) * (pos - vec3(1., 0.34, 2.)), 0.34 * c.xxx, 1.3, .34, 1., 2., iTime),
        METAL_MATERIAL,
        c.xxx
    );
    res = takeCloser(res,
        sdSolidAngle(rotX(0.1)*rotZ(0.2)*(pos-vec3(0., -6., -4.7)), vec2(1, 4)/sqrt(17.), 10.),
        METAL_MATERIAL,
        vec3(0.88, 0.67, 1.0)
    );
    res = takeCloser(res,
        sdSphere(pos-vec3(1.0, 0.3, 0.15), 0.3),
        GLASS_MATERIAL,
        c.xxx
    );
    res = takeCloser(res,
        sdBouncyBox(pos - vec3(-0.5, 1.1, 2.), vec3(0.6, 1.1, 0.6), iFree0, iFree1, 0.5 + iFree2, 3. + iFree3, iTime),
        GLASS_MATERIAL,
        vec3(0.7, 0.9, 1.)
    );

    #if SHOW_DEBUG_MARKERS
        // Als Hilfe für die Entwicklung (z.B. Geometrien positionieren oder Kamera ausrichten):
        for (int m = 0; m < N_DEBUG_MARKERS; m++) {
            res = takeCloser(res,
                sdSphere(pos - debuggingMarkers[m], 0.03),
                PLAIN_DEBUGGING_MATERIAL,
                c.yyy
            );
        }
    #endif

    return res;
}

///////////////////////// clouds

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

float fbm( vec3 p )
{
    float f;
    f  = 0.5000*xt95noise( p ); p = m*p*2.02;
    f += 0.2500*xt95noise( p ); p = m*p*2.03;
    f += 0.1250*xt95noise( p ); p = m*p*2.01;
    f += 0.0625*xt95noise( p );
    return f;
}

float cloudDensity(in vec3 pos) {
    // anders als map() gibt das hier einfach die Dichteverteilung normiert auf [0, 1] zurück.
    // -> geht dann sowohl in die Schattenbestimmung als auch die Summierung über Wolkenmaterial ein.
    // float density = generalizedFBMforTheClouds(pos * iCloudsScaleFactor + iNoiseOffset);
    float radialDistance = 1./sqrt(2.) * iCloudDistance.x;
    vec3 cloudPos = rotY(iCloudVisitingFrequency * iTime) * vec3(-radialDistance, iCloudDistance.y, radialDistance);
    float f = fbm((pos - cloudPos) * iCloudsScaleFactor - vec3(0.7, 0.5, 1) * iTime * iCloudMorphSpeed + iNoiseOffset);
    float ellipsoid = 1.0 - length((pos - cloudPos) / iCloudDimensions * sqrt(1. + 2. * iCloudNoisiness));
    float density = ellipsoid + iCloudNoisiness * f;
    return clamp(density, 0., 1.);
}

#define ZERO (min(iFrame,0))
// #define ZERO 0

void performVolumetricRayMarching(inout Ray ray, inout DebugValues debug) {
    float jitter = iVolumetricJitterAmount * hash(ray.pos.x + ray.pos.y * 57.0 + iVolumetricJitterSpeed * iTime);
    vec3 lightDirection = normalize(-vecDirectionalLight);
    vec3 cloudColor = vec3(1.,.9,.8);
    vec3 skyGray = vec3(dot(vec3(0.3, 0.59, 0.11), cloudColor));
    cloudColor = mix(cloudColor, skyGray, iFree0);
    vec3 colorDensity = (
        max(dot(lightDirection, ray.dir), 0.)
        * directionalLightColor
        * cloudColor
    );

    ray.pos += ray.dir * jitter * iVolumetricMarchingStep;

    float density;
    float remainingAlpha = 1.;
    int i;
    for (i = 0; i < iVolumetricMarchingIterations; i++) {
        if (remainingAlpha <= 1. - iVolumetricAlphaThreshold) {
            break;
        }

        density = cloudDensity(ray.pos);

        if (density > 0.001) {
            vec3 lp = ray.pos + lightDirection * jitter * iVolumetricShadowStep;
            float shadow = 0.;
            for (int s = 0; s < iVolumetricShadowIterations; s++) {
                lp += lightDirection * iVolumetricShadowStep;
                shadow += cloudDensity(lp);
            }
            density = clamp(density * iCloudsMaxDensity,0.0,1.0);
            shadow = exp(-shadow / float(iVolumetricShadowIterations) * iCloudsShadowCoeff);

            ray.clouds.rgb += shadow * density * cloudColor * remainingAlpha;
            remainingAlpha *= 1. - density;
            density *= exp(-cloudDensity(ray.pos+vec3(0,.25,0.0)) * iCloudsAbsorptionCoeff);
            ray.clouds.rgb += density * vec3(.15,.45,1.1) * remainingAlpha;
        }
        ray.pos += ray.dir * iVolumetricMarchingStep;
    }
    ray.clouds.a = 1. - remainingAlpha;

    debug.volumetricSteps = max(debug.volumetricSteps, i);
    debug.volumetricColor = ray.clouds;
}

void performRayMarching(inout Ray ray, out Hit hit, inout DebugValues debug)
{
    hit = Hit(-1.0, NO_MATERIAL, c.yyy, NORMAL_UNDETERMINED);

    float tmin = iMarchingMinDistance;
    float tmax = iMarchingMaxDistance;

    // trace floor plane analytically
    float tp1 = (0.0-ray.origin.y)/ray.dir.y;
    if (tp1 > 0.0)
    {
        tmax = min(tmax, tp1);
        hit = Hit(tp1, FLOOR_MATERIAL, c.xxx, NORMAL_ON_FLOOR);
    }

    // Hier habe ich die "Bounding Box" entfernt, da der Performance-Gewinn
    // die Extra-Komplexität / Lesbarkeit nicht rechtfertigt hat (bei mir zumindest).
    // Wenn insgesamt zu langsam -> wieder einführen :)

    float t = tmin;
    bool inside = false;
    int i;
    for(i = ZERO; i < iRayMarchingIterations && t < tmax; i++)
    {
        ray.pos = ray.origin + ray.dir * t;
        // map(...) = Szene-SDF, voluMap(...) = Wolken-SDF
        Hit h = map(ray.pos);

        // Reminder vom letzten Mal: mussten erweitern für "Strahl kann auch ins Material (und wieder heraus)"
        // hier etwas kompakter abgehandelt.
        if ((abs(h.t) < epsilon * t) || (inside && h.t > 0.))
        {
            hit = h;
            hit.t = t;
            break;
        }
        inside = h.t < 0.;
        t += abs(h.t);
    }
    // Um debuggen zu können, ob wir irgendwo am Limit der Ray-Marching-Iterationen sind:
    debug.lastMarchingSteps = i;

    if (hit.material != NO_MATERIAL) {
        return;
    }

    performVolumetricRayMarching(ray, debug);
}

// https://iquilezles.org/articles/rmshadows
float calcSoftshadow( in vec3 ro, in vec3 rd)
{
    float tMin = 0.02;
    float tMax = 2.5;

    // bounding volume (Spart etwas Rechenzeit, könnte man mal vergleichen)
    float tp = (0.8-ro.y)/rd.y;
    if( tp > 0.0 ) {
        tMax = min( tMax, tp );
    }
    // Ganz allgemein ist die Aussage wahr:
    // Wenn for einer iterativen Ray-Casting-Schleife schon durch
    // analytische Mathematik die Bedingungen eingeschränkt werden können,
    // kann sich das schon lohnen. Kann man aber verschieben auf "erst sobald nötig" ;)

    float res = 1.0;
    float t = tMin;
    for(int i = ZERO; i < iShadowCastIterations; i++)
    {
        // Ray Marching von der Aufprallstelle des ersten Marchings (raymarch(...))
        float h = map( ro + rd*t ).t;
        // Aber nicht mit Ziel, den Abstand des nächsten Materials zu finden, sondern
        // den kleinsten Quotienten s zu finden, der uns sagt: Auf dem zweiten Strahl,
        // ist irgendwo ein Objekt viel näher (h) als unser Strahl lang (t)?
        // - h == 0 heißt "anderes Objekt im Weg" (dessen SDF ist an seiner Oberfläche ja 0)
        // - kleines h/t heißt, der Schatten hatte genug Raum, sich auszubreiten.
        // Der Faktor 8. in der ursprünglichen Form entspricht der Schattenschärfe:
        // float s = clamp(8.*h/t, 0.0, 1.0);
        float s = iShadowSharpness * h/t;
        s = clamp(s, 0.0, 1.0);
        res = min(res, s);
        // - Schrittweite begrenzen, wir wollen viele Schattenbeiträge in der Nähe sammeln,
        //   ergibt dann weiche Schatten, nicht nur klares "irgendwas ist im Weg" vs. "nicht".
        t += clamp( h, 0.01, 0.2);
        if( res<0.004 || t>tMax ) break;
    }
    /*
      res = clamp( res, 0.0, 1.0 );
      return res*res*(3.0-2.0*res);
    */
    // <-- sowas steht in manchen Shadern, aber es entspricht eins-zu-eins
    //     der smoothstep()-Funktion. (Vermutlich eine Mikro-Optimierung.)
    return smoothstep(0., 1., res);
}

// https://iquilezles.org/articles/nvscene2008/rwwtt.pdf
float calcAmbientOcclusion(in vec3 pos, in vec3 normal)
{   // Ambient Occlusion: Metrik für den Grad der Verdeckung / Verwinkeltheit
    // Parameter als Uniform erklärt:
    // iAmbientOcclusionIterations ~ 5
    // iAmbientOcclusionRadius ~ 0.12
    // iAmbientOcclusionScale ~ 0.95;
    // Idee: wir werten die gesamte Map in verschiedenen Abständen von der Oberfläche aus
    //       (vom Auftrittspunkt also Richtung Normalenvektor) und summieren auf:
    //       (h - d) ~ Wenn d entlang dieser Linie zu klein bleibt, haben wir "Verdeckung", d.h.
    //                 schätzen Schatten / Hohlräume ab, ohne die Rays zum Licht _tracen_ zu müssen
    float occlusion = 0.0;
    float scale = 1.0;
    for (float i = 0.; i < iAmbientOcclusionIterations; i += 1.)
    {
        float h = 0.01 + iAmbientOcclusionRadius * i / (iAmbientOcclusionIterations - 1.);
        float d = map(pos + h*normal).t;
        // Wieder eine etwas andere Logik als beim initialen Raymarchen Abstandfinden) und Schatten:
        // Gegangen wird hier vom Oberflächenpunkt, und in Richtung des Normalenvektors
        // (also weg von der Oberfläche). Das in ein paar konstanten Schritten.
        // d: ist das, was beim Schatten h hieß, also der Abstand zum nächsten Objekt
        // h: ist das, was beim Schatten t hieß, also die abgeschrittene Länge
        // wenn (h-d) == 0 ist, ist das nächste Objekt vermutlich einfach das, von dem man kommt
        // wenn aber so ein Strahl parallel zu und nahe an einer anderen Fläche vorbeigeht,
        // ist d klein, während h immer größer wird -> viel Ambient Occlusion
        occlusion += (h-d) * scale;
        // außerdem werden weiter entfernte Punkte weniger stark gewichtet:
        // 1 -> 0.95 -> 0.91 -> 0.86 -> 0.82
        scale *= iAmbientOcclusionScale;
        if( occlusion>0.35 ) break;
    }
    return clamp( 1.0 - 3.0*occlusion, 0.0, 1.0 ) * (0.5+0.5*normal.y);
}

#define REDUCE_CALC_NORMAL_INLINING

// https://iquilezles.org/articles/normalsSDF
vec3 calcNormal( in vec3 pos )
{
    // Bildet finite Differenzen um pos,
    // also den Normalenvektor aus dem 3D-Gradienten.
    // ( 0.5773 == 1/sqrt(3) ),
    // iCalcNormalEpsilon ~ 0.0005 aber ändert doch mal :P
    #ifndef REDUCE_CALC_NORMAL_INLINING
        vec2 e = vec2(1.0, -1.0) * 0.5773 * iCalcNormalEpsilon;
        return normalize(
            e.xyy*map( pos + e.xyy ).t +
            e.yyx*map( pos + e.yyx ).t +
            e.yxy*map( pos + e.yxy ).t +
            e.xxx*map( pos + e.xxx ).t
        );
    #else
        vec3 n = vec3(0.0);
        for( int i=ZERO; i<4; i++ )
        {
            vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
            n += e * map(pos + iCalcNormalEpsilon * e).t;
        }
        return normalize(n);
    #endif
}

vec3 shadeForOpaqueMaterial(Ray ray, Hit hit) {

    vec3 lightDirection = normalize(-vecDirectionalLight);
    // Vorzeichenkonvention: lightDirection in den Beleuchtungsmodellen ist ZUM Licht
    // (im Uniform vecDirectionalLight fand ich die andere Richtung aber geeigneter)

    // Ambient Occlusion - Faktor für die Verdecktheit / Verwinkelung an einer Stelle
    //                     (1 = quasi freie Fläche, 0 = total in Höhle)
    float occlusion = calcAmbientOcclusion(ray.pos, hit.normal);

    // Akkumuliert alle Beiträge des Beleuchtungsmodells, die wir uns so ausdenken
    vec3 shade = c.yyy;

    // Konstanten, aus Hit abgeleitet:
    vec3 matColor = hit.baseColor;
    float specularCoeff = hit.material == FLOOR_MATERIAL ? 0.4 : 1.;
    float subsurfCoeff = hit.material == FLOOR_MATERIAL ? 0.05 : 1.;

    {
        // 1. Effekt: Richtungslicht z.B. der Sonne bzw. einer weit entfernten Lichtquelle.
        //            (-> Alle Lichtstrahlen sind parallel.)
        //            In VL5 wurden auch Punktquellen demonstriert.

        // PS: RGB-Werte größer 1 sind für eine Lichtquelle geduldet, ist dann halt stärker.

        // Diffuser Teil: geht ~ dot(normal, lightSource)
        float diffuse = clamp(dot(hit.normal, lightDirection), 0.0, 1.0);
        diffuse *= calcSoftshadow(ray.pos, lightDirection);
        shade += iDiffuseAmount * diffuse * directionalLightColor * matColor;

        // Specular: hat einen Term ~ dot(normal, refl) oder dot(normal, halfway)
        // Halfway wird (z.B. Blinn-Phong) anstatt echtem Reflektionsvektor verwendet.
        // Ist etwas schneller berechnet und macht oft weicheres Licht / breitere Verläufe.
        vec3 halfway = normalize(lightDirection - ray.dir);
        vec3 refl = reflect(-lightDirection, hit.normal);
        // Können wir mal direkt vergleichen, indem wir zwischen beiden Vektoren interpolieren
        // d.h. iHalfwaySpecularMixing == 0 -> Phong
        //      iHalfwaySpecularMixing == 1 -> Blinn-Phong
        refl = mix(refl, halfway, iHalfwaySpecularMixing);

        float specular = pow(clamp(dot(hit.normal, refl), 0.0, 1.0), iSpecularExponent);

        shade += iSpecularAmount * specular * directionalLightColor * specularCoeff;
    }

    {
        // 2. Effekt: Himmel - Auch Richtungslicht, direkt von oben aber anders gewichtet.
        //            (hatte ich bisher entfernt, könnt ihr aber mal versuchen zu interpretieren)
        float diffuse = sqrt(clamp(0.5 + 0.5 * hit.normal.y, 0.0, 1.0));
        // <-- hier steht quasi dot(normal, lightDirection) mit lightDirection == (0,1,0)
        // das sqrt() ist m.E. eine willkürliche Graduierung, aber der Effekt ist,
        // dass die Übergänge zwischen verschiedenen Winkeln sanfter ist.
        // (sqrt(x) entspricht pow(x, 0.5) und ist also auch eine Art Gammakorrektur)
        diffuse *= occlusion;
        shade += 0.60 * diffuse * vecSkyColor * matColor;

        vec3 refl = reflect(ray.dir, hit.normal);
        float specular = smoothstep(-0.2, 0.2, refl.y);
        specular *= diffuse;
        specular *= 0.04+0.96*pow(clamp(1.0+dot(hit.normal, ray.dir), 0.0, 1.0), 5.0);
        // <-- Nochmal eine modifizierte Form des Phong-Speculars (Glanzlichts).
        //     pow(..., 5.) deutet auf "Fresnel-Korrektur" hin, dem Verlauf
        //     etwas realistischerer Lichtbrechnung an der Grenzfläche.
        //     (d.h. ein Stück näher an der Physik als das rein empirische Phong).
        //     "Physikalischer motiviert" muss aber nicht "überzeugender" aussehen.
        specular *= calcSoftshadow(ray.pos, refl);

        shade += 2.00 * specular * vecSkyColor * specularCoeff;
    }

    {
        // 3. Effekt:
        // "Backlight / Ambient Illumination", Idee ist, in eher verdeckten Bereichen
        // durch irgendwelche Spiegelungen am Boden (für unseren festen Fall y == 0)
        // die Schatten wieder etwas vermindert werden

        // vec3 lightFloorReflection = normalize(vec3(-lightDirection.x, 0., -lightDirection.z));
        // <-- war in der Vorlage hard-coded, aber das hier ist die Grundlage:
        vec3 lightFloorReflection = cross(lightDirection, vec3(0,1,0));

        float backlightIllumination = clamp(dot(hit.normal, lightFloorReflection), 0.0, 1.0);
        backlightIllumination *= occlusion * clamp(1.0 - ray.pos.y, 0.0, 1.0);

        shade += iBacklightAmount * matColor * backlightIllumination * 0.25;
    }

    {
        // 4. Effekt:
        // "Sub-Surface Scattering"-Nachahmung nach, i.e. Lichtstrahlen, die das Material nach etwas
        // Verweilzeit  wieder verlassen (man stelle sich seine Finger hinter einer Taschenlampe vor)
        // Das ist physikalisch ein Diffusionseffekt und sieht generell weich aus, oder wachs-artig.
        // Das hängt am Ambient-Occlusion-Faktor aufgrund der Annahme, dass die Lichtstrahlen, die
        // in diesen Ecken bzw. Materialien etc. "verdeckt" werden, ja irgendwo hin müssen.
        // Richtungsverhalten ist: Kein Beitrag bei direkt draufschauen (Licht wird ja "weggestreut")
        // wird dann 1 dann Richtung 90° und darüber hinaus ("von hinten auf Oberfläche")
        float subsurfaceScattering = pow(clamp(1.0+dot(hit.normal, ray.dir), 0.0, 1.0), 2.0);
        subsurfaceScattering *= occlusion * subsurfCoeff;

        shade += iSubsurfaceAmount * subsurfaceScattering * matColor;
    }

    return shade;
}

float refractedReflectance(vec3 refracted, vec3 normal, float eta) {
    // Schlick-Fresnel-Formel für wie hell der gebrochene Strahl noch ist:
    // (folgt auch aus den physikalischen Grundlagen)
    float r0 = (1. - eta) / (1. + eta);
    r0 = r0 * r0;
    float cosineRefracted = -dot(refracted, normal);
    return r0 + (1. - r0) * pow((1. - cosineRefracted), 5.);
}

vec3 blendFrontToBack(vec4 front, vec3 back) {
    // Front-to-Back-Alpha-Blending:
    // Was "front" "an Alpha übriglässt", kann man von "back" sehen.
    return front.rgb + (1. - front.a) * back;
}

void performRayTracing(in Ray ray, out Traced traced, out DebugValues debug)
{
    // Ray Tracing addiert (meist) viele Effekte, also brauchen wir verschiedene
    // "Akkumulatoren", also Größen die während dem Tracing laufend aufsummiert
    // bzw. reduziert werden;
    // Die Pixelfarbe fängt bei Schwarz an und wird immer weiter beleuchtet:
    traced.color = c.yyy;

    Hit hit;
    int bounce;
    for (bounce = 0; bounce < iRayTracingIterations; bounce++) {

        // Erste Mission: Ersten Strahlabstand finden, d.h. wie gehabt:
        // Marching durch map() und bei minimaler SDF das Material merken.
        // Hier intern noch erweitert durch das volumetrische Ray Marching!
        performRayMarching(ray, hit, debug);

        ray.pos = ray.origin + hit.t * ray.dir;

        if (bounce == 0) {
            debug.firstHit = hit;
        }

        if (hit.material == NO_MATERIAL) {
            vec3 bgCol = vecSkyColor * ray.attenuation;
            traced.color += blendFrontToBack(ray.clouds, bgCol);
            // traced.color = ray.clouds.rgb * ray.clouds.a;
            break;
        }

        if (hit.normal == NORMAL_UNDETERMINED) {
            hit.normal = calcNormal(ray.pos);
        }

        bool isFloor = hit.material == FLOOR_MATERIAL;

        if (isFloor) {
            float f = 1. - abs(step(0.5, fract(2.*ray.pos.x)) - step(0.5, fract(2.*ray.pos.z)));
            hit.baseColor *= 0.1 + f * vec3(0.04);
        }

        if (hit.material == STANDARD_OPAQUE_MATERIAL || isFloor) {
            // Hier das alte Beleuchtungsmodell -- opak == blickdichtes Material,
            // d.h. die Beiträge wie in VL5 besprochen (plus etwas mehr),
            // ausgelagert in eigene Funktion zur Übersichtlichkeit.
            vec3 shade = shadeForOpaqueMaterial(ray, hit);

            traced.color += ray.attenuation * shade;

            // Dieser Ray trägt somit ab hier nicht mehr weiter bei:
            break;
        }
        else if (hit.material == GLASS_MATERIAL) {
            // Lichtbrechung: Übergang von I(ncoming) nach T(ransmitted)
            float cosIncoming = dot(ray.dir, hit.normal);
            // eta: "Permittivitätskonstante" an Grenzfläche als Quotient
            // (Wellenlänge im Material kürzer als außen, Brechungsindex von Luft == 1.)
            float eta;
            // Muss Richtung des Übergangs beachten und ggf. tauschen,
            // dabei auch den Normalenvektor in die andere Richtung spiegeln,
            // weil der nach außen zeigen muss.
            if (cosIncoming > 0.0) {
                eta = iEtaGlassRefraction;
                hit.normal *= -1.;
            } else {
                eta = 1. / iEtaGlassRefraction;
            }

            vec3 reflected = reflect(ray.dir, hit.normal);
            vec3 refracted = refract(ray.dir, hit.normal, eta);

            // Totalreflexion passiert bei flachen Winkeln und ausreichenden eta,
            // (lässt sich alles aus dem Snell-Gesetz ableiten), relevant hier ist,
            // dass dann also refracted === vec3(0.) gesetzt wurde.
            if (refracted == c.yyy) {
                ray.dir = reflected;
                ray.origin = ray.pos + epsilon * reflected;
                // <-- Vorsorge gegen numerische Float-Fluktuationen auch hier
                ray.attenuation *= hit.baseColor;
                continue;
            }

            // Falls also nicht Totalreflexion, gehen wir nur mit refracted weiter:
            ray.dir = refracted;
            ray.origin = ray.pos + epsilon * refracted;
            ray.attenuation *= hit.baseColor;
            float reflectance = refractedReflectance(refracted, hit.normal, eta);
            traced.color += ray.attenuation * reflectance;

            // Diese gesamte Lichtbrechungs-Mathematik kann man manuell optimieren,
            // aber stellt sich heraus, dass das für heute nicht nötig ist :)
        }
        else if (hit.material == METAL_MATERIAL) {
            // Neuer Strahl geht jetzt vom Auftrittspunkt in die reflect()–Richtung.
            // "+ epsilon * direction" dient der numerischen Entzerrung, um nicht in Grenzfällen
            // versehentlich nochmal am selben Punkt zu interagieren ("Self-Interactions")
            ray.dir = reflect(ray.dir, hit.normal);
            ray.origin = ray.pos + epsilon * ray.dir;
            ray.attenuation *= iMetalReflectance * hit.baseColor;

            // have some fun with random variation -- if we had another ray available, we should just mix partially
            ray.dir += iMetalNoisiness * abs(hash33(91. * ray.pos));
        }
        else if (hit.material == PLAIN_DEBUGGING_MATERIAL) {
            traced.color = hit.baseColor;
            break;
        }
    }
    traced.hit = hit;

    debug.bounces = bounce;
    debug.lastHit = hit;
    debug.attenuation = ray.attenuation;
}

void render(in Ray ray, out vec3 col, out DebugValues debug) {

    Traced traced;
    performRayTracing(ray, traced, debug);
    col = traced.color;

    // Post Processing: Distanznebel (mit Himmelsfarbe)
    /*
    const float fogDensity = 0.0001;
    const float fogGrowth = 3.0;
    float fogOpacity = 1.0 - exp( -fogDensity * pow(traced.hit.t, fogGrowth));
    col = mix(col, vecSkyColor, fogOpacity);
    */

    // Post Processing: Gammakorrektur
    col = pow(col, vec3(1./iGammaCorrection));
    col = clamp(col, 0.0, 1.0);
}

mat3 setCamera( in vec3 origin, in vec3 target, float rollAngle )
{
    vec3 cameraForward = normalize(target - origin);
    vec3 cp = vec3(sin(rollAngle), cos(rollAngle), 0.0);
    vec3 cameraRight = normalize( cross(cameraForward, cp) );
    vec3 cameraUp = cross(cameraRight, cameraForward); // already normalized
    return mat3(cameraRight, cameraUp, cameraForward);
}

void main()
{
    // uv normiert auf x in [-aspRatio, aspRatio], y in [-1, 1]
    vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    // iMouseDrag habe ich mal anwendungsseitig neu konstruiert, nämlich:
    // - iMouseDrag.xy = Spanne des aktuellen Mouse-Drag = Cursorposition - Anfangsposition
    // - iMouseDrag.zw = Spanne über alle bisherigen Mouse-Drags zusammengezählt
    // das macht dieses Panning per Maus dann doch angenehmer, wie ich meine:
    vec2 pan = iMouseDrag.zw / iResolution.xy;

    vec3 cameraTarget = vec3(0.4, 0.4, 1.);

    // _Zusätzliche_ Kamera-Neigung per Maus über Pitch-Eulerwinkel:
    float pitch = -pan.y + iScenePitch;
    // Gegenläufiges Anheben/Senken vom Kameraziel um die Szene im Blick zu behalten
    // (Pitch ist ja ein Winkel, aber wir wählen den Faktor hier nach Belieben / Optik)
    cameraTarget.y += 2.46 * pitch;

    mat3 rotationAroundTarget = rotY(iSceneRotation + pan.x * twoPi);
    vec3 rayOrigin = cameraTarget + rotationAroundTarget * vec3(1.3, 0.9, -4.3);

    // Welt-zu-Kamera-Transformation:
    // (camera matrix) * (vec3 in world coordinates) = (vec3 in camera coordinates)
    mat3 cameraMatrix = setCamera( rayOrigin, cameraTarget, 0.0 );

    // Verkettete Rotationen per Eulerwinkel können Probleme mit sich bringen.
    // (Gimbal Lock = Achsen überlagern sich / Verlust einer Drehrichtung)
    // Wir nehmen das hier in Kauf, weil wir keine richtigen Kamerapfade brauchen.
    cameraMatrix = cameraMatrix * rotX(pitch);

    // Zusammenhang "Brennweite / Focal Length" vs. Field-of-View-Winkel:
    float fovRadians = (iFieldOfViewDegrees - iMouseWheel) * pi / 180.;
    float focalLength = 0.5 / tan(0.5 * fovRadians);
    // focalLength = 2.5; // <-- Ursprungswert
    vec3 rayDirection = cameraMatrix * normalize(vec3(uv, focalLength));

    // Die "Attenuation" ist quasi "Lichtstärke" als RGB-Wert, fängt mit weiß an
    // und wird dann durchs Tracing sukzessive kleiner, akkumuliert also Schatten.
    // vec3 attenuation = c.xxx;
    // Die Wolken werden volumetrisch ermittelt und können also im Weg liegen.
    // unser Tracing summiert also auch diese RGBA-Größe auf, beginnend bei nichts.
    // vec4 clouds = c.yyyy;
    // --> these are now part of struct Ray:
    Ray ray = Ray(rayOrigin, rayDirection, rayOrigin, c.xxx, c.yyyy);
    DebugValues debug;
    vec3 col;

    render(ray, col, debug);

    fragColor.rgb = col;
    fragColor.a = 1.;

    switch (modeDebugRendering) {
        case 1:
            fragColor.rgb = vec3(
                float(debug.bounces) / float(iRayTracingIterations)
            );
            break;
        case 2:
            fragColor.rgb = vec3(
                float(debug.lastMarchingSteps) / float(iRayMarchingIterations)
            );
            break;
        case 3:
            fragColor.rgb = vec3(debug.firstHit.t / iMarchingMinDistance);
            break;
        case 4:
            fragColor.rgb = debug.attenuation;
            break;
        case 5:
            fragColor.rgb = vec3(
                float(debug.volumetricSteps) / float(iVolumetricMarchingIterations)
            );
            break;
        case 6:
            fragColor.rgb = debug.volumetricColor.rgb;
            break;
        case 7:
            fragColor.rgb = vec3(debug.volumetricColor.a);
            break;
    }
}
