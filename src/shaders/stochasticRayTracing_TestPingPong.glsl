#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;
uniform int iRenderToScreen;
uniform sampler2D iPreviousRender;

vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 c = vec3(1,0,-1);
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


void main() {
    vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    vec2 st = gl_FragCoord.xy / iResolution.xy;
    vec4 renderResult = texture(iPreviousRender, st);
    if (iRenderToScreen == 1) {
        fragColor = renderResult;
        return;
    }

    vec3 col = hsv2rgb(
        vec3(
            mod(0.1 * iTime, 360.),
            0.75 + 0.25 * cos(0.2 * iTime),
            1.
        )
    );

    float testRows = 50.;
    float testFrameIndex = mod(float(iFrame), testRows);
    float limitRange = 1.;
    float row = (uv.y + 1.) * 0.5 * testRows;
    float onlyRow = float(row >= testFrameIndex && row < testFrameIndex + 1.);
    col *= onlyRow;

    fragColor = vec4(col, 1.);

    if (iFrame == 0) {
        // Im ersten Frame gibt es ja kein altes Bild. Was will man tun.
        return;
    }

    // Vergleich zum Test: in der rechten Hälfte mischen wir das alte Bild bei.
    if (uv.x > 0.) {
        // Der Streifen ist ja stellvertretend für einen Lichtstrahl, d.h.
        // die Frage ist jetzt wieder, wie wir mischen sollten.

        // Nur zum ersten Check -- Erinnerung: Bei max() gewinnt pro RGB-Wert der Hellere.
        // (Ist wenig sinnvoll, wenn z.B: "Grün" durch "Rot" aktualisiert wird und dann "Gelb" rauskommt.)
        // Reicht aber um zu sehen dass die Methode funktioniert.
        // Der Faktor (leicht unterhalb 1) hier mal nur, damit nicht all zu alte Farben stehen bleiben.
        fragColor.rgb = max(col, renderResult.rgb * 0.95);

        vec3 previousOklab = rgb2oklab(renderResult.rgb);
        vec3 colOklab = rgb2oklab(col);
        // ist ja Lichtmischung - wäre vielleicht also sinnvoll, nach Helligkeit anteilig zu mischen?
        float colWeight = colOklab.x / (colOklab.x + previousOklab.x);
        // colOklab = mix(colOklab, previousOklab, 0.1);
        //fragColor.rgb = oklab2rgb(colOklab);
    }
}
