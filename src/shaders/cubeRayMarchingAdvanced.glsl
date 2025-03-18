#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 iResolution;
uniform float iTime;

const float pi = 3.141593;

// Rotation matrix around the X axis.
mat3 rotateX(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat3(
        vec3(1, 0, 0),
        vec3(0, c, -s),
        vec3(0, s, c)
    );
}

const int MAX_MARCHING_STEPS = 255;
const float MIN_DIST = 0.0;
const float MAX_DIST = 100.0;
const float PRECISION = 0.001;

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
    float sd;
    vec3 col;
};

void wobbleDistort(inout Surface surface, vec3 p, float amp, vec3 scale) {
    surface.sd += amp * sin(scale.x*p.x) * sin(scale.y*p.y) * sin(scale.z*p.z);
}

float checkerboard(vec2 p, float scale) {
    vec2 ip = floor(p * scale);
    return mod(ip.x + ip.y, 2.0);
}

float blurredCheckerPattern(vec3 p, float blurRadius, float checkerSize) {
    vec2 surface = vec2(
    atan(p.z, p.x) / (2. * 3.14159) + 0.5,
    p.y / 2. + 0.5
    );

    // Gaussian weights for 5x5 kernel
    float weights[25] = float[](
    0.003765, 0.015019, 0.023792, 0.015019, 0.003765,
    0.015019, 0.059912, 0.094907, 0.059912, 0.015019,
    0.023792, 0.094907, 0.150644, 0.094907, 0.023792,
    0.015019, 0.059912, 0.094907, 0.059912, 0.015019,
    0.003765, 0.015019, 0.023792, 0.015019, 0.003765
    );

    float sum;
    float pixelScale = 1./iResolution.y;
    int index = 0;
    for(float y = -2.0; y <= 2.0; y++) {
        for(float x = -2.0; x <= 2.0; x++) {
            vec2 offset = vec2(x, y) * pixelScale * blurRadius;
            sum += checkerboard(surface + offset, checkerSize) * weights[index];
            index++;
        }
    }
    return sum;
}


Surface sdSphere( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform) {
    p = (p - offset) * transform;
    vec3 q = abs(p) - b;
    float d = length(p / b) - 1.;
    return Surface(d, col);
}

Surface sdPatternSphere( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform, vec3 checkerCol, float nSegments, float blurRadius) {
    p = (p - offset) * transform;
    vec3 q = abs(p) - b;
    float d = length(p / b) - 1.;
    col = mix(col, checkerCol, blurredCheckerPattern(p, blurRadius, nSegments));
    return Surface(d, col);
}

Surface sdBox( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform) {
    p = (p - offset) * transform;
    vec3 q = abs(p) - b;
    float d = length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
    return Surface(d, col);
}

float floorLevel = -4.;

Surface sdFloor(vec3 p, vec3 col) {
    float d = p.y - floorLevel;
    return Surface(d, col);
}

Surface takeCloser(Surface obj1, Surface obj2) {
    if (obj2.sd < obj1.sd) {
        return obj2;
    }
    return obj1;
}

Surface sdScene(vec3 p) {
    vec3 floorColor = (0.5 + 0.15 * mod(floor(p.x) + floor(p.z), 4.0)) * vec3(0.9, 1., .95);
    Surface co = sdFloor(p, floorColor);
    Surface box, ball;
    box = sdBox(p, vec3(1.), vec3(-2., floorLevel + 1., -2.), vec3(1, 0.1, 0.4), identity());
    co = takeCloser(co, box);
    box = sdBox(p, vec3(1.2), vec3(3, floorLevel + 1.2, -3.), vec3(0.2, 0.65, 0.9), rotateY(0.25 * pi));

    //    wobbleDistort(box, p, 0.03, vec3(20., 10., 16. + 0. * 3. * iTime));

    co = takeCloser(co, box);

    //    ball = sdPatternSphere(p, vec3(1.), vec3(-2., floorLevel + 1., -2.), vec3(1, 0.1, 0.8), identity(), vec3(0.5, 0.2, 0.8), 8., 0.5);

    //    mat3 ballTransform = rotateY(0.5 * iTime);
    //    ball = sdSphere(p, vec3(1.), vec3(-2., floorLevel + 1., -2.), vec3(1, 0.6, 0.8), ballTransform);
    //    co = takeCloser(co, ball);

    return co;
}

Surface rayMarch(vec3 ro, vec3 rd, float start, float end) {
    float rayLength = start;
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
    float tMax = 2.;
    float w = 0.1;

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

void main() {
    vec2 uv = (-1.0 + 2.0 * gl_FragCoord.xy / iResolution.xy) * vec2(iResolution.x / iResolution.y, 1.0);

    vec3 backgroundColor = vec3(0.8, 0.3 + uv.y, 1.);

    vec3 ro = vec3(0., 0., 1.);
    vec3 rd = normalize(vec3(uv, -1.));
    rd *= rotateX(-0.3 * pi);

    Surface co = rayMarch(ro, rd, MIN_DIST, MAX_DIST);
    vec3 col = co.col;
    float d = co.sd;

    if (co.sd > MAX_DIST) {
        col = backgroundColor;
    } else {
        vec3 p = ro + rd * co.sd;
        vec3 normal = calcNormal(p);
        vec3 lightPosition = vec3(3., 3., -3.);
        vec3 lightDirection = normalize(lightPosition - p);

        // could also have parallel light
        // lightDirection = normalize(vec3(0., 1., 0.));

        d = clamp(d, 0., 1.);

        // Lambertian reflection:
        // proportional to amount of light hitting the surface
        // i.e. dot(normal, lightDir) ~ large if Angle between normal and light is low
        // Quasi "perfekte" Diffusion, warum?
        float diffuse = dot(normal, lightDirection);
        diffuse = clamp(diffuse, 0., 1.);
        d = mix(d, diffuse, 0.1);

        // sekundäres Ray Marching für Schatten
        float shadow = rayMarchShadow(p, lightDirection);
        d = mix(d, shadow, 0.8);

        // Specular reflection:
        // proportional to angle between ray and reflections
        vec3 refl = reflect(lightDirection, normal);
        float specular = dot(refl, normalize(p));
        specular = clamp(specular, 0., 1.);
        specular = 1.4 * pow(specular, 1.);
        d = mix(d, specular, 0.6);

        // verschiedenartiges Color Grading
        d = mix(d, pow(co.sd, 1.8), 0.01);
        d = clamp(d, 0., 1.);
        col = d * co.col;

        // Distance Fog: Abschwächen je nach durchlaufenem Abstand
        col *= exp(-0.0001 * pow(co.sd, 3.)) * vec3(0.9, 0.8, 0.7);
    }

    // Beispiel Post-Processing (transformiert nur noch Farbe -> Farbe, nicht mehr Geometrie)
    // col = atan(8. * pow(col, vec3(5.)));

    fragColor = vec4(col, 1.0);
}
