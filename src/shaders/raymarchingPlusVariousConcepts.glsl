#version 300 es

// based on: https://www.shadertoy.com/view/Xds3zN
// simplified for our lecture (cf. raymarchingFirstSteps.glsl)
// then put some more basic concepts for 3D in here.

precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform sampler2D texFrame;
uniform sampler2D texSpace;
uniform sampler2D texRock;
uniform vec3 iCamOffset;
uniform vec3 iCamLookOffset;
uniform float iCamRoll;
uniform float iCamFocalLength;
uniform float iPathSpeed;
uniform float iPathOffset;
uniform vec3 vecDirectionalLight;
uniform float iDirectionalLightStrength;
uniform float iPointLightStrength;
uniform float iLightSourceMix;
uniform float iLightPointPaletteColor;
uniform float iDiffuseAmount;
uniform float iSpecularAmount;
uniform float iSpecularExponent;
uniform float iBacklightAmount;
uniform float iSubsurfaceAmount;
uniform float iSubsurfaceExponent;
uniform float iAmbientOcclusionScale;
uniform float iAmbientOcclusionStep;
uniform float iAmbientOcclusionSamples;
uniform float iToneMapExposure;
uniform float iToneMapACESMixing;
uniform float iGammaExponent;
uniform float iNoiseLevel;
uniform float iNoiseFreq;
uniform float iNoiseOffset;
uniform int iFractionalOctaves;
uniform float iFractionalLacunarity;
// toggle options
uniform bool doShowPointLightSource;
uniform bool doUseCameraPath;
uniform bool doShowCameraPathPoints;
uniform bool doUseCameraTargetPath; // try it :)
uniform bool drawGridOnFloor;
uniform bool justTheBoxes;
uniform bool showPyramidTextureGrid;
uniform bool applyPyramidTextureNarrowing;
uniform bool applyPyramidTextureSkewing;
uniform bool applyPyramidTextureTopDown;
uniform bool usePyramidTextureFromBoxes;
// and for you to play around with:
uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;
uniform float iFree5;
uniform vec3 vecFree0;
uniform vec3 vecFree1;
uniform vec3 vecFree2;

const float pi = 3.141593;
const float twoPi = 2. * pi;
const float piHalf = .5 * pi;
const vec4 c = vec4(1., 0. , -1., .5);

const float MISSING_MATERIAL = -0.5;
const float UNKNOWN_MATERIAL = 0.0;
const float MATERIAL_FLOOR = 1.0;
const float MATERIAL_BOX = 3.0;
const float MATERIAL_CYLINDER = 8.0;
const float MATERIAL_PYRAMID = 13.0;
const float MATERIAL_MOUNTAINS = 2.0;
const float MATERIAL_PATH_POINT = 1.4;

/////////////////////////

const int nPath = 7;
vec3 camPosPath[nPath] = vec3[nPath](
    vec3(-0.75, 1.5, 3.),
    vec3(-0., 1.0, 1.8),
    vec3(0.5, 0.25, 1.25),
    vec3(-0.3, 0.7, -3.3),
    vec3(-2.3,0.73, -1.3),
    vec3(1.7, 0.4, -3.0),
    vec3(1.5, 0.8, 2.1)
);

vec4 targetPath[nPath] = vec4[nPath](
    vec4(-0.3, 1., 1.7, 0.),
    vec4(-0.3, 0.35, 1.05, 0.),
    vec4(-0.3, 0.65, -3.3, -.2),
    vec4(-2.,0.73, -1.3, 2.),
    vec4(0.6, 0.5, -0.8, 3.1),
    vec4(0.1, 0.0, 0.1, 0.),
    vec4(-0.75, 1.5, 3., -1.)
);

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

mat2 rot2D(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(
        c, s,
       -s, c
    );
}

mat3 squeezeY(float sqY) {
    float sqXZ = 1./sqY;
    return mat3(
         sqXZ,  0.,   0.,
           0., sqY,   0.,
           0.,  0., sqXZ
    );
}

vec2 hash22(vec2 p) {
    // this is a pseudorandom generator with 2d input -> 2d output
    float n = sin(dot(p, vec2(127.1, 311.7))) * 43758.5453;
    // custom phase shift just to have more variation, is not commonly used
    n += iNoiseOffset;
    return fract(vec2(n, n * 1.2154));
}

float voronoiPattern(vec2 uv, bool returnCellBorders) {
    const float scale = 10.;
    uv *= scale;
    vec2 uvInt = floor(uv);
    vec2 uvFrac = fract(uv);
    float dMin = 1.0;
    float dSecondMin = 1.0;
    for (float y = -1.; y < 1.01; y += 1.) {
        for (float x = -1.; x < 1.01; x += 1.) {
            vec2 b = vec2(x, y);
            vec2 r = b + hash22(uvInt + b + iNoiseOffset) - uvFrac;
            float d = length(r);
            if (d < dMin) {
                dSecondMin = dMin;
                dMin = d;
            } else if (d < dSecondMin) {
                dSecondMin = d;
            }
        }
    }
    // Manchmal will man die Voronoi-Zellen selbst, manchmal ihre Grenzen:
    return (
        returnCellBorders
            ? dSecondMin - dMin
            : dMin
    );
}

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
    const float iFractionalScale = 2.;
    // Gewöhnliche Parameter:
    // iFractionalOctaves ~ 3-6
    // iFractionalLacunarity = 0.5;
    // ihr könnt auch iFractionalScale mal durchvariieren (z.B. mal 3.)
    // aber da sind viele Werte nicht zu viel zu gebrauchen.
    for (int i = 0; i < iFractionalOctaves; i++) {
        v += a * perlin2D(p);
        s += a;
        p = p * iFractionalScale;
        a *= iFractionalLacunarity;
    }
    return v / s;
}

float gridPattern(vec2 p, float gridStep) {
    p /= gridStep;
    const float lineWidth = 0.6;
    float threshold = 1. - gridStep * lineWidth;
    return 1. - abs(step(threshold, fract(p.x)) - step(threshold, fract(p.y)));
}

