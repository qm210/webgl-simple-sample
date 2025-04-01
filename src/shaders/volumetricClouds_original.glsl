#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform vec3 cursorWalk;

uniform sampler2D iTexture0;
uniform sampler2D iTexture1;
uniform sampler2D iTexture2;
uniform sampler2D iBumpMap;

const int MATERIAL_CONST = 0;
const int MATERIAL_BOX = 1;
const int MATERIAL_FLOOR = 2;

const float pi = 3.141593;

const int MAX_MARCHING_STEPS = 255;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float PRECISION = 0.001;

// Rotation matrix around the X axis.
// Winkel in Einheit Radians, d.h. theta = pi entspricht 180°
mat3 rotateX(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(1, 0, 0),
        vec3(0, c, -s),
        vec3(0, s, c)
    );
}

// Rotation matrix around the Y axis.
mat3 rotateY(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(c, 0, s),
        vec3(0, 1, 0),
        vec3(-s, 0, c)
    );
}

// Rotation matrix around the Z axis.
mat3 rotateZ(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(c, -s, 0),
        vec3(s, c, 0),
        vec3(0, 0, 1)
    );
}


mat3 diagonalMatrix(float x, float y, float z) {
    return mat3(
        vec3(x, 0, 0),
        vec3(0, y, 0),
        vec3(0, 0, z)
    );
}

mat3 identity() {
    return diagonalMatrix(1., 1., 1.);
}

struct Surface {
    float sd; // Abstand des Rays vom Objekt
    vec3 col; // <-- die Objekte dürfen eine intrinsische Farbe haben
    int material; // wir verlagern die Zuweisung der Farben auf nach dem Ray Marching...
    vec2 uv; // wir müssen aber mitführen
};

void wobbleDistort(inout Surface surface, vec3 p, float amp, vec3 scale) {
    surface.sd += amp * sin(scale.x*p.x) * sin(scale.y*p.y) * sin(scale.z*p.z);
}

float checkerboard(vec2 p, float scale) {
    vec2 ip = floor(p * scale);
    return mod(ip.x + ip.y, 2.0);
}

float surfaceCheckerPattern(vec3 p, float checkerSize) {
    vec2 surface = vec2(
        atan(p.z, p.x) / (2. * 3.14159) + 0.5,
        p.y / 2. + 0.5
    );
    return checkerboard(surface, checkerSize);
}

Surface sdPatternSphere( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform, vec3 checkerCol, float nSegments) {
    p = (p - offset) * transform;
    vec3 q = abs(p) - b;
    float d = length(p / b) - 1.;
    col = mix(col, checkerCol, surfaceCheckerPattern(p, nSegments));
    return Surface(d, col, 0, vec2(0.));
}

Surface sdSphere( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform) {
    p = (p - offset) * transform;
    vec3 q = abs(p) - b;
    float d = length(p / b) - 1.;
    return Surface(d, col, 0, vec2(0));
}

Surface sdBox( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform) {
    p = (p - offset) * transform;
    vec3 q = abs(p) - b;
    float d = length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    return Surface(d, col, 0, vec2(0));
}

Surface sdTexturedBox( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform) {
    p = (p - offset) * transform;
    vec3 q = abs(p) - b;
    float d = length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);

    // Koordinatentransformation:
    // Um Textur zuzuordnen, müssen wir uns in den Würfel hineinversetzen.
    // - In seinem eigenen Koordinatensystem rotiert er nicht,
    // - die Mitte ist nicht bei p (Weltkoordinaten), sondern bei vec3(0)
    // - und auch die Skalierung (b) für seine prinzipielle Würfelhaftigkeit egal.
    vec3 a = 0.5 * p / b;
    // damit geht der Würfel in jeder Dimension von einer Wand bei -0.5 zu einer bei +0.5

    // Gradient um oben/unten auseinander halten zu können.
    col = vec3(
        0.5 + a.z,
        0.5 + a.x,
        0.5 - a.z // aber zu Farbmischungen kommen wir noch.
    );

    vec2 uv;
    // Um Zuordnung zu verstehen:
    // mal auskommentieren oder sign()-Abhängigkeit entfernen,
    // oder mit uv = vec2(0); die Textur auf der Seite deaktiveren.
    if (abs(a.z) > 0.5) {
        uv = vec2(0.5 + a.x * sign(a.z), 0.5 - a.y);
    } else if (abs(a.y) > 0.5) {
        uv = vec2(0.5 + a.x, 0.5 + a.z * sign(a.y));
    } else if (abs(a.x) > 0.5) {
        uv = vec2(0.5 - a.z * sign(a.x), 0.5 - a.y);
    }
    // Reminder: if() generell überdenken, aber das reicht auch,
    // wenn irgendwo konkret ein Performanceproblem vorliegt.

    // oder wäre das hier viel lehrreicher?
