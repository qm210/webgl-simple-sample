#version 300 es

// based on: https://www.shadertoy.com/view/Xds3zN
// simplified for our lecture (cf. raymarchingPrimitivesSimplified.glsl)
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
uniform vec3 vecFree3;
uniform vec3 vecFree4;
uniform vec3 vecFree5;

const float pi = 3.141593;
const float twoPi = 2. * pi;
const float piHalf = .5 * pi;
const vec4 c = vec4(1., 0. , -1., .5);

const float MISSING_MATERIAL = -0.5;
const float MATERIAL_FLOOR = 1.0;
const float MATERIAL_BOX = 3.0;
const float MATERIAL_CYLINDER = 8.0;
const float MATERIAL_PYRAMID = 13.0;
const float MATERIAL_PATH_POINT = 1.4;

// SHADER OPTIONS ////////
const bool DRAW_GRID_ON_FLOOR = true;
const bool SHOW_POINT_LIGHT_SOURCE = true;
const bool USE_AUTOMATED_CAMERA_PATH = false;
const bool USE_AUTOMATED_CAMERA_TARGET_PATH = false;
/////////////////////////

const int nPath = 6;
vec3 camPosPath[nPath] = vec3[6](
    vec3(-0.75, 1.5, 3.),
    vec3(0.4, 0.35, 1.25),
    vec3(-0.3, 0.65, -3.3),
    vec3(-2.1,0.73, -1.3),
    vec3(1.5, 0.4, -3.0),
    vec3(0.1, 0.8, 0.1)
);

vec4 targetPath[nPath] = vec4[6](
    vec4(-0.3, 0.35, 1.05, 0.),
    vec4(-0.3, 0.65, -3.3, -.2),
    vec4(-2.,0.73, -1.3, 1.6),
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
    float n = sin(dot(p, vec2(127.1, 311.7))) * 43758.5453;
    return fract(vec2(n, n * 1.2154));
}

float voronoi(vec2 uv) {
    vec2 uvInt = floor(uv);
    vec2 uvFrac = fract(uv);
    float dMin = 1.0;
    float dSecondMin = 1.0;
    for (float y = -1.; y <= 1.1; y += 1.) {
        for (float x = -1.; x <= 1.1; x += 1.) {
            vec2 b = vec2(x, y);
            vec2 r = b + hash22(uvInt + b) - uvFrac;
            float d = length(r);
            if (d < dMin) {
                dSecondMin = dMin;
                dMin = d;
            } else if (d < dSecondMin) {
                dSecondMin = d;
            }
        }
    }
    // return dMin;
    return dSecondMin - dMin;
}

float bounceParabola(float h, float g, float T, float t) {
    t = fract(t/T) - 0.5;
    t *= -g*t;
    t += h + 0.25*g;
    return t;
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
    return MarchHit(d, 0., surfaceCoord);
}

MarchHit texturedSdBox( vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    float d = length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);

    // Koordinatentransformation:
    // Um Textur zuzuordnen, müssen wir uns nochmal "in den Würfel hineinversetzen."
    // - In seinem eigenen Koordinatensystem rotiert er nicht,
    // - die Mitte ist nicht bei p (Weltkoordinaten), sondern bei vec3(0)
    // - und auch die Skalierung (b) für seine prinzipielle Würfelhaftigkeit egal.
    vec3 a = 0.5 * p / b;
    // damit geht der Würfel in jeder Dimension von einer Wand bei -0.5 zu einer bei +0.5

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

    return MarchHit(d, MATERIAL_BOX, uv);
}