float bounceParabola(float h, float g, float T, float t) {
    t = fract(t/T) - 0.5;
    t *= -g*t;
    t += h + 0.25*g;
    return t;
}

void applyToneMapping(inout vec3 col) {
    // "Tone Mapping" ist der allgemeine Begriff des nachträglichen Verschiebens der
    // RGB-Werte (auf alle Farbkanäle gleichermaßen oder auch unterschiedlich).
    // Oft dient das dazu, die Werte erstmal in den Bereich [0..1] zu bekommen;
    // eine Gammakorrektur wird dann danach ausgeführt weil deren Potenzfunktion dann
    // innerhalb dieses Bereichs das Minimum (0) und Maximum (1) unverändert lässt.
    // ... ob man "Gamma" auch als "Tone Mapping" betrachtet oder nicht, ist streitbar.
    // Es hängt m.E. davon ab, ob man es aus künstlerischer Entscheidung macht,
    // oder ob man den Verlauf des darstellenden Bildschirms / Beamers kompensieren will.

    // Beispiel: "ACES Filmic Curve" ist eine Wahl einer allgemeinen Form
    // col = (a * col² + b * col + c) / (d * col² + e * col + f)
    vec3 col2 = col * col;
    vec3 acesToneMapped = (2.51*col2 + 0.03*col) / (2.43*col2 + 0.59*col + 0.14);
    col = mix(col, acesToneMapped, iToneMapACESMixing);

    // "Exposure Mapping" wäre auch eine relativ simple Form von Tone Mapping
    // col = c.xxx - exp(-col * iToneMapExposure);

    // Zum Veranschaulichen:
    // https://graphtoy.com/?f1(x,t)=(x*(2.51*x%20+%200.03))%20/%20(x*(2.43*x%20+%200.59)%20+%200.14)&v1=true&f2(x,t)=pow(x,%201/2.2)&v2=true&f3(x,t)=&v3=true&f4(x,t)=&v4=false&f5(x,t)=&v5=false&f6(x,t)=&v6=false&grid=1&coords=1.0460698031714766,0.8942233204121067,2.158305478910581

    // Andere Mappings findet man z.B. leicht unter den Namen
    // - Reinhard Tone Mapping
    // - John Hable Uncharted 2 Filmic Mapping
}