//    uv = mix(
//        mix(
//            vec2(0.5 + a.x * sign(a.z), 0.5 - a.y),
//            vec2(0.5 + a.x * sign(a.y), 0.5 + a.z),
//            step(0.5, abs(a.y))
//        ),
//        vec2(0.5 - a.z * sign(a.x), 0.5 - a.y),
//        step(0.5, abs(a.x))
//    );

    return Surface(d, col, MATERIAL_BOX, uv);
}

Surface sdTetraeder( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform) {
    p = (p - offset) * transform;
    vec3 q = p / b;
    float d = sqrt(1./3.) * (
        max(
            abs(q.x+q.y)-q.z,
            abs(q.x-q.y)+q.z
        )-1.);
    vec2 uv = q.xy;
    return Surface(d, col, MATERIAL_BOX, uv);
}

float dot2( in vec3 v ) { return dot(v,v); }

float udTriangle( vec3 p, vec3 a, vec3 b, vec3 c )
{
    vec3 ba = b - a; vec3 pa = p - a;
    vec3 cb = c - b; vec3 pb = p - b;
    vec3 ac = a - c; vec3 pc = p - c;
    vec3 nor = cross( ba, ac );

    return sqrt(
        (sign(dot(cross(ba,nor),pa)) +
        sign(dot(cross(cb,nor),pb)) +
        sign(dot(cross(ac,nor),pc))<2.0)
    ?
    min( min(
        dot2(ba*clamp(dot(ba,pa)/dot(ba,ba),0.0,1.0)-pa),
        dot2(cb*clamp(dot(cb,pb)/dot(cb,cb),0.0,1.0)-pb) ),
        dot2(ac*clamp(dot(ac,pc)/dot(ac,ac),0.0,1.0)-pc) )
    :
    dot(nor,pa)*dot(nor,pa)/dot2(nor) );
}

Surface sdTriangle( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform) {
    // was heißt es bildlich, das auszukommentieren?
    p = (p - offset) * transform;

    vec3 v1 = vec3(b.x, 0., 0.);
    vec3 v2 = vec3(0., b.y, 0.);
    vec3 v3 = vec3(0., 0., b.z);
//
//    v1 = vec3(0., 0.5 - 0.5 * cos(iTime), 0.);
//    v2 = vec3(-1., 0., 0.);
//    v3 = vec3(0., -1., 0.);

    float d = udTriangle(p, v1, v2, v3);

    vec3 vx = v2 - v1; // Vektor von v1 nach v2
    vec3 vy = v3 - v1; // Vektor von v1 nach v3
    vec3 vp = p - v1; // Vektor von v1 nach p

    float lx2 = dot(vx, vx);
    float ly2 = dot(vy, vy);
    float dxy = dot(vx, vy);
    float lxy = lx2 * ly2 - dxy * dxy;
    float px = dot(vp, vx);
    float py = dot(vp, vy);

    float u = (ly2 * px - dxy * py) / lxy;
    float v = (lx2 * py - dxy * px) / lxy;

    vec2 uv = vec2(u, 1. - v);

    return Surface(d, col, MATERIAL_BOX, uv);
}

// Hash function for noise generation
float hash(vec2 n) {
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}

float hash14(vec4 p)
{
    uvec4 q = uvec4(ivec4(p)) * uvec4(1597334673U, 3812015801U, 2798796415U, 1979697957U);
    uint n = (q.x ^ q.y ^ q.z ^ q.w) * 1597334673U;
    return float(n) * 2.328306437080797e-10;
}

float hash14(vec2 p)
{
    // funny enough, with 0. the glitches stay.
    return hash14(vec4(p, 1., 1.));
}

// um schnell zwischen Hashfunktionen zu wechseln
#define HASH hash14

// "Value Noise" function
float noise(vec2 p){
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp); // this equals smoothstep (in the interval [0,1])
    // fp = fp * fp * fp * (fp * (fp * 6. - 15.) + 10.); // "smootherstep"

    return mix(
        mix(
            HASH(ip),
            HASH(ip+vec2(1.0,0.0)),
            fp.x
        ),
        mix(
            HASH(ip+vec2(0.0,1.0)),
            HASH(ip+vec2(1.0,1.0)),
            fp.x
        ),
        fp.y
    );
}