float sdCylinder( vec3 p, vec2 h )
{
    // vertical ~ along y-axis
    h.y *= 1. + iFree2;
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

//------------------------------------------------------------------

vec2 opUnion( vec2 d1, vec2 d2 )
{
    return (d1.x<d2.x) ? d1 : d2;
}

// Erweiterte Versionen von opUnion, bei der Gelegenheit gleich umbenannt:

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

const vec4 pyramidPosAndHeight = vec4(-1.0, 0.0, -2.6, 1.1);

MarchHit map( in vec3 pos )
{
    MarchHit res = MarchHit(pos.y, 0.0, c.yy);

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
        sdPyramid(pos - pyramidPosAndHeight.xyz, pyramidPosAndHeight.a),
        MATERIAL_PYRAMID
    );

    // Mal ein Beispiel einer ungewöhnlichen Transformation, die wir mit aktuellen Mitteln
    // aber schon komplett verstehen können (und mich außerdem ziemlich erheitert).
    float sphereRadius = 0.25;
    float sphereY = bounceParabola(0.9, 3., 1., iTime) - 1.2;
    float squeeze = -min(0., sphereY) + 1.;
    sphereY = max(0., sphereY);
    vec3 spherePos = vec3(2.,sphereY + sphereRadius, 0.4);
    mat3 transformMatrix = squeezeY(squeeze);
    res = takeCloser(res,
        sdSphere(transformMatrix * (pos - spherePos), sphereRadius),
        24.9 - 1. * squeeze
    );

    // mit erweiterter sdBox, die auch noch die Aufprallkoordinate des Strahls mitspeichert
    // um später die Textur abbilden zu können. Wir bleiben da mal beim Quader...

    res = takeCloser(res,
        texturedSdBox(pos-vec3( -.5,0.25, 0.0), vec3(0.5,0.2,0.5))
    );

    res = takeCloser(res,
        texturedSdBox(rotY(0.1 * iTime)*(pos-vec3(1.32,0.4,-0.8)), vec3(0.5,0.4,0.3))
    );
    vec3 cylinderPos = (pos-vec3( 1.0,0.35,-2.0));
    // Eulerwinkel-Drehung am Beispiel des Zylinders:
    // (sieht man gut, wenn man den Pfad mit iPathOffset so wählt
    cylinderPos *= rotY(0.0*iTime + 0.25); // dreht um eigene Achse
    cylinderPos *= rotZ(0.0*iTime + 2.);
    cylinderPos *= rotY(0.0*iTime);
    res = takeCloser(res,
        texturedSdCylinder(cylinderPos, vec2(0.15,0.25))
    );

    // render the path points for debugging
    if (USE_AUTOMATED_CAMERA_PATH)
    for (int p = 0; p < nPath; p++) {
        res = takeCloser(res,
            MarchHit(
                sdSphere(pos - camPosPath[p].xyz, 0.03),
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
    vec2 boundingBox = iBox( ro-vec3(0.0,1.,-0.5), rd, vec3(2.5,1.,3.0) );
    // <-- bounding box = "alles was uns interessiert, findet hier drin statt"
    //     einfach nur, um unnötige Berechnungen zu ersparen.
    //     Ruhig mal ausschalten und vergleichen, ob überhaupt nötig.
    // if (boundingBox.x<boundingBox.y && boundingBox.y>0.0 && boundingBox.x<tmax)
    {
        tmin = max(boundingBox.x,tmin);
        tmax = min(boundingBox.y,tmax);

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
    if( tp>0.0 ) {
        tmax = min( tmax, tp );
    }

    // Schattenbildung ist: Faktor zwischen 0 und 1 an Oberflächenfarbe anheften
    // d.h. in diesem zweiten "Raycasting" (vom Auftrittspunkt z.B. am Boden aus Richtung Licht)
    // geht es darum, die stärkste Abschwächung, d.h. den kleinsten Faktor zu finden
    float res = 1.0;
    float t = mint;
    for( int i=0; i<80; i++ )
    {
        float h = map( ro + rd*t ).t;
        // Logik hinter h / t:
        //  - t ist aktuell angenommene Länge des Strahls von Auftrittspunkt (Boden) Richtung Licht
        //  - h ist dann minimale SDF; entspricht also dem Objekt minimalen Abstands = größten Beitrags
        //  - h/t = Entfernung der Objektoberfläche relativ zur Strahllänge = Ausbreitung des Schattens
        //    und macht Schatten weicher, weil Ecken "mehr Einzugsgebiet" des Schattens beziehen
        // Aber auch hier: die genauen Zahlen sind künstlerisch / empirisch gewählt, nicht physikalisch.
        float s = clamp(8.0*h/t,0.0,1.0);
        // kleinsten Faktor finden:
        res = min( res, s );
        t += clamp( h, 0.01, 0.2 );
        if( res<0.004 || t>tmax ) break;
    }
    res = clamp( res, 0.0, 1.0 );
    return res*res*(3.0-2.0*res);
    // <-- entspricht smoothstep
}

// https://iquilezles.org/articles/nvscene2008/rwwtt.pdf
float calcAO( in vec3 pos, in vec3 nor )
{
    // "Ambient Occlusion", interesting effect for lighting if we have time :)
    float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
        float h = 0.01 + 0.12*float(i)/4.0;
        float d = map( pos + h*nor ).t;
        occ += (h-d)*sca;
        sca *= 0.95;
        if( occ>0.35 ) break;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 ) * (0.5+0.5*nor.y);
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

void render(out vec3 col, in vec3 rayOrigin, in vec3 rayDir)
{
    // Diese Funktion folgt der selben Logik wie letzter Woche,
    // ich habe ein bisschen refakturiert und neue Effekte eingebaut,
    // aber prüft mal, ob ihr grundlegende Vorgehen (wieder) erkennen könnt.

    MarchHit res = raycast(rayOrigin, rayDir);

    if (res.t > 15.) {
        // early return: wir schneiden die Ebene mal früher ab
        // (um mehr Weltall zu sehen, oder so)
        return;
    }

    // Materialkonstanten mit Namen machen mehr Freude.
    // war: if (res.material < -0.5) { ... }
    if (res.material <= MISSING_MATERIAL) {
        return;
    }

    // Material: Floats auf Gleichheit zu prüfen wirkt gefährlich, geht hier nur,
    // weil wir exakt wissen, dass wir diesen Wert so gesetzt haben, nicht berechnet.
    bool isFloor = res.material == MATERIAL_FLOOR;

    col = materialPalette(res.material);

    float specularCoeff = 1.0;

    // berechneten Strahl rekonstruieren
    vec3 rayPos = rayOrigin + res.t * rayDir;
    // und Normalvektoren, für Beleuchtungseffekte der Oberflächen
    vec3 normal = isFloor ? vec3(0.0,1.0,0.0) : calcNormal(rayPos);

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
        // Dann müssen wir die Geometrie eben neu auswerten. s.o.: Ist ja aber möglich :)
        vec3 pos = (rayPos - pyramidPosAndHeight.xyz) / pyramidPosAndHeight.a;
        // Einfach mal die Wände des umschließenden Würfels auswerten:
        vec3 n = abs(normal);
        vec2 st = n.x > n.y && n.x > n.z ? pos.zy : pos.xy;
        float pattern = voronoi(10. * st + iFree3);
        pattern = smoothstep(0.0, 0.5, pattern);
        col = mix(col, pattern * col, 1. - pos.y);
    }
    else if (res.material == MATERIAL_PATH_POINT) {
        // einfache Visualisierung von Punkten im Raum (z.B: unserer Kamerapfad, falls aktiv)
        col = vec3(0., res.texCoord.x * 0.2, 1. - res.texCoord.x * 0.2);
        specularCoeff = 0.1;
    }
    else if (isFloor)
    {
        // war: Schachbrettmuster
        // float checkerboard = 1. - abs(step(0.5, fract(1.5*rayPos.x)) - step(0.5, fract(1.5*rayPos.z)));
        // col = 0.15 + f*vec3(0.05);
        float grid = 1. - abs(step(0.97, fract(2. * rayPos.x)) - step(0.97, fract(2.*rayPos.z)));

        // jetzt: Textur.
        // hier kommen wir mit einfacher Geometrie an die richtige Koordinate "st":
        // wir projizieren einfach den Strahl auf die y-Ebene (Boden y == 0); skalieren nach Laune
        res.texCoord = rayPos.xz * 0.3;
        col = texture(texRock, res.texCoord).rgb;
        // "Fraktale" Verfeinerung ähnlich "fractal Brownian motion" - kann auch ausbleiben
        /*
        col += (
            0.66 * texture(texRock, 2. * res.texCoord).rgb +
            0.44 * texture(texRock, 4. * res.texCoord).rgb
        );
        col /= 2.1;
        */
        col = pow(col, vec3(2.8));
        specularCoeff = 0.12;

        if (DRAW_GRID_ON_FLOOR) {
            col *= 0.3 + 0.7 * vec3(grid);
        }
    }

    vec3 shade = vec3(0.0);
    vec3 lightDirection;
    vec3 lightPointSource;
    vec3 lightSourceColor;

    // Wir hatten letzte Woche mal eine einzelne (Richtungs)-Lichtquelle, und da die
    // verschiedenen Beiträge für etwa Phong/Blinn-Phong-Shading gesehen.
    // Jegliches "Shading" war: Finde den passenden Faktor zwischen
    // 1 = voll beleuchtet
    // 0 = hier kommt absolut kein Licht hin
    // mit mehreren Lichtquellen kann man das ähnlich machen, muss aber fallbezogen
    // entscheiden, wie man die gegeneinander gewichtet.
    // Probiert hier einfach mal an den Konstanten rum.
    //
    // FÜr den Vergleich Richtungslicht vs. Punktlicht bauen wir einfach mal beide zusammen ein:
    for (int light = 0; light < 2; light++) {

        if (light == 0) {
            // Reines Richtungslicht (wie letztes Mal):
            lightDirection = normalize(vec3(-0.2, 1.4, -0.4) + vecFree5);
            // immer noch aufpassen mit dem Vorzeichen: Richtung ZUM Licht
            lightSourceColor = vec3(1.30, 1.00, 0.70);
        } else {
            // lightPointSource = vec3(-1., 1.5, -2.6);
            lightPointSource = vec3(-.5, 1. + 0.5 * sin(iTime), -2.6);
            // Punktlicht: Richtung unterschiedlich / relativ zum Strahl eben.
            lightDirection = normalize(lightPointSource - rayDir);
            // lightSourceColor = materialPalette(17.) * 1.5;

            // um die Punktquelle SELBST zu sehen, müssen wir sie aber extra zeichnen
            if (SHOW_POINT_LIGHT_SOURCE) {
                // einfache Logik:
                vec3 rayDirectionIntoTheLight = normalize(lightPointSource - rayOrigin);
                float overlap = dot(rayDir, rayDirectionIntoTheLight);
                col += lightSourceColor * exp(-pow(0.2*overlap, 2.));
                // Alternative: only an improvised 2D circle
                if (overlap > 0.9999) {
                    col = lightSourceColor;
                    return;
                }
            }
        }

        vec3  halfway = normalize(lightDirection - rayDir);// was ist das, geometrisch?

        float diffuse = clamp(dot(normal, lightDirection), 0.0, 1.0);// dot(normal, lightSource) <-- diffus (warum?)
        diffuse *= calcSoftshadow(rayPos, lightDirection, 0.02, 2.5);// warum hier *= ...?

        float specular = pow(clamp(dot(normal, halfway), 0.0, 1.0), 20.0);// <-- glänzend (warum?)

        // float fresnelAttenuation = 0.04 + 0.36*pow(clamp(1.0-dot(halfway,lightDirection), 0.0, 1.0), 5.0);
        // specular *= fresnelAttenuation;

        shade += col * 2.20 * lightSourceColor * diffuse;
        shade +=       3.00 * lightSourceColor * specular * specularCoeff;
    }

    col = shade;

    applyDistanceFog(col, res.t, vec3(0.003,0.,0.008), 0.01, 3.0);
}

vec3 splineCatmullRom(vec3 p0, vec3 p1, vec3 p2, vec3 p3, float t) {
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

void background() {
    vec2 st = gl_FragCoord.xy / iResolution.y;
    st -= 0.5 * vec2(iResolution.x/iResolution.y, 1.);
    // st *= 0.8 * rot2D(0.1 * iTime);
    vec4 space = texture(texSpace, st);
    space.rgb = pow(space.rgb, vec3(1.5));
    fragColor.rgb = mix(space.rgb, fragColor.rgb, fragColor.a);
    fragColor.a = 1.;
}

void main()
{
    vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    background();

    // Fixed Cam Origin:
    vec3 camOrigin = vec3(-0.75, 1.5, 3.);
    // mit fester Blick_richtung_ (im Gegensatz zu festem Blick-Zielpunkt)
    // (je nachdem eben, ob relativ zu Kameraposition oder unabhängig)
    vec3 camTarget = camOrigin + vec3(0.27, -0.32, -0.84) + vecFree2;
    float camRoll = iCamRoll;

    // Demonstration: Automatisierten Pfad ablaufen (per Spline-Interpolation)
    vec3 pathPos;
    if (USE_AUTOMATED_CAMERA_PATH) {
        pathPos = getPathPosition(iPathOffset + iPathSpeed * iTime);
        camOrigin = pathPos.xyz;
        if (USE_AUTOMATED_CAMERA_TARGET_PATH) {
            // dann Blickpunkt mit weiterem Pfad angeben...
            // (+ hier noch im sonst ungenutzten .w den Rollwinkel animiert)
            vec4 pathTarget = getTargetPathAndRoll(iPathOffset + iPathSpeed * iTime);
            camTarget = pathTarget.xyz;
            camRoll = pathTarget.w;
        } else {
            // ... oder halt die Kamera auf auf etwas weiter vorne im Pfad richten:
            pathPos = getPathPosition(iPathOffset + iPathSpeed * iTime + 0.1 + iFree0);
            camTarget = pathPos.xyz;
        }
    }
    // iCamOffset, iCamLookOffset: frei variabel, um Effekte zu testen / debuggen
    camOrigin += iCamOffset;
    camTarget += iCamLookOffset;

    // camera-to-world transformation
    mat3 camMatrix = setCamera(camOrigin, camTarget, camRoll);
    // ray direction via screen coordinate and "screen distance" ~ focal length ("field of view")
    vec3 rayDirection = camMatrix * normalize(vec3(uv, iCamFocalLength));

    // render
    vec3 col;
    render(col, camOrigin, rayDirection);

    // gain ("HDR compression", Konstanten so gewählt dass [0,1] erhalten bleibt)
    // col = col * 2.5/(1.5 + col);
    // col = col * 3.0/(2.5 + col)
    // <-- quasi Alternativen zur pow()-Gammakorrektur, man wähle was einem gefällt. Siehe auch:
    // https://graphtoy.com/?f1(x,t)=pow(x,1./2.2)&v1=true&f2(x,t)=x*3./(2.5+x)&v2=true&f3(x,t)=x*2.5/(1.5+x)&v3=true&f4(x,t)=&v4=false&f5(x,t)=&v5=false&f6(x,t)=&v6=false&grid=1&coords=0.744623141762885,0.5386673261892163,1.2183071759372475
    // gamma
    const float gamma = 2.2;
    col = pow(col, vec3(1./gamma));

    fragColor = vec4(col, 1.);
}
