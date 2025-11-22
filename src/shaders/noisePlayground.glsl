#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform float iGridOpacity;
uniform float iNoiseLevelA;
uniform float iNoiseLevelB;
uniform vec2 iOverallNoiseShift;
uniform float iOverallScale;
uniform float iOverallHashOffset;
uniform float iOverallHashMorphing;
uniform int iFractionSteps;
uniform float iFractionScale;
uniform float iFractionAmplitude;
uniform float iMeanOffsetForNoiseA;
uniform float iNormFactorForNoiseA;
uniform float iMeanOffsetForNoiseB;
uniform float iNormFactorForNoiseB;
uniform vec3 vecFree;
uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;

vec4 c = vec4(1., 0., -1., .5);

const float twoPi = 6.28319;

/// Gitter nur zur Veranschaulichung der Längeneinheiten

void applyGrid(inout vec3 col, in vec2 uv, float gridStep) {
    uv = mod(uv, gridStep);
    float dMin = min(uv.x, uv.y);
    col = c.xxx * step(dMin, fwidth(dMin));
}

/// Ab hier: Noise.

vec2 hash22(vec2 p)
{
    // Einfacher Pseudorandom-Generator der "Hash"-Art, mit der Anforderung,
    // "mathematisch recht einfache" Operationen zu verwenden (-> sin(), fract(), dot(), ...)
    // aber bei leichter Veränderung vom Argument p so stark variieren,
    // dass sie beim einfachen menschlichen Draufschauen aussehen wie zufällig ausgewürfelt.
    //
    // Hashfunktionen gibt es für verschiedene Dimensionalität des Arguments (float / vec2 / vec3 / vec4 p),
    // und in verschiedenen Ausgabedimensionen (return float / vec2 / vec3 / vec4).
    // Eine Hashfunktion gibt aber immer denselben Wert für dasselbe Argument zurück (= deterministisch)
    // und hat oft auch Bereiche des Arguments, in denen es überhaupt nicht sehr "zufällig" aussieht.
    // Manche sind auch auf bestimmte Anwendungsfälle optimiert,
    // d.h. man sucht sich in der Praxis eben eine - oder mehrere und vergleicht diese.
    p = p*mat2(127.1,311.7,269.5,183.3);
    p = -1.0 + 2.0 * fract(sin(p + .01 * iOverallHashOffset)*43758.5453123);
    return sin(twoPi * p + iOverallHashMorphing * iTime);
}