// Fractional Brownian Motion for low-frequency noise
#define FBM_ITERATIONS 10
float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for (int i = 0; i < FBM_ITERATIONS; i++) {
        f += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

float floorLevel = -5.;
float noiseHeight = 0.5; // was passiert bei zu hohen Werten, v.A. in Verbindung mit hohen FBM_ITERATIONS?
float noiseFreq = 0.4;

Surface sdFloor(vec3 p) {
    vec3 floorColor = vec3(1.);
    // bisher: wurde hier definiert -> man verfolge MATERIAL_FLOOR
    // floorColor = (0.5 + 0.15 * mod(floor(p.x) + floor(p.z), 4.0)) * vec3(0.9, 1., .95);
    vec2 floorUv = fract(p.xz); // fract() for texture wrapping, could scale like fract(0.25 * p.xz)
    float d = p.y - floorLevel;
    // flaches Terrain: exit here.
    // return Surface(d, floorColor, MATERIAL_FLOOR, floorUv);

    // wir machen es uns hier leicht -- was ist mit den Normalenvektoren?
    // -> mal diffuse lighting einschalten
    float someOffset = 5.3; // hashes sehen um 0 oft auffällig auf
    float noise = fbm(noiseFreq * p.xz + someOffset); // mal im Argument sowas wie... 0.03 * iTime ?
    float noisyLevel = floorLevel - noiseHeight * (noise - 0.5);
    d = p.y - noisyLevel;
    // Farbe mit noise skalieren -> bricht Regelmäßigkeit zusätzlich
    floorColor *= exp(-noise);

    // oder aber: Height Map / Bump Map als Textur reingeben.
//    vec2 st = clamp(0.033 * p.xz + vec2(.5,.8), vec2(0), vec2(1));
//    d += 3. * texture(iBumpMap, st).r;

    return Surface(d, floorColor, MATERIAL_FLOOR, floorUv);
}

Surface takeCloser(Surface obj1, Surface obj2) {
    if (obj2.sd < obj1.sd) {
        return obj2;
    }
    return obj1;
}

Surface sdScene(vec3 p) {
    Surface obj;
    Surface co = sdFloor(p);

    // NOTHING TO SEE HERE!

    return co;
}

void applyMaterial(inout Surface s, vec3 ray) {
    if (s.material == MATERIAL_BOX) {
        s.col *= texture(iTexture0, s.uv).rgb;
        // Bock auf Holz?
        float scale = 4.;
        vec3 holz = texture(iTexture2, s.uv / scale).rgb;
        // naive Farbmischung: mal mit Grundrechenarten rumprobieren.
        // s.col = holz;
        // s.col *= holz;
        // s.col = min(s.col, holz);
        // s.col = max(s.col, holz);
        // s.col = pow(s.col + holz, vec3(1.4));  // <-- etc... you know the drill
        // s.col = mix(s.col, holz, 0.5);
        // s.col = mix(s.col, holz, 0.5 - 0.5 * cos(iTime));
//         s.col = 1. - (1. - s.col) * (1. - holz); // "Screen"
        // "Overlay":
//        s.col = length(s.col) < 0.5
//            ? 2. * s.col * holz
//            : 1. - 2. * (1. - s.col) * (1. - holz);
//         s.col = s.col - holz + 2. * s.col * holz; // "Soft Light"
//         s.col = holz - s.col + 2. * s.col * holz; // "Soft Light", invers
    }
    else if (s.material == MATERIAL_FLOOR) {
        s.col *= (0.5 + 0.15 * mod(floor(ray.x) + floor(ray.z), 4.0)) * vec3(0.9, 1., .95);
    }
    s.col = clamp(s.col, vec3(0.), vec3(1.));
}

Surface rayMarch(vec3 ro, vec3 rd, float start, float end) {
    float rayLength = start; // rayLength is usually just called t
    Surface co;

    for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
        co = sdScene(ro + rayLength * rd);
        rayLength += co.sd;

        if (co.sd < PRECISION || rayLength > end) {
            break;
        }
    }

    co.sd = rayLength;
    return co;
}

float rayMarchShadow( in vec3 ro, in vec3 rd)
{
    float tMin = 0.05;
    float tMax = 3.;
    float w = 0.002;

    float d = 1.0;
    float t = tMin;

    for (int i=0; i < MAX_MARCHING_STEPS; i++)
    {
        float h = sdScene( ro + rd*t ).sd;
        d = min( d, h/(w*t) );
        t += h;

        if (d < PRECISION || t > tMax ) {
            break;
        }
    }

    //return res;

    d = clamp( d, 0.0, 1.0 );
    //return res;

    d = smoothstep(0., 1., d);
    return d;
}

