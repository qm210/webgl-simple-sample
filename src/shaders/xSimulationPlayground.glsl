#version 300 es
precision highp float;

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;
uniform int iPassIndex;
uniform sampler2D iPrevImage;
uniform sampler2D iDream210;

uniform float iNoiseFreq;
uniform float iNoiseLevel;
uniform float iNoiseOffset;
uniform int iFractionSteps;
uniform float iFractionScale;
uniform float iFractionAmplitude;
uniform vec3 iFree0;
uniform vec3 iFree1;
uniform vec3 iFree2;

vec4 c = vec4(1., 0., -1., .5);

const float twoPi = 6.28319;

mat2 rot2D(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(
        c, -s,
        s,  c
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

float sdCircle( in vec2 p, in float r )
{
    return length(p)-r;
}

float sdBox( vec3 p, vec3 b )
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

vec3 mightBeCloudNoise(vec3 ray, float t) {
    return c.yyy; // just some white, gotta start somewhere :D
}


void applyGrid(inout vec3 col, in vec2 uv, float gridStep) {
    uv = mod(uv, gridStep);
    // <-- verallgemeinert fract(x) == mod(x, 1.)
    float dMin = min(uv.x, uv.y);
    // >> step(edge, x) = "0 if x <= edge else 1"
    // >> step(x, a) = 1. - step(a, x)
    // col *= 1. - 0.1 * (step(dMin, 0.002));
    col *= 1. - 0.05 * (1. - smoothstep(0., 0.01, dMin));
    // >> step(edge, x) vs. smootshstep(0.0025, 0.0015, dMin);
    // col *= 1. - 0.1 * (smoothstep(dMin, 0.002));
}

vec2 hash22(vec2 p)
{
    p = p*mat2(127.1,311.7,269.5,183.3);
    p = -1.0 + 2.0 * fract(sin(p + .01 * iNoiseOffset)*43758.5453123);
    return sin(p*6.283);
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

float fractionalNoiseSum(vec2 p){
    p *= 4.;
    float a = 1., r = 0., s = 0., noise;
    for (int i=0; i < iFractionSteps; i++) {
        noise = perlin2D(p * iNoiseFreq);
        r += a * noise;
        s += a;
        p *= iFractionScale;
        a *= iFractionAmplitude;
    }
    return r/s;
}
// interesting modifications possible,
// e.g. see "marble", ... at https://www.shadertoy.com/view/Md3SzB

vec3 gradientNoise(vec2 p) {
    p *= 2.;
    vec3 col = vec3(fractionalNoiseSum(p));
    // brighten up
    return 0.5 + 0.5 * col;
}

void fakeFluidDynamics(out vec3 col, in vec2 uv) {
    float time = iTime;
    float shearPos = 0.25;
    float velLeft = 0.3;
    float velRight = -0.3;

    float baseVel = uv.y < shearPos ? velLeft : velRight;
    float perturbAmplitude = 0.3;
    float shearDist = abs(uv.y - shearPos);
    float wave = sin(20.0 * uv.x + time * 4.0);
    float noiseVal = perlin2D(uv * 30.0 + vec2(time * 5.0, 0.0));

    float perturb = perturbAmplitude * wave * noiseVal * exp(-50.0 * shearDist * shearDist);

    float velocity = baseVel + perturb;

    col = vec3(0.5) + vec3(velocity, 0.0, -velocity);
}

struct Marched {
    float t;
    float material;
};

Marched opUnion( Marched d1, Marched d2 )
{
    if (d1.t < d2.t) {
        return d1;
    }
    return d2;
}

void add(inout Marched scene, float sd, float mat) {
    if (sd < scene.t) {
        scene.t = sd;
        scene.material = mat;
    }
}

const float CLOUD_MATERIAL = -0.666;
Marched map( in vec3 pos )
{
    Marched res = Marched(pos.y, 0.0); // tis wud be se floooooralooor
    res = Marched(50., CLOUD_MATERIAL); // but lets hardcode it to the clouds that don't exist yet :D
    res = opUnion( res, Marched( sdBox(rotY(0.7)*(pos-vec3( +1.0, 0.25, 0.5)), vec3(0.5) ), 3.0 ) );
    return res;
}

vec2 iBox( in vec3 ro, in vec3 rd, in vec3 rad )
{
    // QM asks: NEED WE?
    vec3 m = 1.0/rd;
    vec3 n = m*ro;
    vec3 k = abs(m)*rad;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;
    return vec2( max( max( t1.x, t1.y ), t1.z ),
    min( min( t2.x, t2.y ), t2.z ) );
}

Marched raycast( in vec3 ro, in vec3 rd )
{
    Marched res = Marched(-1.0,-1.0);

    float tmin = 1.0;
    float tmax = 20.0;

    // raytrace floor plane
    float tp1 = (0.0-ro.y)/rd.y;
    if( tp1>0.0 )
    {
        tmax = min( tmax, tp1 );
        res = Marched( tp1, 1.0 );
    }

    // raymarch primitives
    vec2 tb = iBox( ro-vec3(0.0,0.4,-0.5), rd, vec3(2.5,0.41,3.0) );
    if( tb.x<tb.y && tb.y>0.0 && tb.x<tmax)
    {
        //return vec2(tb.x,2.0);
        tmin = max(tb.x,tmin);
        tmax = min(tb.y,tmax);

        float t = tmin;
        for( int i=0; i<70 && t<tmax; i++ )
        {
            Marched hit = map( ro+rd*t );
            if( abs(hit.t)<(0.0001*t) )
            {
                res = Marched(t, hit.material);
                break;
            }
            t += hit.t;
        }
    }
    return res;
}

vec3 calcNormal( in vec3 pos )
{
    vec2 e = vec2(1.0,-1.0)*0.5773*0.0005;
    return normalize( e.xyy*map( pos + e.xyy ).t +
    e.yyx*map( pos + e.yyx ).t +
    e.yxy*map( pos + e.yxy ).t +
    e.xxx*map( pos + e.xxx ).t );
}

vec3 render(in vec3 rayOrigin, in vec3 rayDir)
{
    // background
    vec3 bgCol = vec3(1.0, 0.808, 0.945) - max(rayDir.y,0.0)*0.3;
    vec3 col = bgCol;

    // raycast scene
    Marched res = raycast(rayOrigin,rayDir);
    vec3 rayPos = rayOrigin + res.t * rayDir;

    if( res.material > -0.5 )
    {
        // material
        col = 0.2 + 0.2*sin( res.material*2.0 + vec3(0.0,1.0,2.0) );
        float specularCoeff = 1.0;
        bool isFloor = res.material < 1.5 && abs(res.material - CLOUD_MATERIAL) > 0.01;

        // ray evaluation
        vec3 normal = isFloor ? vec3(0.0,1.0,0.0) : calcNormal(rayPos);

        if (isFloor)
        {
            float f = 1. - abs(step(0.5, fract(1.5*rayPos.x)) - step(0.5, fract(1.5*rayPos.z)));
            col = 0.15 + f*vec3(0.05);
            specularCoeff = 0.4;
        } else {
            const vec3 cubeColor = vec3(0.1, 0.06, 0.3);
            col = cubeColor;
        }

        vec3 shade = vec3(0.0);

        // Licht: reines Richtungslicht (passt zu einer Sonne, die weit weg ist, im Gegensatz zu Punktlicht)
        {
            vec3  lightDir = normalize( vec3(2.17, 3.82, -10.62) + iFree0); // Vorsicht, Vorzeichenkonvention
            vec3  halfway = normalize(lightDir - rayDir); // was ist das, geometrisch?
            /*
            float diffuse = clamp( dot(normal, lightDirection), 0.0, 1.0); // dot(normal, lightSource) <-- diffus (warum?)
            // diffuse *= calcSoftshadow(rayPos, lightDirection, 0.02, 2.5); // warum hier *= ...?
            float specular = pow( clamp( dot( normal, halfway ), 0.0, 1.0), 20.0); // <-- glänzend (warum?)
            // float fresnelAttenuation = 0.04 + 0.36*pow(clamp(1.0-dot(halfway,lightDirection), 0.0, 1.0), 5.0);
            // specular *= fresnelAttenuation;
            const vec3 sourceCol = vec3(1.30,1.00,0.70);
            shade += col * 2.20 * sourceCol * diffuse;
            shade +=       3.00 * sourceCol * specular * specularCoeff;
            */
            vec3 ambient = 0.05 * col;
            float diff = max(dot(normal, lightDir), 0.);
            vec3 diffuse = diff * 0.15 * col;
            vec3 reflectDir = reflect(-lightDir, normal);
            float spec = pow(max(dot(rayDir, reflectDir), 0.), 128.0);
            // <--- should be QUITE SHINÄYÄYÄYÄY, specktackulärlick
            shade += ambient + diffuse + spec * vec3(0.9, 0.91, 1.);
        }

        col = shade;

        // "Distanznebel", inwiefern macht dieser Begriff Sinn?
        float fogOpacity = 1.0 - exp( -0.0003 * pow(res.t, 3.0));
        col = mix(col, bgCol, fogOpacity);
    }
    else if (res.material > CLOUD_MATERIAL - 0.01) {
        vec3 cloud = mightBeCloudNoise(rayPos, res.t);
        col = mix(col, cloud, 0.8);
    }

    return clamp(col, 0.0, 1.0);
}

mat3 setCamera( in vec3 origin, in vec3 target, float rollAngle )
{
    vec3 cameraForward = normalize(target - origin);
    vec3 cp = vec3(sin(rollAngle), cos(rollAngle), 0.0);
    vec3 cameraRight = normalize( cross(cameraForward, cp) );
    vec3 cameraUp = cross(cameraRight, cameraForward); // already normalized
    return mat3(cameraRight, cameraUp, cameraForward);
}

void someRayMarching(out vec3 col, in vec2 uv) {
    vec3 cameraTarget = vec3( 0.25, -0.375, -0.75);
    vec3 rayOrigin = cameraTarget + vec3( 4.5 + 0.85, 2.7, 0.0);
    mat3 ca = setCamera( rayOrigin, cameraTarget, 0.0 );
    vec3 rayDirection = ca * normalize( vec3(uv, 2.5) );
    col = render( rayOrigin, rayDirection);

//
//    // Normalize vectors
//    vec3 norm = normalize(Normal);
//    vec3 lightDir = normalize(lightPos - FragPos);
//    vec3 viewDir = normalize(viewPos - FragPos);
//
//    // Ambient component - minimal to keep black
//    vec3 ambient = 0.05 * baseColor;
//
//    // Diffuse reflection - very low to simulate latex
//    float diff = max(dot(norm, lightDir), 0.0);
//    vec3 diffuse = diff * 0.1 * baseColor;
//
//    // Specular reflection - strong, sharp highlight
//    vec3 reflectDir = reflect(-lightDir, norm);
//    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 128.0); // high shininess
//    vec3 specular = spec * vec3(0.9); // bright white highlight
//
//    col = ambient + diffuse + specular;
}

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec2 mod289(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 permute(vec3 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,  // (3.0 - sqrt(3.0)) / 6.0
    0.366025403784439,  // 0.5 * (sqrt(3.0) - 1.0)
    -0.577350269189626, // -1.0 + 2.0 * C.x
    0.024390243902439); // 1.0 / 41.0

    // Skew the input space to determine which simplex cell we're in
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    // For the 2D case, the simplex shape is an equilateral triangle.
    vec2 i1;
    if(x0.x > x0.y) {
        i1 = vec2(1.0, 0.0);
    } else {
        i1 = vec2(0.0, 1.0);
    }

    // Offsets for the other corners
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    // Permutations
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    // Gradients: 41 points uniformly over a line mapped onto a diamond
    vec3 x_ = fract(p * C.w) * 2.0 - 1.0;
    vec3 h = abs(x_) - 0.5;
    vec3 ox = floor(x_ + 0.5);
    vec3 a0 = x_ - ox;

    // Normalise gradients
    vec3 g0 = vec3(a0.x, h.x, 0.0);
    vec3 g1 = vec3(a0.y, h.y, 0.0);
    vec3 g2 = vec3(a0.z, h.z, 0.0);

    // Compute noise contributions from each corner
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m * m;
    m = m * m;

    // Dot product of gradients and offsets
    float n0 = m.x * dot(g0, vec3(x0, 0.0));
    float n1 = m.y * dot(g1, vec3(x12.xy, 0.0));
    float n2 = m.z * dot(g2, vec3(x12.zw, 0.0));

    // Sum and scale the result
    return 70.0 * (n0 + n1 + n2);
}

float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100);
    for (int i = 0; i < 5; i++) {
        v += a * snoise(x);
        x = x * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

float aspRatio;
void drawLogoParts(inout vec3 col, in vec2 st) {
    st.t = 1. - st.t;
    st.s /= aspRatio;
    st = vec2(clamp(0., 0.333, st.s), st.t);
    vec4 tex2 = texture(iDream210, st);
    vec4 tex1 = texture(iDream210, st + vec2(0.333, 0.));
    vec4 tex0 = texture(iDream210, st + vec2(0.667, 0.));
    float rotation = mod(iTime, 3.);
    vec4 tex = rotation < 1.0 ? tex2 : rotation < 2.0 ? tex1 : tex0;
    col = mix(col, vec3(1., 0., 0.), step(0.5, tex.a));
}

#define DO_RAYMARCHING 0
#define DRAW_LOGO 0
#define TEST_FEEDBACK 0
#define CLOUD_ATTEMPT 1
#define STUPID_SMEAR 0

void main() {
    aspRatio = iResolution.x / iResolution.y;
    vec2 uv = (2. * gl_FragCoord.xy) / iResolution.y - vec2(aspRatio, 1.);
    vec3 col = c.xxx;

    float d = sdCircle(uv, 0.02);
    col = mix(c.yyy, c.xxx, smoothstep(0., 0.001, d));

    vec2 st = gl_FragCoord.xy / iResolution.xy;
    vec4 image = texture(iPrevImage, st);
    if (iPassIndex == 1) {
        fragColor = image;
        if (iFrame == 0) {
            return;
        }
        #if STUPID_SMEAR
            // some smear to know we are set up... |o|
            vec3 imageClone = texture(iPrevImage, st - vec2(0., 0.002)).rgb;
            fragColor.rgb = mix(fragColor.rgb, imageClone, 0.5);
            return;
        #endif

        float dt = 0.016;
        float perturb = snoise(st + iTime);
        vec2 pos = st - dt * image.xy;
        vec4 advected = texture(iPrevImage, pos);
        vec2 newVel = advected.xy + vec2(perturb, 0.0);
        fragColor.rgb = vec3(newVel, 0.);
        return;
    }

    // applyGrid(col, uv, 0.5);

    vec3 colX = c.xxx;
    #if TEST_FEEDBACK
    {
        vec2 somePos = vec2(
            perlin2D(iNoiseLevel * uv + iTime),
            perlin2D(iNoiseLevel * uv * 7. + iTime + 0.312)
        );
        d = sdCircle(uv - somePos, 0.1);
        vec3 color = vec3(0.5 + 0.3 * sin(10. * iTime), 1., 0.8 - 0.2 * cos(4. * iTime + .2));
        colX = mix(color, colX, smoothstep(0.0, 0.02, d));
    }
    #endif

    #if CLOUD_ATTEMPT
    {
        vec2 uvTime = uv + vec2(iTime * 0.05, iTime * 0.02);
        float n = fbm(uvTime);
        n *= 4.;
        float alpha = smoothstep(0.3, 0.6, n);
        col = vec3(alpha);
    }
    #endif

    /*
    colX = gradientNoise(uv);
    float gamma = 1. + iFree.x - iFree.y;
    colX = pow(colX, vec3(gamma));
    colX = (colX - 0.5) * (1. + 2. * iFree.z) + 0.5;
    */

    /*
    colX = c.xxx - clamp(colX, 0., 1.);
    col = mix(col, colX, iNoiseLevel);
    */

    #if DO_RAYMARCHING
        someRayMarching(colX, uv);
        col = max(col, colX);
    #endif

    #if DRAW_LOGO
        drawLogoParts(col, st);
    #endif

    fragColor = vec4(col, 1.0);
}
