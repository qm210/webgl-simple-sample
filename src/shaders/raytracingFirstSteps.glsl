#version 300 es

// based on: https://www.shadertoy.com/view/Xds3zN
// and our previous modifications for these lectures.

// List of other 3D SDFs:
//    https://www.shadertoy.com/playlist/43cXRl
// and
//    https://iquilezles.org/articles/distfunctions

precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform float iFieldOfViewDegrees;
uniform float iSceneRotation;
uniform vec3 vecDirectionalLight;
uniform float iDiffuseAmount;
uniform float iSpecularAmount;
uniform float iSpecularExponent;
uniform float iHalfwaySpecularMixing;
uniform vec3 vecSkyColor;
uniform float iBacklightAmount;
uniform float iSubsurfaceAmount;
uniform float iAmbientOcclusionScale;
uniform float iAmbientOcclusionStep;
uniform float iAmbientOcclusionIterations;
uniform int iShadowCastIterations;
uniform float iShadowSharpness;
uniform int iRayMarchingIterations;
uniform int iRayTracingIterations;
uniform float iMetalReflectance;
uniform float iEtaGlassRefraction;
uniform float iGammaCorrection;
uniform float iNoiseLevel;
uniform float iNoiseFreq;
uniform float iNoiseOffset;
uniform int iFractionSteps;
uniform float iFractionScale;
uniform float iFractionAmplitude;
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

// Das "material"-float berechnet einerseits ja die Farbe aus der Palettenfunktion,
// aber ein paar spezielle Werte definieren wir hier mal vorweg:
const int UNDEFINED_MATERIAL = 0;
const int NO_MATERIAL = -1;
const int FLOOR_MATERIAL = 1;
const int STANDARD_OPAQUE_MATERIAL = 2;
const int GLASS_MATERIAL = 3;
const int METAL_MATERIAL = 4;
const int PLAIN_DEBUGGING_MATERIAL = 99;

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
float dot2( in vec2 v ) { return dot(v,v); }
float dot2( in vec3 v ) { return dot(v,v); }
float ndot( in vec2 a, in vec2 b ) { return a.x*b.x - a.y*b.y; }

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
    for (int i = 0; i < iFractionSteps; i++) {
        v += a * perlin2D(p);
        s += a;
        p = p * iFractionScale;
        a *= iFractionAmplitude;
    }
    // return v;
    // <-- ist das eigentliche fbm(), aber führt hier schnell zu zu starken Werten
    return v / s;
}

float sdNoiseMountains(vec3 p) {
    float height = max(0., length(p.xz) - 3.);
    // <-- -3. damit mittlere Arena ungestört bleibt
    height *= iNoiseLevel * (1. + fractalBrownianMotion(p.xz * iNoiseFreq));
    return p.y - height;
}

//-- Sinnvolle structs machen auf Dauer mehr Freude. Is echt so. ------

struct Ray {
    vec3 origin;
    vec3 dir;
};

struct Hit {
    float t;
    int material;
    // Wir machen "material" heute allein zum Index für die _Art_ Material (ergo "int").
    // Eine intrinsische Farbe bekommt ein Objekt durch ein Extrafeld:
    vec3 baseColor;
    // Texturen bleiben heute weg, also brauchen wir die Oberflächenkordinate nicht:
    // vec2 surfaceCoord;
};

struct DebugValues {
    int bounces;
    int lastMarchingSteps;
    Hit firstHit;
    Hit lastHit;
    vec3 attenuation;
};

////

// zum debuggen nützlich
#define SHOW_DEBUG_MARKERS 0
#define N_DEBUG_MARKERS 3
vec3 debuggingMarkers[N_DEBUG_MARKERS] = vec3[N_DEBUG_MARKERS](
    c.xyy,
    c.wyy,
    c.yyy
);

//------------------------------------------------------------------------------

vec2 opUnion( vec2 d1, vec2 d2 )
{
    return (d1.x<d2.x) ? d1 : d2;
}

// Erweiterte Versionen von opUnion, bei der Gelegenheit gleich umbenannt:

Hit takeCloser(Hit d1, Hit d2)
{
    if (d1.t < d2.t) return d1;
    return d2;
}

Hit takeCloser( Hit d1, float d2, int material2, vec3 intrinsicColor)
{
    if (d1.t < d2) return d1;
    return Hit(d2, material2, intrinsicColor);
}