vec3 calcNormal(in vec3 p) {
    vec2 epsilon = vec2(1.0, -1.0) * 0.0005;
    return normalize(
        epsilon.xyy * sdScene(p + epsilon.xyy).sd +
        epsilon.yyx * sdScene(p + epsilon.yyx).sd +
        epsilon.yxy * sdScene(p + epsilon.yxy).sd +
        epsilon.xxx * sdScene(p + epsilon.xxx).sd
    );
}
#define PI 3.14

#define NUM_LIGHTS 3
#define NUM_LIGHT_COLORS 3

#define CHECKER_FLOOR_MATERIAL_ID 0
#define LIGHT_BASE_MATERIAL_ID 1
#define NUM_MATERIALS (LIGHT_BASE_MATERIAL_ID + NUM_LIGHTS)

#define PERFORMANCE_MODE 0

#define INVALID_MATERIAL_ID int(-1)
#define LARGE_NUMBER 1e20
#define EPSILON 0.0001
#define MAX_SDF_SPHERE_STEPS 15
#define ABSORPTION_COEFFICIENT 0.5
#define CAST_VOLUME_SHADOW_ON_OPAQUES 1

#if PERFORMANCE_MODE
#define MAX_VOLUME_MARCH_STEPS 20
#define MAX_VOLUME_LIGHT_MARCH_STEPS 4
#define ABSORPTION_CUTOFF 0.25
#define MARCH_MULTIPLIER 1.8
#define LIGHT_ATTENUATION_FACTOR 2.0
#define MAX_OPAQUE_SHADOW_MARCH_STEPS 10
#else
#define MAX_VOLUME_MARCH_STEPS 50
#define MAX_VOLUME_LIGHT_MARCH_STEPS 25
#define ABSORPTION_CUTOFF 0.01
#define MARCH_MULTIPLIER 1.0
#define LIGHT_ATTENUATION_FACTOR 1.65
#define MAX_OPAQUE_SHADOW_MARCH_STEPS 25
#endif

#define UNIFORM_FOG_DENSITY 0
#define UNIFORM_LIGHT_SPEED 1

struct CameraDescription
{
    vec3 Position;
    vec3 LookAt;

    float LensHeight;
    float FocalDistance;
};

struct OrbLightDescription
{
    vec3 Position;
    float Radius;
    vec3 LightColor;
};

CameraDescription Camera = CameraDescription(
vec3(0, 70, -165),
vec3(0, 5, 0),
2.0,
7.0
);

vec3 GetLightColor(int lightIndex)
{
    switch(lightIndex % NUM_LIGHT_COLORS)
    {
        case 0: return vec3(1, 0.0, 1.0);
        case 1: return vec3(0, 1.0, 0.0);
    }
    return vec3(0, 0.0, 1.0);
}

OrbLightDescription GetLight(int lightIndex)
{
    const float lightMultiplier = 17.0f;
    #if UNIFORM_LIGHT_SPEED
    float theta = iTime * 0.7 + float(lightIndex) * PI * 2.0 / float(NUM_LIGHT_COLORS);
    float radius = 18.5f;
    #else
    float theta = iTime * 0.4 * (float(lightIndex) + 1.0f);
    float radius = 19.0f + float(lightIndex) * 2.0;
    #endif

    OrbLightDescription orbLight;
    orbLight.Position = vec3(radius * cos(theta), 6.0 + sin(theta * 2.0) * 2.5, radius * sin(theta));
    orbLight.LightColor = GetLightColor(lightIndex) * lightMultiplier;
    orbLight.Radius = 0.8f;

    return orbLight;
}

float GetLightAttenuation(float distanceToLight)
{
    return 1.0 / pow(distanceToLight, LIGHT_ATTENUATION_FACTOR);
}

// --------------------------------------------//
//               Noise Functions
// --------------------------------------------//
// Taken from Inigo Quilez's Rainforest ShaderToy:
// https://www.shadertoy.com/view/4ttSWf
float hash1( float n )
{
    return fract( n*17.0*fract( n*0.3183099 ) );
}

// Taken from Inigo Quilez's Rainforest ShaderToy:
// https://www.shadertoy.com/view/4ttSWf
float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 w = fract(x);

    vec3 u = w*w*w*(w*(w*6.0-15.0)+10.0);

    float n = p.x + 317.0*p.y + 157.0*p.z;

    float a = hash1(n+0.0);
    float b = hash1(n+1.0);
    float c = hash1(n+317.0);
    float d = hash1(n+318.0);
    float e = hash1(n+157.0);
    float f = hash1(n+158.0);
    float g = hash1(n+474.0);
    float h = hash1(n+475.0);

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

const mat3 m3  = mat3( 0.00,  0.80,  0.60,
-0.80,  0.36, -0.48,
-0.60, -0.48,  0.64 );

