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

// Identity matrix.
mat3 identity() {
    return mat3(
        vec3(1, 0, 0),
        vec3(0, 1, 0),
        vec3(0, 0, 1)
        );
}

struct Surface {
    float sd;
    vec3 col;
};

Surface sdBox( vec3 p, vec3 b, vec3 offset, vec3 col, mat3 transform)
{
    p = (p - offset) * transform; // apply transformation matrix
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
    Surface box = sdBox(p, vec3(1), vec3(-2., floorLevel + 1., -2.), vec3(1, 0.1, 0.4), identity());
    co = takeCloser(co, box);
    box = sdBox(p, vec3(1.2), vec3(3, floorLevel + 1.2, -3.), vec3(0.2, 0.65, 0.9), rotateY(0.25 * pi));
    co = takeCloser(co, box);
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
    float time = iTime;
    time = 0.; // <-- fixate time for now

    vec3 backgroundColor = vec3(0.8, 0.3 + uv.y, 1.);

    vec3 col = vec3(0.);
    vec3 ro = vec3(0., 0., 1.);
    vec3 rd = normalize(vec3(uv, -1.));

    rd *= rotateX(-0.3 * pi + 0.00 * sin(2. * iTime));

    Surface co = rayMarch(ro, rd, MIN_DIST, MAX_DIST);

    if (co.sd > MAX_DIST) {
        col = backgroundColor;
    } else {
        vec3 p = ro + rd * co.sd;
        vec3 normal = calcNormal(p);
        vec3 lightPosition = vec3(0., 4., 5.);
        // Surface box = sdBox(p, vec3(1), vec3(-2., floorLevel + 1., -2.), vec3(1, 0.1, 0.4), identity());
        lightPosition = vec3(+4., floorLevel + 6., -2.); // directly over the cube
        vec3 lightDirection = normalize(lightPosition - p);
        // switch from point light to parallel light
        // lightDirection = normalize(vec3(0., 1., 0.));

        // Lambertian reflection:
        // proportional to amount of light hitting the surface
        // i.e. dot(normal, lightDir) ~ large if Angle between normal and light is low
        // -> orthogonal: nothing
        // -> parallel: full amount
        // why would this be "perfect diffusion"?
        float dif = dot(normal, lightDirection);
        dif = clamp(dif, 0., 1.);

        // Mische Bild mit Bild-mit-Schatten (diffus)
        float shadow = rayMarchShadow(p, lightDirection);
        dif = mix(dif, shadow, 0.8);

        // Specular reflection:
        // proportional to angle between ray and _reflection_
        vec3 refl = reflect(lightDirection, normal);
        float spec = dot(refl, normalize(p));
        spec = clamp(spec, 0., 1.);
        spec = pow(spec, 3.);
        dif = mix(dif, spec, 0.6);

        // könnte Schatten aufhellen
        dif = mix(dif, co.sd, 0.1);

        // scale for better visuals
        dif = clamp(dif, 0., 1.);
        col = dif * co.col;
        // col += 0.1 * backgroundColor; // why would we do that??

        // Diminishing according to marched distance ~ Fog
        col *= exp(-0.0001 * co.sd * co.sd * co.sd) * vec3(0.9, 0.8, 0.7);
    }

    // col = atan(8. * pow(col, vec3(5.)));

    fragColor = vec4(col, 1.0);
}