vec3 materialPalette(float parameter) {
    return 0.2 + 0.2 * sin(parameter * 2.0 + vec3(0.0,1.0,2.0));
}

Hit map(in vec3 pos)
{
    Hit res = Hit(pos.y, FLOOR_MATERIAL, c.xxx);
    // Hier war ursprünglich 0.0 initialisiert, also erstmal "UNKNOWN_MATERIAL"
    // Uns bringt diese Unterscheidung aber nichts, wir kennen unsere Szene ausreichend.

    float noiseY = sdNoiseMountains(pos - vec3(0.8,0.0,-1.6));
    res = takeCloser(res,
        Hit(noiseY, FLOOR_MATERIAL, c.xxx)
    );

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
        sdBox(rotY(0.73) * (pos - vec3(1., 0.34, 2.)), 0.34 * c.xxx),
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
        sdBox((pos - vec3(-0.5, 0.6, 2.)), 0.6 * c.xxx),
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

Hit map(in Ray ray, in float distance)
{
    return map(ray.origin + ray.dir * distance);
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

const float MARCHING_MIN_DISTANCE = 0.1;
const float MARCHING_MAX_DISTANCE = 20.;

// Funktion hieß bisher raycast(), fand ich aber nicht so perfekt.
void raymarch(in Ray ray, out Hit result, inout DebugValues debug)
{
    result = Hit(-1.0, NO_MATERIAL, c.yyy);

    float tmin = MARCHING_MIN_DISTANCE;
    float tmax = MARCHING_MAX_DISTANCE;

    // trace floor plane analytically
    float tp1 = (0.0-ray.origin.y)/ray.dir.y;
    if( tp1>0.0 )
    {
        tmax = min( tmax, tp1 );
        result = Hit(tp1, FLOOR_MATERIAL, c.xxx);
    }

    // Hier habe ich die "Bounding Box" entfernt, da der Performance-Gewinn
    // die Extra-Komplexität / Lesbarkeit nicht rechtfertigt hat (bei mir zumindest).
    // Wenn insgesamt zu langsam -> wieder einführen :)

    float t = tmin;
    bool inside = false;
    int i;
    for(i = 0; i < iRayMarchingIterations && t < tmax; i++)
    {
        // map(...) lesen = Szene-SDF auswerten
        // Hit h = map( ray.origin + ray.dir * t );
        Hit h = map(ray, t);

        // Anmerkung: Check ... < epsilon * t statt  ... < epsilon ist "adaptiv"
        //            -> weiter entfernte Ziele (t groß) müssen nicht so genau getroffen werden
        //            -> nähere Ziele (t klein) müssen genauer getroffen werden
        //            -> Float-Ungenauigkeit fällt zudem vergleichsweise geringer ins Gewicht
        if (abs(h.t) < epsilon * t)
        {
            result = h;
            result.t = t;
            break;
        }

        // t += h.t;
        // <-- braucht Anpassung für "Strahl kann auch ins Material",
        //     h.t ist in den SDF ja < 0 und dann würde der Strahl wieder rückwärts wandern:
        if (!inside) {
            if (h.t > 0.) {
                t += h.t;
            } else {
                inside = true;
                // Kleiner Schritt weiter (h.t < 0), s. "Self-Interactions"-Kommentare
                t -= 2. * h.t;
            }
        } else {
            if (h.t > 0.) {
                // Ausgangspunkt getroffen.
                // TODO: hier stumpf dupliziert, das ließe sich verbessern.
                result = h;
                result.t = t;
                break;
            }
            t += max(-h.t, epsilon);
        }
    }

    // we pass this out to visualize it as a way of debugging / troubleshooting
    debug.lastMarchingSteps = i;
}

// https://iquilezles.org/articles/rmshadows
float calcSoftshadow( in vec3 ro, in vec3 rd)
{
    float mint = 0.02;
    float tmax = 2.5;

    // bounding volume (Spart etwas Rechenzeit, könnte man mal vergleichen)
    float tp = (0.8-ro.y)/rd.y;
    if( tp > 0.0 ) {
        tmax = min( tmax, tp );
    }
    // Ganz allgemein ist die Aussage wahr:
    // Wenn for einer iterativen Ray-Casting-Schleife schon durch
    // analytische Mathematik die Bedingungen eingeschränkt werden können,
    // kann sich das schon lohnen. Kann man aber verschieben auf "erst sobald nötig" ;)

    float res = 1.0;
    float t = mint;
    for(int i=0; i < iShadowCastIterations; i++)
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
        if( res<0.004 || t>tmax ) break;
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
    // iAmbientOcclusionStep ~ 0.12
    // iAmbientOcclusionScale ~ 0.95;
    // Idee: wir werten die gesamte Map in verschiedenen Abständen von der Oberfläche aus
    //       (vom Auftrittspunkt also Richtung Normalenvektor) und summieren auf:
    //       (h - d) ~ Wenn d entlang dieser Linie zu klein bleibt, haben wir "Verdeckung", d.h.
    //                 schätzen Schatten / Hohlräume ab, ohne die Rays zum Licht _tracen_ zu müssen
    float occlusion = 0.0;
    float scale = 1.0;
    for (float i=0.; i < iAmbientOcclusionIterations; i += 1.)
    {
        float h = 0.01 + iAmbientOcclusionStep * i / (iAmbientOcclusionIterations - 1.);
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

// https://iquilezles.org/articles/normalsSDF
vec3 calcNormal( in vec3 pos )
{
    vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
    return normalize( e.xyy*map( pos + e.xyy ).t +
    e.yyx*map( pos + e.yyx ).t +
    e.yxy*map( pos + e.yxy ).t +
    e.xxx*map( pos + e.xxx ).t );
}

vec3 shadeForOpaqueMaterial(Ray ray, vec3 rayHit, vec3 normal, vec3 baseColor, float specularCoeff) {

    vec3 lightDirection = normalize(-vecDirectionalLight);
    // Vorzeichenkonvention: lightDirection in den Beleuchtungsmodellen ist ZUM Licht
    // (im Uniform vecDirectionalLight fand ich die andere Richtung aber geeigneter)

    // Ambient Occlusion - Faktor für die Verdecktheit / Verwinkelung an einer Stelle
    //                     (1 = quasi freie Fläche, 0 =
    float occlusion = calcAmbientOcclusion(rayHit, normal);

    // Akkumuliert alle Beiträge des Beleuchtungsmodells, die wir uns so ausdenken
    vec3 shade = c.yyy;

    {
        // 1. Effekt: Richtungslicht z.B. der Sonne bzw. einer weit entfernten Lichtquelle.
        //            (-> Alle Lichtstrahlen sind parallel.)
        //            In VL5 wurden auch Punktquellen demonstriert.

        const vec3 lightColor = vec3(1.30, 1.00, 0.70);
        // PS: RGB-Werte größer 1 sind für eine Lichtquelle geduldet, ist dann halt stärker.

        // Diffuser Teil: geht ~ dot(normal, lightSource)
        float diffuse = clamp(dot(normal, lightDirection), 0.0, 1.0);
        diffuse *= calcSoftshadow(rayHit, lightDirection);
        shade += iDiffuseAmount * diffuse * lightColor * baseColor;

        // Specular: hat einen Term ~ dot(normal, refl) oder dot(normal, halfway)
        // Halfway wird (z.B. Blinn-Phong) anstatt echtem Reflektionsvektor verwendet.
        // Ist etwas schneller berechnet und macht oft weicheres Licht / breitere Verläufe.
        vec3 halfway = normalize(lightDirection - ray.dir);
        vec3 refl = reflect(-lightDirection, normal);
        // Können wir mal direkt vergleichen, indem wir zwischen beiden Vektoren interpolieren
        // d.h. iHalfwaySpecularMixing == 0 -> Phong
        //      iHalfwaySpecularMixing == 1 -> Blinn-Phong
        refl = mix(refl, halfway, iHalfwaySpecularMixing);

        float specular = pow(clamp(dot(normal, refl), 0.0, 1.0), iSpecularExponent);

        shade += iSpecularAmount * specular * lightColor * specularCoeff;
    }

    {
        // 2. Effekt: Himmel - Auch Richtungslicht, direkt von oben aber anders gewichtet.
        //            (hatte ich bisher entfernt, könnt ihr aber mal versuchen zu interpretieren)
        float diffuse = sqrt(clamp(0.5+0.5*normal.y, 0.0, 1.0));
        // <-- hier steht quasi dot(normal, lightDirection) mit lightDirection == (0,1,0)
        // das sqrt() ist m.E. eine willkürliche Graduierung, aber der Effekt ist,
        // dass die Übergänge zwischen verschiedenen Winkeln sanfter ist.
        // (sqrt(x) entspricht pow(x, 0.5) und ist also auch eine Art Gammakorrektur)
        diffuse *= occlusion;
        shade += 0.60 * diffuse * vecSkyColor * baseColor;

        vec3 refl = reflect(ray.dir, normal);
        float specular = smoothstep(-0.2, 0.2, refl.y);
        specular *= diffuse;
        specular *= 0.04+0.96*pow(clamp(1.0+dot(normal, ray.dir), 0.0, 1.0), 5.0);
        // <-- Nochmal eine modifizierte Form des Phong-Speculars (Glanzlichts).
        //     pow(..., 5.) deutet auf "Fresnel-Korrektur" hin, dem Verlauf
        //     etwas realistischerer Lichtbrechnung an der Grenzfläche.
        //     (d.h. ein Stück näher an der Physik als das rein empirische Phong).
        //     "Physikalischer motiviert" muss aber nicht "überzeugender" aussehen.
        specular *= calcSoftshadow(rayHit, refl);

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

        float backlightIllumination = clamp(dot(normal, lightFloorReflection), 0.0, 1.0);
        backlightIllumination *= occlusion * clamp(1.0 - rayHit.y, 0.0, 1.0);

        shade += baseColor * iBacklightAmount * backlightIllumination * vec3(0.25, 0.25, 0.25);
    }

    {
        // 4. Effekt:
        // "Sub-Surface Scattering"-Nachahmung nach, i.e. Lichtstrahlen, die das Material nach etwas
        // Verweilzeit  wieder verlassen (man stelle sich seine Finger hinter einer Taschenlampe vor)
        // Das ist physikalisch ein Diffusionseffekt und sieht generell weich aus, oder wachs-artig.
        // Das hängt am Ambient-Occlusion-Faktor aufgrund der Annahme, dass die Lichtstrahlen, die
        // in diesen Ecken bzw. Materialien etc. "verdeckt" werden, ja irgendwo hin müssen.
        // Hat dann einen specular-artigen Beitrag wie dot(normal, rayDir), weil das Licht das Material
        // am ehesten senkrecht verlässt und dann also entlang der Blickrichtung liegen muss.
        float subsurfaceScattering = pow(clamp(1.0+dot(normal, ray.dir), 0.0, 1.0), 2.0);
        subsurfaceScattering *= occlusion;

        shade += iSubsurfaceAmount * subsurfaceScattering * baseColor;
    }

    // Man könnte sich hier noch weitere Effekte bzw. Kombinationen ausdenken,
    // und die Werte sind jedesmal andere (es sind empirische Modelle);
    // man sollte aber diese Begriffe zuordnen können und was sie jeweils ausmacht.

    // in der Praxis:
    // im Wesentlichen ist es legitim, sich grob zu überlegen welche Vektoren
    // für das vorliegende Szenario wohl relevant sein könnten und dann
    // entsprechende Terme zu konstruieren wie oben.
    // Und wenn irgendwas sowohl optisch gut als auch die Formel plausibel wirkt...
    // -> Glückwunsch :)

    return shade;
}

void render(in Ray ray, out vec3 col, out DebugValues debug)
{
    // Sowohl Pixelfarbe als auch "verbleibende Lichtstärke des Strahls" werden akkumuliert.
    // Farbe fängt bei Schwarz an und wird immer weiter beleuchtet:
    col = c.yyy;
    // "Attenuation" fängt mit weißer Farbe an und wird dann durchs Tracing sukzessive kleiner,
    // also "wie viel Licht ist noch verfügbar pro Farbkanal?"
    vec3 attenuation = c.xxx;

    vec3 bgCol = vecSkyColor;

    Hit hit;
    int bounce;
    for (bounce = 0; bounce < iRayTracingIterations; bounce++) {
        // Erste Mission: Ersten Strahlabstand finden, d.h. wie gehabt:
        // Marching durch map() und bei minimaler SDF das Material merken.
        raymarch(ray, hit, debug);

        if (bounce == 0) {
            debug.firstHit = hit;
        }

        if (hit.material == NO_MATERIAL) {
            col += attenuation * bgCol;
            break;
        }

        // Wir variieren hier ein bisschen:
        // vec3 baseColor = materialPalette(hit.material);
        // -> mehr Flexibilität, dem "struct Hit" ein Feld seiner Grundfarbe zu geben.
        //    Das wird dann je nach Art Material (hit.material) und dem
        //    hier unten definierten Beleuchtungsmodell weiterverarbeitet,
        //    so kann aber z.B. auch METAL oder GLASS eine bunte Tönung bekommen.
        vec3 baseColor = hit.baseColor;
        // Anteil des Specular-Lichts (könnte man z.B. auch nach einer Formel von hit.material wählen)
        float specularCoeff = 1.;

        bool isFloor = hit.material == FLOOR_MATERIAL;

        vec3 rayHit = ray.origin + hit.t * ray.dir;

        vec3 normal = isFloor ? vec3(0., 1. , 0.) : calcNormal(rayHit);

        // DEBUGGING!
        if (abs(length(ray.dir) - 1.) > 0.01) {
            col = c.yyx;
            return;
        }
        if (abs(length(normal) - 1.) > 0.01) {
            col = c.xxy;
            return;
        }

        if (isFloor) {
            // der Boden ist ein einfaches Beispiel, dass wir hier nach Laune jedes Material
            // noch in ihrer Grundbeschaffenheit (z.B. Farbe nach einem Muster) ändern können
            // -> sowas gehört eher selten in map(), sondern hier vor unser Beleuchtungsmodell.
            float f = 1. - abs(step(0.5, fract(2.*rayHit.x)) - step(0.5, fract(2.*rayHit.z)));
            baseColor *= 0.1 + f * vec3(0.04);
            specularCoeff = 0.4;
        }

        if (hit.material == STANDARD_OPAQUE_MATERIAL || isFloor) {
            // Hier das alte Beleuchtungsmodell -- opak == blickdichtes Material,
            // d.h. die Beiträge wie in VL5 besprochen (plus etwas mehr),
            // ausgelagert in eigene Funktion zur Übersichtlichkeit.
            vec3 shade = shadeForOpaqueMaterial(ray, rayHit, normal, baseColor, specularCoeff);

            col += attenuation * shade;

            // Die äußere Ray-Tracing-Schleife (bounce) ist demzufolge zuende:
            break;
        }
        else if (hit.material == GLASS_MATERIAL) {
            // Lichtbrechung: Übergang von I(ncoming) nach T(ransmitted)
            float cosIncoming = dot(ray.dir, normal);
            // eta: "Permittivitätskonstante" an Grenzfläche als Quotient
            // (Wellenlänge im Material kürzer als außen, Brechungsindex von Luft == 1.)
            float eta = 1. / iEtaGlassRefraction;
            // Muss Richtung des Übergangs beachten und ggf. tauschen,
            // dabei auch den Normalenvektor in die andere Richtung spiegeln,
            // weil der nach außen zeigen muss.
            if (cosIncoming > 0.0) {
                eta = iEtaGlassRefraction;
                normal = -normal;
                cosIncoming = -cosIncoming;
            }
            // Es gibt dann eigentlich den Gebrochenen UND den Reflektierten Strahl.
            // -> Funktionen werden uns ja beide von GLSL geschenkt.
            vec3 reflected = reflect(ray.dir, normal);
            vec3 refracted = refract(ray.dir, normal, eta);
            // Die Vektoren im Argument (Einfallsrichtung + Normalenvektor)
            // müssen aber wirklich, wirklich normiert sein dafür! z.B. an
            // reflect(vec, normal) == a - 2. * dot(a, normal) * normal;
            // sieht man, dass bei falsch normierter Normalen das Ergebnis
            // dann einfach mal irgendwo in eine andere Richtung zeigt :|
            // (refract() ist komplizierter: https://registry.khronos.org/OpenGL-Refpages/gl4/html/refract.xhtml)

            // Nach echter Licht-Wellenphysik modelliert.
            // Kann man (wie so oft) hier so hinnehmen, aber bei Interesse:
            // https://de.wikipedia.org/wiki/Snelliussches_Brechungsgesetz
            // Das ist ja aber keine Physikvorlesung -> einfach übernehmen :)
            // Für unseren Fall interessant ist die Vereinfachung:
            // Normalerweise hat man nach der Brechung einen Vektor ins Material
            // und DAZU einen an der Oberfläche reflektierten (ähnlich Metall).
            // Aufteilen wäre in dieser Schleife etwas tricky,
            // weil die Richtung deterministisch ist und weil GLSL keine Rekursion bietet.
            // -> wir beachten _nur_ den gebrochenen Vektor,
            //    mit Ausnahme der "Totalreflexion" (s.u.) bei
            //    (wobei wir natürlich einen einzelnen Reflektions-Ray casten könnten...
            //    TODO: mal ausprobieren, wie da wirkt und ob performant.

            // Totalreflexion passiert bei flachen Winkeln und ausreichenden eta,
            // (lässt sich alles aus dem Snell-Gesetz ableiten), relevant hier ist,
            // dass dann also refracted === vec3(0.) ist.
            if (length(refracted) < epsilon) {
                ray.dir = reflected;
                ray.origin = rayHit + epsilon * ray.dir;
                // <-- Vorsorge gegen numerische Float-Fluktuationen auch hier
                attenuation *= baseColor;
                continue;
            }

            // Falls also nicht Totalreflexion, gehen wir nur mit refracted weiter:
            ray.dir = refracted;
            ray.origin = rayHit + epsilon * ray.dir;

            // Schlick-Fresnel-Formel für wie hell der gebrochene Strahl noch ist:
            // (folgt auch aus den physikalischen Grundlagen)
            float r0 = (1. - eta) / (1. + eta);
            r0 = r0 * r0;
            float cosRefr = -dot(refracted, normal);
            float reflectance = r0 + (1. - r0) * pow((1. - cosRefr), 5.);

            // Diese gesamte Mathematik kann man manuell optimieren,
            // aber stellt sich heraus, dass das für heute nicht nötig ist :)

            attenuation *= baseColor;
            col += attenuation * reflectance;
            continue;
        }
        else if (hit.material == METAL_MATERIAL) {
            // Neuer Strahl geht jetzt vom Auftrittspunkt in die reflect()–Richtung.
            // "+ 0.001 * normal" dient der numerischen Entzerrung, um nicht in Grenzfällen
            // versehentlich nochmal am selben Punkt zu interagieren ("Self-Interactions")
            ray.origin = rayHit + 0.001 * normal;
            ray.dir = reflect(ray.dir, normal);
            // die Reflektanz gibt an, wie viel schwächter das Licht wird (z.B. Faktor 0.8)
            // und das Metall könnte (wenn baseColor != c.xxx) Farben verschieden abschwächen.
            attenuation *= iMetalReflectance * baseColor;
            continue;
        }
        else if (hit.material == PLAIN_DEBUGGING_MATERIAL) {
            col = hit.baseColor;
            break;
        }
    }

    // Distanznebel ist quasi post-processing auf dem Tracing-Resultat,
    // kann also hier bleiben. Wir setzen gleich Himmelsfarbe, wird sonst hässlich.
    const float fogDensity = 0.0001;
    const float fogGrowth = 3.0;
    float fogOpacity = 1.0 - exp( -fogDensity * pow(hit.t, fogGrowth));
    col = mix(col, vecSkyColor, fogOpacity);

    col = pow(col, vec3(1./iGammaCorrection));
    col = clamp(col, 0.0, 1.0);

    debug.bounces = bounce;
    debug.lastHit = hit;
    debug.attenuation = attenuation;
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
    // pan normiert auf x und y je [-0.5, 0.5]
    vec2 pan = iMouse.xy / iResolution.xy - 0.5;
    // aber nur wenn Maus gedrückt.
    if (iMouse.xy == c.yy) {
        pan = c.yy;
    }

    vec3 cameraTarget = vec3(0.4, 0.4, 1.);

    // _Zusätzliche_ Kamera-Drehung per Maus über Pitch-Eulerwinkel (Neigung):
    float pitch = -pan.y * pi/3.;
    //
    cameraTarget.y -= 2. * pan.y;

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
    float fovRadians = iFieldOfViewDegrees * pi / 180.;
    float focalLength = 0.5 / tan(0.5 * fovRadians);
    // focalLength = 2.5; // <-- Ursprungswert
    vec3 rayDirection = cameraMatrix * normalize(vec3(uv, focalLength));

    Ray ray = Ray(rayOrigin, rayDirection);
    vec3 col;
    DebugValues debug;

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
            fragColor.rgb = vec3(debug.firstHit.t / MARCHING_MAX_DISTANCE);
            break;
        case 4:
            fragColor.rgb = debug.attenuation;
            break;
    }
}