// Taken from Inigo Quilez's Rainforest ShaderToy:
// https://www.shadertoy.com/view/4ttSWf
float fbm_4( in vec3 x )
{
    float f = 2.0;
    float s = 0.5;
    float a = 0.0;
    float b = 0.5;
    for( int i=0; i<4; i++ )
    {
        float n = noise(x);
        a += b*n;
        b *= s;
        x = f*m3*x;
    }
    return a;
}

// Taken from https://iquilezles.org/articles/distfunctions
float sdPlane( vec3 p )
{
    return p.y;
}

// Taken from https://iquilezles.org/articles/distfunctions
vec2 opU( vec2 d1, vec2 d2 )
{
    return (d1.x<d2.x) ? d1 : d2;
}

// Taken from https://iquilezles.org/articles/distfunctions
float sdSmoothUnion( float d1, float d2, float k )
{
    float h = clamp( 0.5 + 0.5*(d2-d1)/k, 0.0, 1.0 );
    return mix( d2, d1, h ) - k*h*(1.0-h);
}

vec3 Translate(vec3 pos, vec3 translate)
{
    return pos -= translate;
}

// Taken from https://iquilezles.org/articles/distfunctions
float sdSphere( vec3 p, vec3 origin, float s )
{
    p = Translate(p, origin);
    return length(p)-s;
}

#define MATERIAL_IS_LIGHT_SOURCE 0x1
struct Material
{
    vec3 albedo;
    int flags;
};

Material NormalMaterial(vec3 albedo, int flags)
{
    return Material(albedo, flags);
}

bool IsLightSource(in Material m)
{
    return (m.flags & MATERIAL_IS_LIGHT_SOURCE) != 0;
}

Material GetMaterial(int materialID, vec3 position)
{
    Material materials[NUM_MATERIALS];
    materials[CHECKER_FLOOR_MATERIAL_ID] = NormalMaterial(vec3(0.6, 0.6, 0.7), 0);
    for(int lightIndex = 0; lightIndex < NUM_LIGHTS; lightIndex++)
    {
        materials[LIGHT_BASE_MATERIAL_ID + lightIndex] = NormalMaterial(GetLight(lightIndex).LightColor, MATERIAL_IS_LIGHT_SOURCE);
    }

    Material mat;
    if(materialID < int(NUM_MATERIALS))
    {
        mat = materials[materialID];
    }
    else
    {
        // Should never get hit
        return materials[0];
    }

    if(materialID == CHECKER_FLOOR_MATERIAL_ID)
    {
        vec2 uv = position.xz / 13.0;
        uv = vec2(uv.x < 0.0 ? abs(uv.x) + 1.0 : uv.x, uv.y < 0.0 ? abs(uv.y) + 1.0 : uv.y);
        if((int(uv.x) % 2 == 0 && int(uv.y) % 2 == 0) || (int(uv.x) % 2 == 1 && int(uv.y) % 2 == 1))
        {
            mat.albedo = vec3(1, 1, 1) * 0.7;
        }
    }

    return mat;
}

// https://www.scratchapixel.com/lessons/3d-basic-rendering/minimal-ray-tracer-rendering-simple-shapes/ray-plane-and-ray-disk-intersection
float PlaneIntersection(vec3 rayOrigin, vec3 rayDirection, vec3 planeOrigin, vec3 planeNormal, out vec3 normal)
{
    float t = -1.0f;
    normal = planeNormal;
    float denom = dot(-planeNormal, rayDirection);
    if (denom > EPSILON) {
        vec3 rayToPlane = planeOrigin - rayOrigin;
        return dot(rayToPlane, -planeNormal) / denom;
    }

    return t;
}

float SphereIntersection(
in vec3 rayOrigin,
in vec3 rayDirection,
in vec3 sphereCenter,
in float sphereRadius,
out vec3 normal)
{
    vec3 eMinusC = rayOrigin - sphereCenter;
    float dDotD = dot(rayDirection, rayDirection);

    float discriminant = dot(rayDirection, (eMinusC)) * dot(rayDirection, (eMinusC))
    - dDotD * (dot(eMinusC, eMinusC) - sphereRadius * sphereRadius);

    if (discriminant < 0.0)
    return -1.0;

    float firstIntersect = (dot(-rayDirection, eMinusC) - sqrt(discriminant))
    / dDotD;

    float t = firstIntersect;

    normal = normalize(rayOrigin + rayDirection * t - sphereCenter);
    return t;
}