void applyGammaCorrection(inout vec3 col) {
    col = pow(col, vec3(1./iGammaExponent));
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

float sdEllipsoid( in vec3 p, in vec3 r ) // approximated
{
    float k0 = length(p/r);
    float k1 = length(p/(r*r));
    return k0*(k0-1.0)/k1;
}

float sdTorus( vec3 p, vec2 t )
{
    return length( vec2(length(p.xz)-t.x,p.y) )-t.y;
}

float sdPyramid( in vec3 p, in float h )
{
    float m2 = h*h + 0.25;

    // symmetry
    p.xz = abs(p.xz);
    p.xz = (p.z>p.x) ? p.zx : p.xz;
    p.xz -= 0.5;

    // project into face plane (2D)
    vec3 q = vec3( p.z, h*p.y - 0.5*p.x, h*p.x + 0.5*p.y);

    float s = max(-q.x,0.0);
    float t = clamp( (q.y-0.5*p.z)/(m2+0.25), 0.0, 1.0 );

    float a = m2*(q.x+s)*(q.x+s) + q.y*q.y;
    float b = m2*(q.x+0.5*t)*(q.x+0.5*t) + (q.y-m2*t)*(q.y-m2*t);

    float d2 = min(q.y,-q.x*m2-q.y*0.5) > 0.0 ? 0.0 : min(a,b);

    // recover 3D and scale, and add sign
    return sqrt( (d2+q.z*q.z)/m2 ) * sign(max(q.z,-p.y));;
}

float sdU( in vec3 p, in float r, in float le, vec2 w )
{
    p.x = (p.y>0.0) ? abs(p.x) : length(p.xy);
    p.x = abs(p.x-r);
    p.y = p.y - le;
    float k = max(p.x,p.y);
    vec2 q = vec2( (k<0.0) ? -k : length(max(p.xy,0.0)), abs(p.z) ) - w;
    return length(max(q,0.0)) + min(max(q.x,q.y),0.0);
}

struct MarchHit {
    float t;
    float material;
    vec2 texCoord;
};

MarchHit texturedSdSphere(vec3 p, float s)
{
    float d = length(p) - s;
    // hint: https://de.wikipedia.org/wiki/Kugelkoordinaten
    vec2 surfaceCoord = vec2(
        atan(p.z, p.x) / twoPi + 0.5,
        p.y / 2. + 0.5
    );
    return MarchHit(d, UNKNOWN_MATERIAL, surfaceCoord);
}

MarchHit texturedSdBox( vec3 p, vec3 b, float rounding) {
    vec3 q = abs(p) - b;
    b.x -= rounding;
    b.y -= rounding;
    b.z -= rounding;
    float d = length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    d -= 2. * rounding;

    // Koordinatentransformation:
    // Um Textur zuzuordnen, müssen wir uns nochmal "in den Würfel hineinversetzen."
    // - In seinem eigenen Koordinatensystem rotiert er nicht,
    // - die Mitte ist nicht bei p (Weltkoordinaten), sondern bei vec3(0)
    // - und auch die Skalierung (b) für seine prinzipielle Würfelhaftigkeit egal.
    vec3 a = 0.5 * p / b;
    // damit geht der Würfel in jeder Dimension von einer Wand bei -0.5 zu einer bei +0.5

    vec2 st;
    // Um Zuordnung zu verstehen, könnt ihr hier mal Teile auskommentieren und vergleichen.
    if (abs(a.z) > 0.5) {
        st = vec2(0.5 + a.x * sign(a.z), 0.5 - a.y);
    } else if (abs(a.y) > 0.5) {
        st = vec2(0.5 + a.x, 0.5 + a.z * sign(a.y));
    } else if (abs(a.x) > 0.5) {
        st = vec2(0.5 - a.z * sign(a.x), 0.5 - a.y);
    }
    // Reminder: if() generell überdenken, aber das reicht auch,
    // wenn irgendwo konkret ein Performanceproblem vorliegt.

    // kompaktere, weniger direkt ersichtliche Version:
    //    uv = mix(
    //        mix(
    //            vec2(0.5 + a.x * sign(a.z), 0.5 - a.y),
    //            vec2(0.5 + a.x * sign(a.y), 0.5 + a.z),
    //            step(0.5, abs(a.y))
    //        ),
    //        vec2(0.5 - a.z * sign(a.x), 0.5 - a.y),
    //        step(0.5, abs(a.x))
    //    );

    return MarchHit(d, MATERIAL_BOX, st);
}

float sdCylinder( vec3 p, vec2 h )
{
    // vertical ~ along y-axis
    vec2 d = abs(vec2(length(p.xz),p.y)) - h;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

MarchHit texturedSdCylinder(vec3 p, vec2 h) {
    // Analog mit Zylinder -- SDF ist bekannt (s.o.), bzw.
    // ist ein Zylinder ja in einer Ebene wie ein Kreis, in den anderen wie ein Rechteck
    // womit sich diese SDF erklärt:
    float radius = length(p.xz);
    vec2 q = abs(vec2(radius,p.y)) - h;
    float d = min(max(q.x,q.y),0.0) + length(max(q,0.0));
    // nun aber...
    float s = atan(p.z / h.x, p.x / h.x) / twoPi + 0.5;
    float t = 0.5 * p.y / h.y + 0.5;
    return MarchHit(d, MATERIAL_CYLINDER, vec2(s, t));
}

float sdNoiseMountains(vec3 p) {
    float height = max(0., length(p.xz) - 3.);
    // <-- -3. damit mittlere Arena ungestört bleibt
    height *= height * 0.2;
    height *= iNoiseLevel * (1. + fractalBrownianMotion(p.xz * iNoiseFreq));
    return p.y - height;
}

//------------------------------------------------------------------

// opUnion ist eine der "Primitive combinations" für SDFs
// https://iquilezles.org/articles/distfunctions/
// i.e. einerseits könnt ihr damit aus einfacheren Geometrien komplexere zusammensetzen,
//      aber auch aus separaten Objekten die gesamte Szene zusammensetzen.
// -> Es gibt bei Herrn Quilezles auch opSubtraction, opIntersection, opXor,
//    aber opUnion ist am einfachsten beschrieben:
//    "Auf der Suche nach der geringsten SDF... nehmen wir von zwei SDFs die kleinere von beiden".
// -> Wenn man dann noch im Ergebnis (MarchHit) etwas mitführt, das Aufschluss über den
//    getroffenenen Körper gibt, können wir später Farbe, Textur, Beleuchtung dranmappen.

vec2 opUnion( vec2 d1, vec2 d2 )
{
    return (d1.x<d2.x) ? d1 : d2;
}

// Auf MarchHit erweiterte Versionen von opUnion, bei der Gelegenheit gleich umbenannt:

MarchHit takeCloser(MarchHit d1, MarchHit d2)
{
    if (d1.t < d2.t) {
        return d1;
    }
    return d2;
}

MarchHit takeCloser( MarchHit d1, float d2, float material2)
{
    if (d1.t < d2) return d1;
    // haben kein Wissen über texCoord:
    return MarchHit(d2, material2, c.yy);
}

const vec3 pyramidPos = vec3(-1.0, 0.0, -2.6);
const float pyramidHeight = 1.1;

MarchHit map( in vec3 pos )
{
    // flacher Boden auf y == 0
    MarchHit res = MarchHit(pos.y, MATERIAL_FLOOR, c.yy);

    float floorY = sdNoiseMountains(pos - vec3(0.8,0.0,-1.6));
    res = takeCloser(res,
        MarchHit(floorY, MATERIAL_MOUNTAINS, fract(pos.xz))
    );

    // texturedSdBox: sdBox erweitert um die Aufprallkoordinate des Strahls,
    // um später die Textur abbilden zu können. Lässt sich beim Quader noch überschauen...
    res = takeCloser(res,
        texturedSdBox(pos-vec3( -.5,0.2, 0.0), vec3(0.5,0.2,0.5), 0.02)
    );
    res = takeCloser(res,
        texturedSdBox(rotY(0.1 * iTime)*(pos-vec3(1.32,0.4,-0.8)), vec3(0.5,0.4,0.3), 0.0)
    );

    if (justTheBoxes) {
        return res;
    }

    // das hier ist im Kern weiterhin die "Kette an opUnion(...)" von letztem Mal,
    // aber weniger Objekte, und umformuliert, weil MarchHit() jetzt mehr ist als "vec2":

    res = takeCloser(res,
        sdTorus((pos-vec3( .5,0.30, 1.0)).xzy, vec2(0.25,0.05)),
        7.1
    );
    res = takeCloser(res,
        sdTorus((pos-vec3(-0.89,0.33, -1.5)).yxz, vec2(0.25,0.05)),
        11.7
    );
    res = takeCloser(res,
        sdTorus((pos-vec3(0.5,0.30,-2.5)).xzy, vec2(0.25,0.05)),
        17.5
    );
    // <-- man beachte die 90°-Drehung über das Vektor-Swizzling (= Richtungen vertauschen)

    res = takeCloser(res,
        sdPyramid(pos - pyramidPos.xyz, pyramidHeight),
        MATERIAL_PYRAMID
    );

    // Mal ein Beispiel einer ungewöhnlichen Transformation, die wir aber (behaupte ich)
    // durchaus Stück für Stück verstehen können, da wir die Einzelteile schon alle hatten.
    {
        float sphereRadius = 0.25;
        vec3 spherePos = vec3(2., sphereRadius, 0.4);
        float bounceY = bounceParabola(0.9, 3., 2., iTime) - 1.2;
        float squeeze = -min(0., bounceY) + 1.;
        spherePos.y += max(0., bounceY);
        mat3 transformMatrix = squeezeY(squeeze);
        float squeezedGap = (1. - 1./squeeze) * sphereRadius;
        spherePos.y -= squeezedGap;

        vec3 transformed = transformMatrix * (pos - spherePos);
        // nonlinear squeeze
        transformed.xz /= (1. - (squeeze - 1.) * 2. * (transformed.y - sphereRadius));

        res = takeCloser(res,
            sdSphere(transformed, sphereRadius),
            24.9 - 1. * squeeze
        );

        // Erklärung:
        // sich wiederholende Parabel (s. https://de.wikipedia.org/wiki/Wurfparabel),
        // aber alles < 0 wird nicht auf die y-Koordinate berechnet, sondern zum "squeeze".
        // squeezeY() ist eine Transformationsmatrix, die zu einer Verzerrung / Stauchung führ.
        // Die Stauchung schafft dann wieder einen Spalt zum Boden, der noch abgezogen wird
        // Außerdem geben wir den "squeeze"-Wert über den Material-Parameter in die Farbe
    }

    vec3 cylinderPos = (pos-vec3( 1.0,0.35,-2.0));
    // Eulerwinkel-Drehung am Beispiel des Zylinders:
    // (sieht man gut, wenn man den Pfad mit iPathOffset so wählt
    cylinderPos *= rotY(2.0*iTime + 0.25); // dreht um eigene Achse
    cylinderPos *= rotZ(0.0*iTime);
    cylinderPos *= rotY(0.0*iTime);
    res = takeCloser(res,
        texturedSdCylinder(cylinderPos, vec2(0.15,0.25))
    );

    // render the path points for debugging
    if (doShowCameraPathPoints)
    for (int p = 0; p < nPath; p++) {
        res = takeCloser(res,
            MarchHit(
                sdSphere(pos - camPosPath[p].xyz, 0.015 - 0.005 * cos(12. * iTime)),
                MATERIAL_PATH_POINT,
                vec2(float(p), 0.) // <-- Zweckentfremdung von texCoord für Unterscheidung :)
            )
        );

    }


    return res;
}

// https://iquilezles.org/articles/boxfunctions
vec2 iBox( in vec3 ro, in vec3 rd, in vec3 rad )
{
    vec3 m = 1.0/rd;
    vec3 n = m*ro;
    vec3 k = abs(m)*rad;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    return vec2( max( max( t1.x, t1.y ), t1.z ),
    min( min( t2.x, t2.y ), t2.z ) );
}

MarchHit raycast( in vec3 ro, in vec3 rd )
{
    MarchHit res = MarchHit(-1.0, MISSING_MATERIAL, c.yy);

    float tmin = 0.1; // war letzte Woche noch 1.0: wird richtig hässlich beim bewegen :)
    float tmax = 20.0;

    // raytrace floor plane (Ebene y==0, also Sichtstrahl = Kante eines einfaches Dreiecks)
    float tp1 = (0.0-ro.y)/rd.y;
    if (tp1>0.0)
    {
        // hier erstmal für den Bereich außerhalb der Bounding Box, wohlgemerkt.
        tmax = min( tmax, tp1 );
        res = MarchHit(tp1, MATERIAL_FLOOR, c.yy);
    }

    // raymarch primitives
    // vec2 boundingBox = iBox( ro-vec3(0.0,1.,-0.5), rd, vec3(2.5,1.,3.0) );
    // <-- bounding box = "alles was uns interessiert, findet hier drin statt"
    //     einfach nur, um unnötige Berechnungen zu ersparen.
    //     Ruhig mal ausschalten und vergleichen (FPS und Optik), ob überhaupt nötig.
    // if (boundingBox.x<boundingBox.y && boundingBox.y>0.0 && boundingBox.x<tmax)
    {
//        tmin = max(boundingBox.x,tmin);
//        tmax = min(boundingBox.y,tmax);

        float t = tmin;
        for (int i=0; i<70 && t<tmax; i++)
        {
            MarchHit h = map(ro + rd * t);
            if (abs(h.t) < (0.0001 * t))
            {
                // getroffen = Länge des Strahls entspricht der SDF
                // (die ja "Abstand der Kamera bis zur Oberfläche" ist)
                res = h;
                res.t = t;
                break;
            }
            t += h.t;
        }
    }
    return res;
}

// https://iquilezles.org/articles/rmshadows
float calcSoftshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax )
{
    // bounding volume
    float tp = (0.8-ro.y)/rd.y;
    if (tp > 0.0) {
        tmax = min( tmax, tp );
    }

    // Schattenbildung ist: Faktor zwischen 0 und 1 an Oberflächenfarbe anheften
    // d.h. in diesem zweiten "Raycasting" (vom Auftrittspunkt z.B. am Boden aus Richtung Licht)
    // geht es darum, die stärkste Abschwächung, d.h. den kleinsten Faktor zu finden
    float res = 1.0;
    float t = mint;
    for( int i=0; i<80; i++ )
    {
        // Ray Marching von der Aufprallstelle des ersten Marchings (raymarch(...))
        float h = map( ro + rd*t ).t;
        // Aber nicht mit Ziel, den Abstand des nächsten Materials zu finden, sondern
        // den kleinsten Quotienten s zu finden, der uns sagt: Auf dem zweiten Strahl,
        // ist irgendwo ein Objekt viel näher (h) als unser Strahl lang (t)?
        // - h == 0 heißt "anderes Objekt im Weg" (dessen SDF ist an seiner Oberfläche ja 0)
        // - kleines h/t heißt, der Schatten hatte genug Raum, sich auszubreiten.
        // Logik hinter h / t:
        //  - t ist aktuell beschrittene Länge des Strahls von Auftrittspunkt (Boden) Richtung Licht
        //  - h ist dann Abstand zum nächsten Objekt (SDF eben, h == 0 wenn anderes Objekt getroffen)
        //  - h/t klein heißt: der Schatten, den das Objekt (in Abstand h) wirft, hat relativ viel Raum
        //    (Strahllänge t), um sich auszubreiten.
        float s = clamp(8.0*h/t,0.0,1.0);
        // Aber auch hier: die genauen Zahlen sind künstlerisch / empirisch gewählt, nicht physikalisch.
        res = min( res, s );
        // Und: Schrittweite begrenzen, wir wollen viele Schattenbeiträge in der Nähe sammeln,
        //      ergibt dann weiche Schatten, nicht nur klares "irgendwas ist im Weg" vs. "nicht".
        t += clamp( h, 0.01, 0.2 );
        if( res<0.004 || t>tmax ) break;
    }
    res = clamp( res, 0.0, 1.0 );
    return res*res*(3.0-2.0*res);
    // <-- entspricht smoothstep
}

// https://iquilezles.org/articles/nvscene2008/rwwtt.pdf
float calcAmbientOcclusion(in vec3 pos, in vec3 normal)
{
    // iAmbientOcclusionSamples ~ 5
    // iAmbientOcclusionStep ~ 0.12
    // iAmbientOcclusionScale ~ 0.95;
    // Idee: wir werten die gesamte Map in verschiedenen Abständen von der Oberfläche aus
    //       (vom Auftrittspunkt also Richtung Normalenvektor) und summieren auf:
    //       (h - d) ~ Wenn d entlang dieser Linie zu klein bleibt, haben wir "Verdeckung", d.h.
    //                 schätzen Schatten / Hohlräume ab, ohne die Rays zum Licht _tracen_ zu müssen
    float occlusion = 0.0;
    float scale = 1.0;
    for (float i=0.; i < iAmbientOcclusionSamples; i += 1.)
    {
        float h = 0.01 + iAmbientOcclusionStep * i / (iAmbientOcclusionSamples - 1.);
        float d = map(pos + h*normal).t;
        occlusion += (h-d) * scale;
        scale *= iAmbientOcclusionScale;
        if( occlusion>0.35 ) break;
    }
    return clamp( 1.0 - 3.0*occlusion, 0.0, 1.0 ) * (0.5+0.5*normal.y);
}

// https://iquilezles.org/articles/normalsSDF
vec3 calcNormal( in vec3 pos )
{
    vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
    return normalize( e.xyy*map( pos + e.xyy ).t +
    e.yyx*map( pos + e.yyx ).t +
    e.yxy*map( pos + e.yxy ).t +
    e.xxx*map( pos + e.xxx ).t );
}

void applyDistanceFog(inout vec3 col, float distance, vec3 fogColor, float density, float growth) {
    float opacity = 1.0 - exp( -density * pow(distance, growth));
    col = mix(col, fogColor, opacity);
    col = clamp(col, 0.0, 1.0);
}

vec3 materialPalette(float parameter) {
    // Das ist wieder eine "Cosinus-Palette" (hier ein sin(), aber selbes Prinzip):
    return 0.2 + 0.2 * sin(parameter * 2.0 + vec3(0.0,1.0,2.0));
    // sin(x) = cos(x - 0.5*pi) = cos(x - 1.571)
    // d.h. um diese Palette in der cos()-Konvention zu sehen, z.B.
    // https://dev.thi.ng/gradients/
    // muss die letzte Spalte ("d") jeder Farbe -> vec3(-1.57, -0.57, 0.43)
}

void render(in vec3 rayOrigin, in vec3 rayDir)
{
    // Diese Funktion folgt der selben Logik wie letzter Woche,
    // ich habe ein bisschen refakturiert und neue Effekte eingebaut,
    // aber prüft mal, ob ihr grundlegende Vorgehen (wieder) erkennen könnt.

    MarchHit res = raycast(rayOrigin, rayDir);

    // Materialkonstanten mit Namen machen mehr Freude.
    // war: if (res.material < -0.5) { ... }
    if (res.material <= MISSING_MATERIAL) {
        return;
    }

    bool isFloor = res.material <= MATERIAL_FLOOR;

    vec3 col = materialPalette(res.material);

    // Gewichtungsfaktoren für manche der Beleuchtungsbeiträge,
    // um bei Bedarf Materialien unterschiedlich behandeln zu können.
    float specularCoeff = 1.0;
    float subSurfaceCoefficient = 1.0;

    // berechneten Strahl rekonstruieren
    vec3 rayPos = rayOrigin + res.t * rayDir;
    // und Normalvektoren, für Beleuchtungseffekte der Oberflächen
    vec3 normal = isFloor ? vec3(0.0,1.0,0.0) : calcNormal(rayPos);

    // Material-Floats auf Gleichheit zu prüfen wirkt gefährlich/fahrlässig, geht hier zwar,
    // aber nur, weil wir exakt wissen, dass wir diesen Wert so gesetzt haben. nicht berechnet.
    if (res.material == MATERIAL_BOX) {
        // res.texCoord haben wir uns oben gemerkt, um hier nicht dieselbe Geometrie
        // nochmal in alle Richtungen fallunterscheiden zu müssen. Möglich wärs aber.
        col *= texture(texFrame, res.texCoord).rgb;
    }
    else if (res.material == MATERIAL_CYLINDER) {
        col = c.yyy - col * texture(texFrame, res.texCoord).rgb;
    }
    else if (res.material == MATERIAL_PYRAMID) {
        // hier z.B.: Farbverlauf an y-Achse
        col = materialPalette(13.56 + 1.1 * rayPos.y);
        specularCoeff = 0.6;

        // s.o. die Pyramiden-SDF wurde aufgerufen mit:
        // sdPyramid(pos - pyramidPosAndHeight.xyz, pyramidPosAndHeight.a)
        // -> kann Mapping "einer Textur" (= eines vec2-Felds) auch erst hier machen.
        // Wir müssen uns aber überlegen, wie wir die Aufprallkoordinaten (vec3 pos, wo SDF == 0)
        // in Texturkoordinaten (vec2 st, normiert auf [0, 1]) umrechnen.
        // Wir vereinfachen das, indem wir uns erstmal in den umgebenden Würfel denken:
        vec3 pos = rayPos - pyramidPos.xyz;
        // Nach der verwendeten SDF sdPyramid() läuft .y bisher von [0..pyramidHeight]:
        pos.y = pos.y / pyramidHeight - 0.5;
        // und wir spiegeln z, weil das "nach vorne" der Welt / Kamera als "-z" gewählt wurde
        // pos ist jetzt auf [-0.5; 0.5] normiert.
        // Damit können wir anwenden, was wir aus VL2 für 2D (dem Quadrat) kennen.
        // Wir brauchen nur die Seitenwände, also können y ignorieren, und prüfen,
        // wer von +x, -x, +z oder -z jeweils maximal ist. Zusammengefasst:
        vec2 st = abs(pos.z) > abs(pos.x) ? pos.xy : pos.zy;
        // links/rechts und vorne/hinten haben jetzt dieselbe Orientierung,
        // wir spiegeln also jeweils eins davon, damit die Texturen an den
        // Kanten von beiden Seiten denselben Wert haben (d.h. stetig sind).
        if (pos.z < -pos.x) {
            st.x *= -1.;
        }
        // [-0.5; 0.5] war sinnvoll für diese Vergleiche, st braucht aber [0; 1]:
        st += 0.5;
        // Um dann vom Würfel auf die Pyramide zu kommen, also für jede Würfelseite [0; 1]
        // das entsprechende Dreieck aus den Punkten (0,0), (1,0) und (0.5, 1) zu beschreiben
        // haben wir drei einfache Optionen:
        // a) wir lassen st einfach so, schneiden also einfach ab, was nicht aufs Dreieck passt
        // b) wir verschieben st.x nach oben entlang der Kantensteigung, so dass
        //    "ganz links" der Textur immer auf jeder Seite ist,
        //    aber die Teile Richtung "rechts oben" abgeschnitten werden.
        // c) ähnlich b), aber wir verjüngen den Bereich von st.x immer weiter zu einem Punkt,
        //    verzerren also die Textur zur Spitze hin, aber schneiden nichts ab.
        if (applyPyramidTextureSkewing) {
            st.x -= st.y * 0.5;
        }
        if (applyPyramidTextureNarrowing) {
            st.x /= 1. - st.y;
        }
        // Und zum Vergleich gäbe es da dann noch die "stumpfe" Version,
        // einfach die Koordinaten des Bodens zu übernehmen, also des Grundriss.
        if (applyPyramidTextureTopDown) {
            st = pos.xz + 0.5;
        }

        if (usePyramidTextureFromBoxes) {
            col = texture(texFrame, st).rgb;
        }
        else {
            float pattern = voronoiPattern(st, true);
            pattern = smoothstep(0.0, 0.5, pattern);
            col = mix(col, pattern * col, 1. - pos.y);
        }
        if (showPyramidTextureGrid) {
            specularCoeff = 0.;
            // Gitter um Schritte von 0.1 in beide Richtungen von st zu sehen
            // (damit das auf jeder Textur sichtbar ist, invertieren wir deren Rotwert)
            col.r = mix(col.r, 1. - col.r, 1. - gridPattern(st, 0.1));
            if (st.y > 0.9) {
                // Rand Oben: Magenta
                col.rgb = c.xyx;
            } else if (st.y < 0.099) {
                // Rand Unten: Grün
                col.rgb = c.yxy;
            }
            if (st.x < 0.1) {
                // Rand Links: cyan
                col = c.yxx;
            } else if (abs(st.x - 0.5) < 0.005) {
                // Mittelsenkrechte: Blau
                col = c.yyx;
            } else if (st.x > 0.9) {
                // Rechter Rand: Orange
                col = c.xwy;
            }
        }
    }
    else if (res.material == MATERIAL_PATH_POINT) {
        // einfache Visualisierung von Punkten im Raum (z.B: unserer Kamerapfad, falls aktiv)
        // hier haben wir res.texCoord.x zweckentfremdet, um die Pfadpunkte durchzunummerieren
        float partOfPath = res.texCoord.x/float(nPath - 1);
        // partOfPath geht also von 0.0 = erster Punkt bis 1.0 = letzter Punkt.
        col = vec3(0., partOfPath, 1. - partOfPath);
        specularCoeff = 0.1;
    }
    else if (isFloor || res.material == MATERIAL_MOUNTAINS)
    {
        // jetzt: Textur.
        // hier kommen wir mit einfacher Geometrie an die richtige Koordinate "st":
        // wir projizieren einfach den Strahl auf die y-Ebene (Boden y == 0); skalieren nach Laune
        res.texCoord = rayPos.xz * 0.3;
        col = texture(texRock, res.texCoord).rgb;
        col = pow(col, vec3(2.8));
        specularCoeff = 0.12;

        if (drawGridOnFloor) {
//            float grid = 1. - abs(step(0.97, fract(2. * rayPos.x)) - step(0.97, fract(2.*rayPos.z)));
            col *= 0.3 + 0.7 * vec3(gridPattern(rayPos.xz, 0.5));
        }
    }

    vec3 shade = vec3(0.0);
    vec3 lightDirection;
    vec3 lightSourceColor;

    // Wir hatten letzte Woche mal eine einzelne (Richtungs)-Lichtquelle, und da die
    // verschiedenen Beiträge für etwa Phong/Blinn-Phong-Shading gesehen.
    // Jegliches "Shading" war: Finde den passenden Faktor zwischen
    // 1 = voll beleuchtet
    // 0 = hier kommt absolut kein Licht hin
    // mit mehreren Lichtquellen kann man das ähnlich machen, muss aber fallbezogen
    // entscheiden, wie man die gegeneinander gewichtet.
    // Wir addieren erstmal einfach.
    // --> Probiert hier einfach mal an allen Konstanten rum.
    //
    // FÜr den Vergleich Richtungslicht vs. Punktlicht bauen wir einfach mal beide zusammen ein,
    // mit iLightSourceMix so, dass
    // ~ 0 -> nur Richtungslicht
    // ~ 0.5 -> beide Quellen
    // ~ 1 -> nur Punktlicht
    for (int light = 0; light < 2; light++) {

        if (light == 0) {
            // Reines Richtungslicht (ähnlich letztes Mal, nur jetzt als uniform für Flexibilität):
            // aber immer noch aufpassen mit dem Vorzeichen: Richtung ZUM Licht!
            lightDirection = normalize(vecDirectionalLight);
            lightSourceColor = normalize(vec3(1.30, 1.00, 0.70));
            lightSourceColor *= iDirectionalLightStrength;
        }
        else {
            // Auch ein "automatisierter Pfad", aber ohne Interpolation zwischen Punkten.
            // -- geht natürlich auch, kann man aber nur schwer kontrollieren :)
            vec3 lightPointSource = vec3(
                -.8 * cos(0.56 * iTime),
                1.1 + 0.1 * cos(0.4 * iTime + 0.2),
                -1.5 -sin(0.8 * iTime)
            );
            // Punktlicht: Richtung unterschiedlich je nach Strahl, es geht um die Differenz:
            lightDirection = normalize(lightPointSource - rayDir);
            lightSourceColor = mix(c.xxx, 2. * materialPalette(14.5 + iLightPointPaletteColor), 0.7);
            lightSourceColor *= iPointLightStrength;

            // um die Punktquelle SELBST zu sehen, müssen wir sie aber extra zeichnen
            if (doShowPointLightSource) {
                // einfache Logik: wenn unsere Blickrichtung direkt überlappt, färben wir fragColor ein.
                // -> ergibt dann einen improvisierten Kreis. Reicht.
                vec3 rayDirectionIntoTheLight = normalize(lightPointSource - rayOrigin);
                float overlap = dot(rayDir, rayDirectionIntoTheLight);
                if (overlap > 0.99995) {
                    fragColor = vec4(lightSourceColor, 1.);
                    return;
                }
            }
        }

        vec3 halfway = normalize(lightDirection - rayDir);

        // diffuse: ~ dot(normal, lightDirection)
        float diffuse = clamp(dot(normal, lightDirection), 0.0, 1.0);
        diffuse *= 2.2 * calcSoftshadow(rayPos, lightDirection, 0.02, 2.5);
        shade += col * iDiffuseAmount * lightSourceColor * diffuse;

        // specular: ~ muss irgendwie Strahlrichtung mit ein-skalarprodukt-en
        //             Gewichtung, Verlauf (pow()), Farbe etc. wählt man nach Eigenempfinden ;)
        float specular = pow(clamp(dot(normal, halfway), 0.0, 1.0), iSpecularExponent);

        // Beispiel eines abschwächenden Effekt (der eine physikalische Approximation ist)
//        float fresnelAttenuation = 0.04 + 0.36*pow(clamp(1.0-dot(halfway,lightDirection), 0.0, 1.0), 5.0);
//        specular *= fresnelAttenuation;
        specular *= 3.00 * specularCoeff;
        shade += specular * lightSourceColor * iSpecularAmount;

        // Heute neu -- Weitere Terme, die sich "Ambient Occlusion" bedienen:
        float occ = calcAmbientOcclusion(rayPos, normal);

        // "Backlight / Ambient Illumination", Idee ist dass in eher verdeckten Bereichen
        // zusätzliche Beiträge durch irgendwelche Spiegelungen am Boden (für unseren festen Fall y == 0)
        // die Schatten leicht aufweichen
        vec3 lightFloorReflection = normalize(vec3(-lightDirection.x, 0., -lightDirection.z));
        float backlightIllumination = occ
            * clamp(dot(normal, lightFloorReflection), 0.0, 1.0)
            * clamp(1.0 - rayPos.y, 0.0, 1.0);
        shade += col * iBacklightAmount * backlightIllumination * vec3(0.25, 0.25, 0.25);

        // "Subsurface Scattering" / "Volumenstreuung" - Nahmt Licht nach, das ins Material geht,
        // sich da etwas verteilt und wieder verlässt, was zu einem wachsartig weichen Leuchten
        // führt (man stelle sich seine Finger hinter einer Taschenlampe vor.)
        // Das ist physikalisch ein Diffusionseffekt, wir wollen die Strahlen aber hier
        // nicht aufwändig berechnen, sondern überlegen auch hier empirisch:
        //
        // Das hängt am Ambient-Occlusion-Faktor aufgrund der Annahme, dass die Lichtstrahlen, die
        // in diesen Ecken bzw. Materialien etc. "verdeckt" werden, ja irgendwo hin müssen.
        // Hat dann einen specular-artigen Beitrag wie dot(normal, rayDir), weil das Licht das Material
        // am ehesten senkrecht verlässt und dann also entlang der Blickrichtung liegen muss.
        float subsurfaceScattering = occ * pow(clamp(1.0+dot(normal, rayDir), 0.0, 1.0), iSubsurfaceExponent);
        subsurfaceScattering = occ * pow(subsurfaceScattering, iSubsurfaceExponent);
        shade += col * iSubsurfaceAmount * subsurfaceScattering * c.xxx;
    }

    if (res.t > 15.) {
        // wir schneiden die Ebene mal ab (um mehr Weltall zu sehen)
        return;
    }

    col = shade;
    applyDistanceFog(col, res.t, vec3(0.001,0.,0.004), 0.002, 3.0);
    fragColor = vec4(col, 1.);
}

vec3 splineCatmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
    // uniform version, cf. https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Catmull%E2%80%93Rom_spline
    return (((-p0 + p1*3. - p2*3. + p3)*t*t*t + (p0*2. - p1*5. + p2*4. - p3)*t*t + (-p0 + p2)*t + p1*2.)*.5);
}

