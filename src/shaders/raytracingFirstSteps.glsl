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
uniform float iAmbientOcclusionSamples;
uniform int iRayTracingIterations;
uniform float iMetalReflectance;
uniform float iGammaCorrection;
uniform float iNoiseLevel;
uniform float iNoiseFreq;
uniform float iNoiseOffset;
uniform int iFractionSteps;
uniform float iFractionScale;
uniform float iFractionAmplitude;
uniform int doRenderDebugValues;

// for you to play around with, put 'em wherever you want:
uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;

const float pi = 3.141593;
const float twoPi = 2. * pi;
const vec4 c = vec4(1., 0. , -1., .5);

// Das "material"-float berechnet einerseits ja die Farbe aus der Palettenfunktion,
// aber ein paar spezielle Werte definieren wir hier mal vorweg:
const float FLOOR_MATERIAL = 1.0;
const float NOTHING_HIT = -1.;
const float STANDARD_OPAQUE_MATERIAL = 2.0;
const float GLASS_MATERIAL = 3.;
const float METAL_MATERIAL = 4.;
const float PLAIN_DEBUGGING_MATERIAL = 0.5;

const float indexOfRefractionAir = 1.0;
const float indexOfRefractionGlass = 1.5;

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

//////////// für die Noise-Berge

vec2 hash22(vec2 p) {
    // this is a pseudorandom generator with 2d input -> 2d output
    float n = sin(dot(p, vec2(127.1, 311.7))) * 43758.5453;
    // iNoiseOffset: braucht man nicht, ist nur eine Chance auf mehr Abwechslung
    n += iNoiseOffset;
    return fract(vec2(n, n * 1.2154));
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
    float material;
    // vec2 surfaceCoord;
    //  <-- wir lassen heute Texturen weg, also das hier unnötig
    vec3 baseColor;
    //  <-- dafür schreiben wir eine Oberflächenfarbe direkt mit,
    //      "float material" beschreibt dann allein die _Art_ Material
};

struct TracingDebug {
    float bouncesVsMaximum;
    Hit firstHit;
    vec3 throughput;
};

////

// zum debuggen,
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

Hit takeCloser( Hit d1, float d2, float material2, vec3 intrinsicColor)
{
    if (d1.t < d2) return d1;
    return Hit(d2, material2, intrinsicColor);
}

vec3 materialPalette(float parameter) {
    return 0.2 + 0.2 * sin(parameter * 2.0 + vec3(0.0,1.0,2.0));
}