void UpdateIfIntersected(
inout float t,
in float intersectionT,
in vec3 intersectionNormal,
in int intersectionMaterialID,
out vec3 normal,
out int materialID
)
{
    if(intersectionT > EPSILON && intersectionT < t)
    {
        normal = intersectionNormal;
        materialID = intersectionMaterialID;
        t = intersectionT;
    }
}

float IntersectOpaqueScene(in vec3 rayOrigin, in vec3 rayDirection, out int materialID, out vec3 normal)
{
    float intersectionT = LARGE_NUMBER;
    vec3 intersectionNormal = vec3(0, 0, 0);

    float t = LARGE_NUMBER;
    normal = vec3(0, 0, 0);
    materialID = INVALID_MATERIAL_ID;

    for(int lightIndex = 0; lightIndex < NUM_LIGHTS; lightIndex++)
    {
        UpdateIfIntersected(
        t,
        SphereIntersection(rayOrigin, rayDirection, GetLight(lightIndex).Position, GetLight(lightIndex).Radius, intersectionNormal),
        intersectionNormal,
        LIGHT_BASE_MATERIAL_ID + lightIndex,
        normal,
        materialID);
    }


    UpdateIfIntersected(
    t,
    PlaneIntersection(rayOrigin, rayDirection, vec3(0, 0, 0), vec3(0, 1, 0), intersectionNormal),
    intersectionNormal,
    CHECKER_FLOOR_MATERIAL_ID,
    normal,
    materialID);


    return t;
}

float QueryVolumetricDistanceField( in vec3 pos)
{
    // Fuse a bunch of spheres, slap on some fbm noise,
    // merge it with ground plane to get some ground fog
    // and viola! Big cloudy thingy!
    vec3 fbmCoord = (pos + 2.0 * vec3(iTime, 0.0, iTime)) / 1.5f;
    float sdfValue = sdSphere(pos, vec3(-8.0, 2.0 + 20.0 * sin(iTime), -1), 5.6);
    sdfValue = sdSmoothUnion(sdfValue,sdSphere(pos, vec3(8.0, 8.0 + 12.0 * cos(iTime), 3), 5.6), 3.0f);
    sdfValue = sdSmoothUnion(sdfValue, sdSphere(pos, vec3(5.0 * sin(iTime), 3.0, 0), 8.0), 3.0) + 7.0 * fbm_4(fbmCoord / 3.2);
    sdfValue = sdSmoothUnion(sdfValue, sdPlane(pos + vec3(0, 0.4, 0)), 22.0);
    return sdfValue;
}

float IntersectVolumetric(in vec3 rayOrigin, in vec3 rayDirection, float maxT)
{
    // Precision isn't super important, just want a decent starting point before
    // ray marching with fixed steps
    float precis = 0.5;
    float t = 0.0f;
    for(int i=0; i<MAX_SDF_SPHERE_STEPS; i++ )
    {
        float result = QueryVolumetricDistanceField( rayOrigin+rayDirection*t);
        if( result < (precis) || t>maxT ) break;
        t += result;
    }
    return ( t>=maxT ) ? -1.0 : t;
}

vec3 Diffuse(in vec3 normal, in vec3 lightVec, in vec3 diffuse)
{
    float nDotL = dot(normal, lightVec);
    return clamp(nDotL * diffuse, 0.0, 1.0);
}

vec3 GetAmbientLight()
{
    return 1.2 * vec3(0.03, 0.018, 0.018);
}

float GetFogDensity(vec3 position, float sdfDistance)
{
    const float maxSDFMultiplier = 1.0;
    bool insideSDF = sdfDistance < 0.0;
    float sdfMultiplier = insideSDF ? min(abs(sdfDistance), maxSDFMultiplier) : 0.0;

    #if UNIFORM_FOG_DENSITY
    return sdfMultiplier;
    #else
    return sdfMultiplier * abs(fbm_4(position / 6.0) + 0.5);
    #endif
}

float BeerLambert(float absorption, float dist)
{
    return exp(-absorption * dist);
}

float GetLightVisiblity(in vec3 rayOrigin, in vec3 rayDirection, in float maxT, in int maxSteps, in float marchSize)
{
    float t = 0.0f;
    float lightVisibility = 1.0f;
    float signedDistance = 0.0;
    for(int i = 0; i < maxSteps; i++)
    {
        t += max(marchSize, signedDistance);
        if(t > maxT || lightVisibility < ABSORPTION_CUTOFF) break;

        vec3 position = rayOrigin + t*rayDirection;

        signedDistance = QueryVolumetricDistanceField(position);
        if(signedDistance < 0.0)
        {
            lightVisibility *= BeerLambert(ABSORPTION_COEFFICIENT * GetFogDensity(position, signedDistance), marchSize);
        }
    }
    return lightVisibility;
}