float perlin2D(vec2 p)
{
    // Perlin-Noise ist eine Art eines "Gradientrauschen":
    // Dabei werden Pseudozufallszahlen (wie aus einer Hash-Funktion) in größeren Abständen "platziert"
    // und dazwischen geeignet interpoliert, um also für Menschen zufällig auszusehen, aber nicht
    // zwischen benachbarten Pixeln so stark, sondern auf einer breiteren "Skala" (bzw. Frequenz).
    // -> "langsamere" / ausgedehntere Zufallsmuster.
    // Damit lassen sich zufälligere Wellenformen imitieren (als es sin() / cos() allein hergeben würde),.
    // was es interessant macht für Wellen, Berge, Wolken, Wellen, zerkratze Oberflächen, etc.
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

float noiseStack(vec2 p){
    // das Verfahren heißt auch "fBM" = "fractional Brownian Motion",
    // weil es ähnlich ist zu Diffusionsprozessen in der Natur
    // (https://de.wikipedia.org/wiki/Brownsche_Bewegung)
    // Diese Gegebenheiten sind aber für unsere Anwendungen nicht relevant,
    // es ist hier nur erwähnt, um den Namen zu begründen.
    // Gewöhnliche Werte sind etwa
    //   iFractionSteps ~ 4-5
    //   iFractionScale == 2
    //   iFractionAmplitude == 0.5
    // und ist auch meist konstant, aber hier mal zum Anschauen als Uniform definiert.
    float a = 1., s = 0., sum = 0.;
    float noise;
    for (int i=0; i < iFractionSteps; i++) {
        noise = perlin2D(p);

        // Hier könnte Platz zur Variation sein ;)
        sum += a * noise;

        s += a;
        p *= iFractionScale;
        a *= iFractionAmplitude;
    }
    // Ausgabewert soll _etwa_ in [0, 1] liegen, mit 0.5 = neutral.
    // Es kann aber stark von den Fraktal-Parametern und der Hashfunktion abhängig sein,
    // was da für Intervalle herauskommen. Man könnte da z.B. mal über gl.readPixels()
    // direkt das gerenderte Bild auswerten und anhand dessen die Normierung bestimmen.
    return (sum / s + iMeanOffsetForNoiseA) * iNormFactorForNoiseA;
}

float noiseAbsoluteStack(vec2 p){
    // fast gleich zu noiseStack(p), nur dass hier abs(noise) pro Schicht genommen wird.
    // Es gibt aber noch etliche weitere Varianten dieses Vorgehens.
    float a = 1., s = 0., sum = 0.;
    float noise;
    for (int i=0; i < iFractionSteps; i++) {
        noise = perlin2D(p);

        // Hier könnte Platz zur Variation sein ;)
        sum += a * abs(noise);
        // z.B. mal auf die Suche machen:
        // "Rigged FBM"?
        // "Billowed FBM"?

        s += a;
        p *= iFractionScale;
        a *= iFractionAmplitude;
    }
    // Ausgabewert soll in [0, 1] liegen
    // (wobei ungünstige Kombinationen iFractionScale / iFractionAmplitude auch > 1. summieren KÖNNTEN)
    // erstmal frei einstellbar, siehe Kommentar in noiseStack()
    sum = pow(sum / s, 12.);
    return (sum / s + iMeanOffsetForNoiseB) * iNormFactorForNoiseB;
}

float symmetricalMix(float v0, float v1, float ratio) {
    /*
    Kleine Hilfsfunktion, um für ratio von 0 bis -1 so zu blenden,
    als ob man das Negativ von v1 mit dem zugehörigen abs(ratio) mixt:
      symmetricalMix(v0, v1, -1) == 1. - v1
    Im Gegensatz zum Standardverhalten von mix:
      mix(v0, v1, ratio) == (1 - ratio) * v0 + (ratio) * v1
      -> mix(v0, v1, -1) == 2 * v0 - v1

    Das machen wir hier aber nur, weil unsere Noise-Felder genausogut
    als ihr Negativ, d.h. als (1.-noise()) definiert werden könnten,
    und wir so einfacher interessantere Überlagerungen erzeugen können.
    */
    if (ratio < 0.) {
        v1 = 1. - v1;
        ratio = -ratio;
    }
    return mix(v0, v1, ratio);
}

void main() {
    vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    uv *= iOverallScale;

    vec3 gridCol;
    applyGrid(gridCol, uv, 0.5);

    // Auswertung sin-basierter Hashes (s.o.) ist nahe Nullwerten häufig
    // zu strukturbehaftet, taugt da also nicht als guter "Zufallsgenerator".
    // D.h. man verschiebt sich gewöhnlich in regelmäßigere Bereiche.
    // Ruhig aber mal den iOverallNoiseShift auf 0 stellen, um diesen Effekt auch zu sehen...
    uv += iOverallNoiseShift;

    // "Wolken" und "Turbulenz" sind gängige Begriffe für diese Strukturen,
    // aber die Anwendungsmöglichkeiten sind noch viel vielfältiger (Feuer, Blitze, Berge, etc.)
    // Hier also nur zur erstbesten Unterscheidung gewählt,
    // im Kontext macht das Farb-/Beleuchtungsmodell den richtigen Unterschied ;)
    float noiseClouds =
        symmetricalMix(1., noiseStack(uv), iNoiseLevelA);
    float noiseTurbulence =
        symmetricalMix(1., noiseAbsoluteStack(uv), iNoiseLevelB);

    // Obacht: Auch mit wenigen Iterationen ("Oktaven") kann ein FBM-Noise über
    // die geschachtelte Struktur zur Performancesenke werden.
    // Das kann u.U. erst später bemerkbar werden, wenn durch das Zusammenspiel
    // der GPU dadurch dann Resources ausgehen, die beim Grundgerüst noch easy da sind.

    // Verknüpfung hier mal einfach multiplikativ als Graustufen:
    float totalNoise = noiseClouds * noiseTurbulence;
    vec3 col = vec3(totalNoise);

    col = col - iGridOpacity * gridCol;
    fragColor = vec4(col, 1.);
}