vec4 splineCatmullRom(vec4 p0, vec4 p1, vec4 p2, vec4 p3, float t) {
    return (((-p0 + p1*3. - p2*3. + p3)*t*t*t + (p0*2. - p1*5. + p2*4. - p3)*t*t + (-p0 + p2)*t + p1*2.)*.5);
}

vec3 getPathPosition(float progress) {
    progress = mod(progress, float(nPath));
    // Wir definieren den Pfad so, dass dieselbe Zeit zwischen allen Punkten vergeht.
    // -> macht die folgende Pfadberechnung einfach(er).
    int seg = int(progress);
    float segProgress = progress - floor(progress);
    int seg_1 = (seg - 1 + nPath) % nPath;
    int seg1 = (seg + 1 + nPath) % nPath;
    int seg2 = (seg + 2 + nPath) % nPath;
    return splineCatmullRom(
        camPosPath[seg_1], camPosPath[seg], camPosPath[seg1], camPosPath[seg2],
        segProgress
    );
}

vec4 getTargetPathAndRoll(float progress) {
    // stumpf kopiert von getPathPosition(), aber uns bleibt nicht viel
    // (man könnte das per #define-Makros abbilden, aber _hübsch_ ist es dann auch nicht,
    //  und beim kompilieren werden die ja eh wieder ersetzt, d.h. keine Vorteile da).
    progress = mod(progress, float(nPath));
    int seg = int(progress);
    float segProgress = progress - floor(progress);
    int seg_1 = (seg - 1 + nPath) % nPath;
    int seg1 = (seg + 1 + nPath) % nPath;
    int seg2 = (seg + 2 + nPath) % nPath;
    return splineCatmullRom(
        targetPath[seg_1], targetPath[seg], targetPath[seg1], targetPath[seg2],
        segProgress
    );
}