float Luminance(vec3 color)
{
    return (color.r * 0.3) + (color.g * 0.59) + (color.b * 0.11);
}

bool IsColorInsignificant(vec3 color)
{
    const float minValue = 0.009;
    return Luminance(color) < minValue;
}

void CalculateLighting(vec3 position, vec3 normal, vec3 reflectionDirection, Material material, inout vec3 color)
{
    for(int lightIndex = 0; lightIndex < NUM_LIGHTS; lightIndex++)
    {
        vec3 lightDirection = (GetLight(lightIndex).Position - position);
        float lightDistance = length(lightDirection);
        lightDirection /= lightDistance;

        vec3 lightColor = GetLight(lightIndex).LightColor * GetLightAttenuation(lightDistance);

        float lightVisiblity = 1.0;
        #if CAST_VOLUME_SHADOW_ON_OPAQUES
        if(!IsColorInsignificant(lightColor))
        {
            const float shadowMarchSize = 0.65f * MARCH_MULTIPLIER;
            lightVisiblity = GetLightVisiblity(position, lightDirection, lightDistance, MAX_OPAQUE_SHADOW_MARCH_STEPS, shadowMarchSize);
        }
        #endif

        color += lightVisiblity * lightColor * pow(max(dot(reflectionDirection, lightDirection), 0.0), 4.0);
        color += lightVisiblity * lightColor * Diffuse(normal, lightDirection, material.albedo);

    }
    color += GetAmbientLight() * material.albedo;
}

vec3 renderCloud( in vec3 rayOrigin, in vec3 rayDirection)
{
    float depth = LARGE_NUMBER;
    vec3 opaqueColor = vec3(0.0f);

    vec3 normal;
    float t;
    int materialID = INVALID_MATERIAL_ID;
    t = IntersectOpaqueScene(rayOrigin, rayDirection, materialID, normal);
    if( materialID != INVALID_MATERIAL_ID )
    {
        // Defer lighting calculations after volume lighting so we can
        // avoid doing shadow tracing on opaque objects that aren't visible anyways
        depth = t;
    }

    float volumeDepth = IntersectVolumetric(rayOrigin, rayDirection, depth);
    float opaqueVisiblity = 1.0f;
    vec3 volumetricColor = vec3(0.0f);
    if(volumeDepth > 0.0)
    {
        const vec3 volumeAlbedo = vec3(0.8);
        const float marchSize = 0.6f * MARCH_MULTIPLIER;
        float distanceInVolume = 0.0f;
        float signedDistance = 0.0;
        for(int i = 0; i < MAX_VOLUME_MARCH_STEPS; i++)
        {
            volumeDepth += max(marchSize, signedDistance);
            if(volumeDepth > depth || opaqueVisiblity < ABSORPTION_CUTOFF) break;

            vec3 position = rayOrigin + volumeDepth*rayDirection;

            signedDistance = QueryVolumetricDistanceField(position);
            if(signedDistance < 0.0f)
            {
                distanceInVolume += marchSize;
                float previousOpaqueVisiblity = opaqueVisiblity;
                opaqueVisiblity *= BeerLambert(ABSORPTION_COEFFICIENT * GetFogDensity(position, signedDistance), marchSize);
                float absorptionFromMarch = previousOpaqueVisiblity - opaqueVisiblity;

                for(int lightIndex = 0; lightIndex < NUM_LIGHTS; lightIndex++)
                {
                    float lightVolumeDepth = 0.0f;
                    vec3 lightDirection = (GetLight(lightIndex).Position - position);
                    float lightDistance = length(lightDirection);
                    lightDirection /= lightDistance;

                    vec3 lightColor = GetLight(lightIndex).LightColor * GetLightAttenuation(lightDistance);
                    if(IsColorInsignificant(lightColor)) continue;

                    const float lightMarchSize = 0.65f * MARCH_MULTIPLIER;
                    float lightVisiblity = GetLightVisiblity(position, lightDirection, lightDistance, MAX_VOLUME_LIGHT_MARCH_STEPS, lightMarchSize);
                    volumetricColor += absorptionFromMarch * lightVisiblity * volumeAlbedo * lightColor;
                }
                volumetricColor += absorptionFromMarch * volumeAlbedo * GetAmbientLight();
            }
        }
    }

    if( materialID != INVALID_MATERIAL_ID && opaqueVisiblity > ABSORPTION_CUTOFF)
    {
        vec3 position = rayOrigin + t*rayDirection;
        Material material = GetMaterial(materialID, position);
        if(IsLightSource(material))
        {
            opaqueColor = min(material.albedo, vec3(1.0));
        }
        else
        {
            vec3 reflectionDirection = reflect( rayDirection, normal);
            CalculateLighting(position, normal, reflectionDirection, material, opaqueColor);
        }
    }

    return min(volumetricColor, 1.0f) + opaqueVisiblity * opaqueColor;
}

