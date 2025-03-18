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

Surface sdFloor(vec3 p, vec3 col) {
    float d = p.y;
    return Surface(d, col);
}

Surface takeCloser(Surface obj1, Surface obj2) {
    if (obj2.sd < obj1.sd) {
        return obj2;
    }
    return obj1;
}

Surface sdScene(vec3 p) {
    vec3 floorColor = (0.5 + 0.15 * mod(floor(0.5 * p.x) + floor(p.z), 4.0)) * vec3(0.9, 1., .95);
    Surface co = sdFloor(p, floorColor);
    Surface box = sdBox(p, vec3(1), vec3(-3., 1., -3.), vec3(1, 0.1, 0.4), identity());
    co = takeCloser(co, box);
    box = sdBox(p, vec3(1), vec3(3.5, 1., -4.5), vec3(0.2, 0.6, 0.7), rotateY(0.4 * pi));
    co = takeCloser(co, box);
    return co;
}

Surface rayMarch(vec3 ro, vec3 rd, float start, float end) {
    float depth = start;
    Surface co;

    for (int i = 0; i < MAX_MARCHING_STEPS; i++) {
        vec3 p = ro + depth * rd;
        co = sdScene(p);
        depth += co.sd;
        if (co.sd < PRECISION || depth > end)
            break;
    }

    co.sd = depth;
    return co;
}

float calcSoftshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax, in float w)
{
    float res = 1.0;
    float t = mint;
    float ph = 1e10; // big, such that y = 0 on the first iteration

    for( int i=0; i<100; i++ )
    {
        float h = sdScene( ro + rd*t ).sd;
        res = min( res, h/(w*t) );
        t += h;

        if( res<0.0001 || t>tmax )
            break;
    }
    res = clamp( res, 0.0, 1.0 );
    return res*res*(3.0-2.0*res);
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
    vec3 ro = vec3(0., 4., 1.);
    vec3 rd = normalize(vec3(uv, -1.));

    rd *= rotateX(-0.3 * pi + 0.0 * sin(2. * iTime));

    Surface co = rayMarch(ro, rd, MIN_DIST, MAX_DIST);

    if (co.sd > MAX_DIST) {
        col = backgroundColor;
    } else {
        vec3 p = ro + rd * co.sd;
        vec3 normal = calcNormal(p);
        vec3 lightPosition = vec3(5., 2., 0.5);
        vec3 lightDirection = normalize(lightPosition - p);
        // switch from point light to parallel light
        // lightDirection = normalize(vec3(-1., 1., -1.));

        // Lambertian reflection
        // why would this be "perfect diffusion"?
        float dif = dot(normal, lightDirection) * (
            1. + 0.8 * calcSoftshadow(p, lightDirection, 0.02, 2., 0.1)
        );
        dif = clamp(dif, 0., 1.);

        // wofür könnte das gut sein?
        dif = mix(dif, co.sd, 0.0);

        // scale for better visuals
        dif = pow(dif, 1.);
        dif = clamp(dif, 0., 1.);
        col = dif * co.col;
        col += 0.0 * backgroundColor; // why would we do that??

        // Diminishing according to marched distance ~ Fog
        col *= exp(-0.0005 * co.sd * co.sd);
    }

    // Output to screen
    fragColor = vec4(col, 1.0);
    /*
    vec2 uv = (-1.0 + 2.0 * gl_FragCoord.xy / iResolution.xy) * vec2(iResolution.x / iResolution.y, 1.0);
    vec3 ro = vec3(2., 1.5, -2.5);
    vec3 rd = normalize(vec3(uv, 1.));

    rd *= rotateX(0.125 * pi);

    float d;
    vec3 bgColor, cube1Color, cube2Color, cube1Normals, cube2Normals;

    vec3 lightDir = vec3(0.2, 0.5, 1.);
    background(bgColor, iTime, rd, lightDir);

    cube(d, cube1Normals, ro, rd, vec3(0., -3., 0.), 1.);
    rd = reflect(rd, cube1Normals);
    background(cube1Color, iTime, rd, lightDir);
    cube1Color *= vec3(0.9, 0.8, 0.5);

    // draw the cube where the cube is and the background where the cube is not
    fragColor = vec4(mix(bgColor, cube1Color, step(0., d)), 1.0);

    fragColor = pow(fragColor, vec4(vec3(1.5), 1.));
    */
}