Hit map( in vec3 pos )
{
    Hit res = Hit(pos.y, FLOOR_MATERIAL, c.xxx);
    // Hier war ursprünglich 0.0 initialisiert, also ein "UNKNOWN_MATERIAL" o.Ä.
    // Uns bringt diese Unterscheidung aber nichts, wir kennen unsere Szene ausreichend.

    float noiseY = sdNoiseMountains(pos - vec3(0.8,0.0,-1.6));
    res = takeCloser(res,
        Hit(noiseY, FLOOR_MATERIAL, c.xxx)
    );

    // Primitives

    res = takeCloser(res,
        sdTorus((pos-vec3( .4 + 1.4 * sin(twoPi * 0.5 * iTime), 0.30, 0.5)).xzy, vec2(0.25,0.05) ),
        STANDARD_OPAQUE_MATERIAL,
        materialPalette(7.1)
    );
    res = takeCloser(res,
        sdSphere(pos-vec3( 0.25,0.33, 1.0), 0.33 ),
        STANDARD_OPAQUE_MATERIAL,
        materialPalette(26.9)
    );
    res = takeCloser(res,
        sdSphere(pos-vec3( 1.0, 0.25, 0.15), 0.25 ),
        GLASS_MATERIAL,
        c.xxx
    );
    res = takeCloser(res,
        sdBox((pos - vec3( -0.5,0.5, 2.)), 0.5 * c.xxx),
        GLASS_MATERIAL,
        vec3(0.5, 0.8, 1.)
    );
    res = takeCloser(res,
        sdBox(rotY(0.73) * (pos - vec3( 1.,0.34, 2.)), 0.34 * c.xxx),
        METAL_MATERIAL,
        c.xxx
    );
    res = takeCloser(res,
        sdSolidAngle(rotX(0.1)*rotZ(0.2)*(pos-vec3(0.,-6.,-4.7)), vec2(1,4)/sqrt(17.), 10. ),
        METAL_MATERIAL,
        vec3(0.88, 0.67, 1.0)
    );


    // Als Hilfe für die Entwicklung (z.B. Geometrien positionieren oder Kamera ausrichten):

    for (int m = 0; m < N_DEBUG_MARKERS; m++) {
        res = takeCloser(res,
            sdSphere(pos - debuggingMarkers[m], 0.03),
            PLAIN_DEBUGGING_MATERIAL,
            c.yyy
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

const float MARCHING_MIN_DISTANCE = 0.1;
const float MARCHING_MAX_DISTANCE = 20.;

// Funktion umbenannt, sie hieß bisher raycast(), das fand ich aber nicht so gut.
Hit raymarch(in Ray ray)
{
    Hit res = Hit(-1.0, NOTHING_HIT, c.yyy);

    float tmin = MARCHING_MIN_DISTANCE;
    float tmax = MARCHING_MAX_DISTANCE;

    // trace floor plane analytically
    float tp1 = (0.0-ray.origin.y)/ray.dir.y;
    if( tp1>0.0 )
    {
        tmax = min( tmax, tp1 );
        res = Hit(tp1, FLOOR_MATERIAL, c.xxx);
    }

    // Hier habe ich die "Bounding Box" entfernt, da der Performance-Gewinn
    // die Extra-Komplexität / Lesbarkeit nicht rechtfertigt hat (bei mir zumindest).
    // Wenn insgesamt zu langsam -> wieder einführen :)

    float t = tmin;
    for( int i=0; i<70 && t<tmax; i++ )
    {
        ///////////// HIER: map() ///////////////
        Hit h = map( ray.origin + ray.dir * t );
        /////////////////////////////////////////

        if(abs(h.t)<(0.0001*t) )
        {
            res = h;
            res.t = t;
            break;
        }
        t += h.t;
    }

    return res;
}

// https://iquilezles.org/articles/rmshadows
float calcSoftshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax )
{
    // bounding volume
    float tp = (0.8-ro.y)/rd.y; if( tp>0.0 ) tmax = min( tmax, tp );

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
        float s = clamp(8.0*h/t,0.0,1.0);
        res = min( res, s );
        // - Schrittweite begrenzen, wir wollen viele Schattenbeiträge in der Nähe sammeln,
        //   ergibt dann weiche Schatten, nicht nur klares "irgendwas ist im Weg" vs. "nicht".
        t += clamp( h, 0.01, 0.2 );
        if( res<0.004 || t>tmax ) break;
    }
    /*
      res = clamp( res, 0.0, 1.0 );
      return res*res*(3.0-2.0*res);
    */
    // <-- sowas steht in manchen Shadern, aber es entspricht eins-zu-eins:
    return smoothstep(0., 1., res);
}


// https://iquilezles.org/articles/nvscene2008/rwwtt.pdf
float calcAmbientOcclusion(in vec3 pos, in vec3 normal)
{   // Ambient Occlusion: Metrik für den Grad der Verdeckung / Verwinkeltheit
    // Parameter als Uniform erklärt:
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

void render(in Ray ray, out vec3 col, out TracingDebug debug)
{
    // Sowohl Pixelfarbe als auch "verbleibende Lichtstärke des Strahls" werden akkumuliert.
    // Farbe fängt bei Schwarz an und wird immer weiter beleuchtet:
    col = c.yyy;
    // throughput fängt mit weißer Farbe an und wird dann durchs Tracing sukzessive verringert,
    // also "wie viel Licht ist noch verfügbar pro Farbkanal?"
    vec3 throughput = c.xxx;

    vec3 bgCol = vecSkyColor;

    Hit hit;
    int bounce;
    for (bounce = 0; bounce < iRayTracingIterations; bounce++) {
        // Erste Mission: Ersten Strahlabstand finden, d.h. wie gehabt:
        // Marching durch map() und bei minimaler SDF das Material merken.
        hit = raymarch(ray);

        if (bounce == 0) {
            debug.firstHit = hit;
        }

        if (hit.material == NOTHING_HIT) {
            col += throughput * bgCol;
            break;
        }

        // Wir variieren hier ein bisschen:
        // vec3 baseColor = materialPalette(hit.material);
        // -> mehr Flexibilität, dem "struct Hit" ein Feld seiner Grundfarbe zu geben.
        //    Das wird dann je nach Art Material (hit.material) und dem
        //    hier unten definierten Beleuchtungsmodell weiterverarbeitet,
        //    so kann aber z.B. auch METAL oder GLASS eine bunte Tönung bekommen.
        vec3 baseColor = hit.baseColor * throughput;
        // Anteil des Specular-Lichts (könnte man z.B. auch nach einer Formel von hit.material wählen)
        float specularCoeff = 1.;

        bool isFloor = hit.material == FLOOR_MATERIAL;

        vec3 rayPos = ray.origin + hit.t * ray.dir;

        vec3 normal = isFloor ? vec3(0., 1. , 0.) : calcNormal(rayPos);

        if (isFloor) {
            // der Boden ist ein einfaches Beispiel, dass wir hier nach Laune jedes Material
            // noch in ihrer Grundbeschaffenheit (z.B. Farbe nach einem Muster) ändern können
            // -> sowas gehört eher selten in map(), sondern hier vor unser Beleuchtungsmodell.
            float f = 1. - abs(step(0.5, fract(2.*rayPos.x)) - step(0.5, fract(2.*rayPos.z)));
            baseColor *= 0.1 + f * vec3(0.04);
            specularCoeff = 0.4;
        }

        if (hit.material == STANDARD_OPAQUE_MATERIAL || isFloor) {
            // Hier das alte Beleuchtungsmodell -- opak == blickdichtes Material.
            // Grob modelliert nach Blinn-Phong mit etwas Freiheit + Ambient Occlusion.
            // Manche Beleuchtungsteile starten noch ihr Shadow-Ray-Casting,
            // aber die äußere Ray-Tracing-Schleife (bounce) ist danach zuende.

            vec3 lightDirection = normalize(-vecDirectionalLight);
            // Vorzeichenkonvention: lightDirection in den Beleuchtungsmodellen ist ZUM Licht
            // (im Uniform vecDirectionalLight fand ich die andere Richtung aber geeigneter)

            // Ambient Occlusion - Faktor für die Verdecktheit / Verwinkelung an einer Stelle
            //                     (1 = quasi freie Fläche, 0 =
            float occlusion = calcAmbientOcclusion(rayPos, normal);

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
                diffuse *= calcSoftshadow(rayPos, lightDirection, 0.02, 2.5);
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
                specular *= calcSoftshadow(rayPos, refl, 0.02, 2.5);
                shade += 2.00 * specular * vecSkyColor * specularCoeff;
            }

            {
                // 3. Effekt:
                // "Backlight / Ambient Illumination", Idee ist, in eher verdeckten Bereichen
                // durch irgendwelche Spiegelungen am Boden (für unseren festen Fall y == 0)
                // die Schatten wieder etwas vermindert werden

                // vec3 lightFloorReflection = normalize(vec3(-lightDirection.x, 0., -lightDirection.z));
                vec3 lightFloorReflection = cross(lightDirection, vec3(0,1,0));

                float backlightIllumination = occlusion
                    * clamp(dot(normal, lightFloorReflection), 0.0, 1.0)
                    * clamp(1.0 - rayPos.y, 0.0, 1.0);
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
                float subsurfaceScattering = occlusion * pow(clamp(1.0+dot(normal, ray.dir), 0.0, 1.0), 2.0);
                shade += iSubsurfaceAmount * subsurfaceScattering * baseColor;
            }

            col += throughput * shade;

            // Man könnte sich hier noch weitere Effekte bzw. Kombinationen ausdenken,
            // und die Werte sind jedesmal andere (es sind empirische Modelle);
            // man sollte aber diese Begriffe zuordnen können und was sie jeweils ausmacht.

            // in der Praxis:
            // im Wesentlichen ist es legitim, sich grob zu überlegen welche Vektoren
            // für das vorliegende Szenario wohl relevant sein könnten und dann
            // entsprechende Terme zu konstruieren wie oben.
            // Und wenn irgendwas sowohl optisch gut als auch die Formel plausibel wirkt...
            // -> Glückwunsch :)

            break;
        }
        else if (hit.material == GLASS_MATERIAL) {

            // Fresnel-Term (Tiefgang s. https://de.wikipedia.org/wiki/Fresnelsche_Formeln)
            float cosi = clamp(dot(ray.dir, normal), -1.0, 1.0);
            // eta: i = incoming, t = transmitted
            float etai = indexOfRefractionAir;
            float etat = indexOfRefractionGlass;
            vec3 n = normal;
            if (cosi > 0.0) {
                // Inside the surface, swap IORs and flip normal
                float temp = etai; etai = etat; etat = temp;
                n = -normal;
            }
            float sint = etai / etat * sqrt(max(0.0, 1.0 - cosi * cosi));
            if (sint >= 1.0) {
                // Total internal reflection
                vec3 reflDir = reflect(ray.dir, n);
                ray = Ray(rayPos + reflDir*0.001, reflDir);
                throughput *= baseColor;
                continue;
            } else {
                float cost = sqrt(max(0.0, 1.0 - sint * sint));
                cosi = abs(cosi);
                float Rs = ((etat * cosi) - (etai * cost)) / ((etat * cosi) + (etai * cost));
                float Rp = ((etai * cosi) - (etat * cost)) / ((etai * cosi) + (etat * cost));
                float fresnel = (Rs * Rs + Rp * Rp) / 2.0;

                // Reflektion & Brechung - bekommen wir von GLSL :)
                vec3 reflDir = reflect(ray.dir, n);
                vec3 refrDir = refract(ray.dir, n, etai / etat);

                col += throughput * baseColor * fresnel;

                // Continue with refraction ray attenuated by (1 - fresnel)
                if (length(refrDir) < 0.001) {
                    // Strahl kommt nicht ins Material -> well, ciao
                    break;
                }
                ray = Ray(rayPos + refrDir * 0.001, refrDir);
                throughput *= baseColor * (1.0 - fresnel);
                continue;
            }
        } else if (hit.material == METAL_MATERIAL) {
            // Neuer Strahl geht jetzt vom Auftrittspunkt in die reflect()–Richtung.
            // "+ 0.01 * normal" dient der numerischen Entzerrung, um nicht in Grenzfällen
            // versehentlich nochmal am selben Punkt zu interagieren ("Self-Interactions")
            ray.origin = rayPos + 0.01 * normal;
            ray.dir = reflect(ray.dir, normal);
            // die Reflektanz gibt an, wie viel schwächter das Licht wird (z.B. Faktor 0.8)
            // und das Metall könnte (wenn baseColor != c.xxx) Farben verschieden abschwächen.
            throughput *= iMetalReflectance * baseColor;
            continue;
        }
        else if (hit.material == PLAIN_DEBUGGING_MATERIAL) {
            col = baseColor;
            break;
        }
    }

    // Distanznebel ist quasi post-processing auf dem Tracing-Resultat,
    // kann also hier bleiben.
    const vec3 colFog = vec3(0.0, 0.0, 0.0);
    const float fogDensity = 0.0001;
    const float fogGrowth = 3.0;
    float fogOpacity = 1.0 - exp( -fogDensity * pow(hit.t, fogGrowth));
    col = mix(col, vecSkyColor, fogOpacity);

    col = pow(col, vec3(1./iGammaCorrection));
    col = clamp(col, 0.0, 1.0);

    debug.bouncesVsMaximum = float(bounce) / float(iRayTracingIterations);
    debug.throughput = throughput;
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
    TracingDebug debug;

    render(ray, col, debug);

    fragColor.rgb = col;
    fragColor.a = 1.;

    switch (doRenderDebugValues) {
        case 1:
            fragColor.rgb = vec3(debug.bouncesVsMaximum);
            break;
        case 2:
            fragColor.rgb = vec3(debug.firstHit.t / MARCHING_MAX_DISTANCE);
            break;
        case 3:
            fragColor.rgb = debug.throughput;
            break;
    }
}