void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    // firstCubePos += 0.25 * cursorWalk;

    vec4 bgColor = vec4(0.8, 0.8, 1., 1.);

    vec4 col = vec4(0.);
    float d;

    vec3 ro = vec3(0., 0., 1.) + 0.25 * cursorWalk;
    float fov = 45. * pi / 180.; // Angabe 80°C üblicher für Field-of-View ~ entspricht inverser Brennweite
    float uvz = -1. / tan(fov / 2.);
    vec3 rd = normalize(vec3(uv, uvz));
    rd *= rotateX(-0.1 * pi);
    // rd *= rotateY(0.02 * sin(3. * iTime));

    Surface co = rayMarch(ro, rd, MIN_DIST, MAX_DIST);

    if (co.sd < MAX_DIST) {
        vec3 p = ro + rd * co.sd;
        applyMaterial(co, p);

        vec3 normal = calcNormal(p);
        vec3 lightPosition = vec3(1.5, 3., 2.);
        lightPosition.x += 5. * cos(iTime);
        lightPosition.z += 3. * sin(iTime);
        vec3 lightDirection = normalize(lightPosition - p);

        float lightArea = clamp(dot(rd, lightDirection), 0., 1.);

        // lightDirection = normalize(vec3(2. * cos(iTime), 0.5, 0.));
        // lightDirection = normalize(vec3(0., 1., 0.));

        // Erinnerung: _irgendwie_ muss Abstand "d" zu einer Farbe werden.
        // wie, sind quasi nur noch die Details :)
        d = pow(co.sd, 0.5);
        d = clamp(d, 0., 1.);

        // could also have parallel light
//        lightDirection = normalize(vec3(0., 1., 0.));

        // Lambertian reflection:
        // proportional to amount of light hitting the surface
        // i.e. dot(normal, lightDir) ~ large if Angle between normal and light is low
        // Quasi "perfekte" Diffusion, warum?
        float diffuse = dot(normal, lightDirection);
        diffuse = clamp(diffuse, 0., 1.);
        d = mix(d, diffuse, 1.);

        // sekundäres Ray Marching für Schatten
        float shadow = rayMarchShadow(p, lightDirection);
        d = mix(d, shadow, 0.8);

        // Specular reflection:
        // proportional to angle between ray and reflections
        vec3 refl = reflect(lightDirection, normal);
        float specular = dot(refl, normalize(p));
        specular = clamp(specular, 0., 1.);
        specular = 0.8 * pow(specular, 3.);
        d = mix(d, specular, 0.5);


        // verschiedenartiges Color Grading
        // col.xyz = pow(co.sd, 0.1) * co.col;

        col.xyz = pow(d, 0.1) * co.col;

        //        dif = mix(dif, co.sd, 0.03);
        //        dif = mix(dif, dif * co.sd, 0.24);
        //        float clamped_dif = clamp(dif, 0., 1.);
        //        float graded_dif = atan(dif);
        //        dif = mix(clamped_dif, graded_dif, 1.);
        //        dif = pow(dif, 2.);

        // aufhellen, je mehr Blick Richtung Licht
        //col.xyz = mix(col.xyz, vec3(1), pow(clamp(dot(p, lightDirection), 0., 1.), 100.));
        // float richtungInsLicht = clamp(dot(rd, lightPosition - ro), 0., 1.);
        // col.xyz *= exp(-1. * (1. - richtungInsLicht));

        col.xyz = mix(col.xyz, vec3(1), pow(lightArea, 9.));

        // Distance Fog: Abschwächen je nach durchlaufenem Abstand
        float fog = exp(-0.00001 * pow(co.sd, 1.));
        col.xyz *= fog;
        col.a = 1.;
    }

    fragColor = mix(bgColor, vec4(col.xyz, 1.), col.a);

    vec3 cloud = renderCloud(ro, rd);
    cloud = pow(cloud, vec3(-0.4));
    fragColor.xyz = clamp(cloud, vec3(0), vec3(1));

    // Post Processing - Vignette - hier ohne zweiten Pass
    vec3 post = fragColor.xyz;
    post *= exp( -0.03 * pow(length(uv), 5.7));
    post = clamp(post, 0.0, 1.0);
    post = pow(post, vec3(0.7));
    post = post * 0.4 + 0.6 * smoothstep(vec3(0), vec3(1), post) + vec3(0.0,0.0,0.04);

    fragColor.xyz = post;

}