mat3 setCamera( in vec3 origin, in vec3 target, float rollAngle )
{
    // transforms from "world coordinates" to "camera / view coordinates"
    vec3 cameraForward = normalize(target - origin);
    vec3 rolledWorldUp = vec3(sin(rollAngle), cos(rollAngle), 0.0);
    vec3 cameraRight = normalize( cross(cameraForward, rolledWorldUp) );
    vec3 cameraUp = cross(cameraRight, cameraForward); // already normalized
    return mat3(cameraRight, cameraUp, cameraForward);
}

vec3 background() {
    vec2 st = gl_FragCoord.xy / iResolution.y;
    st -= 0.5 * vec2(iResolution.x/iResolution.y, 1.);
    // st *= 0.8 * rot2D(0.1 * iTime);
    vec4 space = texture(texSpace, st);
    // minimale Verarbeitung reicht uns mal (Gammakorrektur)
    return pow(space.rgb, vec3(1.5));
}

void main()
{
    vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    // Wir machen das hier mal so herum: fragColor = absolut transparent
    // und dann siehe (==>) unten
    fragColor = c.yyyy;

    // Fixed Cam Origin:
    vec3 camOrigin = vec3(-0.75, 1.5, 3.);
    // mit fester Blick_richtung_ (im Gegensatz zu festem Blick-Zielpunkt)
    // (je nachdem eben, ob relativ zu Kameraposition oder unabhängig)
    vec3 camTarget = camOrigin + vec3(1.2, -1.2, -3.5);
    float camRoll = 0.;

    // Demonstration: Automatisierten Pfad ablaufen (per Spline-Interpolation)
    if (doUseCameraPath) {
        vec3 pathPos = getPathPosition(iPathOffset + iPathSpeed * iTime);
        camOrigin = pathPos.xyz;
        // Wohin blicken? Entweder auf einen Punkt etwas weiter im Pfad... (*)
        camTarget = getPathPosition(iPathOffset + iPathSpeed * iTime + 0.5);
    }
    if (doUseCameraTargetPath) {
        // (*) oder einen komplett eigenen Pfad dafür verwenden
        // (hier vec4, um noch zusätzlich als Komponente .w den Rollwinkel zu animieren)
        vec4 pathTarget = getTargetPathAndRoll(iPathOffset + iPathSpeed * iTime);
        camTarget = pathTarget.xyz;
        camRoll = pathTarget.w;
    }

    // iCamLookOffset: bewegt angeblickten _Punkt_ frei, ist deswegen
    // aber etwas anderes Verhalten als "die Blickrichtung frei zu drehen".
    // Letzteres ist nämlich kein einfach beschreibenes Problem.
    // ("Eulerwinkel", "Gimbal Lock", "Quaternionen" etc.)
    camTarget += iCamLookOffset;
    camRoll += iCamRoll;

    // camera-to-world transformation
    mat3 camMatrix = setCamera(camOrigin, camTarget, camRoll);
    // ray direction via screen coordinate and "screen distance" ~ focal length ("field of view")
    vec3 rayDirection = camMatrix * normalize(vec3(uv, iCamFocalLength));

    // iCamOffset: freie Verschiebung der Kamera, soll aber,
    // bei Verwendung des Pfads, konsistent im Kamera-Koordinatensystem passieren
    // d.h. (0,0,1) soll "1 nach vorne" heißen, nicht "1 in Welt-Z-Koordinate".
    if (doUseCameraPath) {
        camOrigin += camMatrix * iCamOffset;
    } else {
        camOrigin += iCamOffset;
    }

    render(camOrigin, rayDirection);

    applyToneMapping(fragColor.rgb);
    applyGammaCorrection(fragColor.rgb);

    // (==>) jetzt haben wir fragColor als "unabhängige Ebene" behandelt und können
    //       den Hintergrund da druntermischen, wo der Ray Marcher noch nicht fragColor.a abdeckt
    fragColor.rgb = mix(background(), fragColor.rgb, fragColor.a);
    fragColor.a = 1.;
}
