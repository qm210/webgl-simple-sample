#version 300 es
precision highp float;
precision highp sampler2D;

// Inspiration durch https://github.com/PavelDoGreat/WebGL-Fluid-Simulation,
// cf. https://github.com/PavelDoGreat/WebGL-Fluid-Simulation/blob/master/script.js

out vec4 fragColor;

// werden jetzt im Vertex Shader definiert, weil Fragment-unabhängig
in vec2 st;
in vec2 stL;
in vec2 stR;
in vec2 stU;
in vec2 stD;
in float aspRatio;

uniform vec2 iResolution;
uniform float iTime;
uniform int iFrame;
uniform int iPassIndex;
uniform sampler2D texPrevious;
uniform sampler2D texVelocity;
uniform sampler2D texCurl;
uniform sampler2D texPressure;
uniform sampler2D texDivergence;
uniform sampler2D texPostSunrays;
uniform sampler2D texPostBloom;
uniform sampler2D texPostBloomDither;

// for fluid dynamics
uniform vec2 texelSize;
uniform float deltaTime;
uniform float iColorDissipation;
uniform float iVelocityDissipation;
uniform float iMaxInitialVelocity;
uniform float iCurlStrength;
uniform float iPressure;
uniform int pressureIterations;

// for new böbbels
uniform float iSpawnSeed;
uniform float iSpawnAge;
uniform vec3 iSpawnColorHSV;
uniform float iSpawnHueGradient;
uniform float iSpawnRandomizeHue;

uniform int doDebugRender;

// for post processing
uniform float iBloomIntensity;
uniform float iBloomThreshold;
uniform float iBloomSoftKnee;
uniform vec2 iBloomDitherScale;
uniform float iSunraysWeight;
uniform float iSunraysIterations;
uniform float iSunraysDensity;
uniform float iSunraysDecay;
uniform float iSunraysExposure;
uniform float iGamma;
uniform float iVignetteInner;
uniform float iVignetteOuter;
uniform float iVignetteScale;

// for smoe other day
uniform float iNoiseFreq;
uniform float iNoiseLevel;
uniform float iNoiseOffset;
uniform int iFractionalOctaves;
uniform float iFractionalScale;
uniform float iFractionalDecay;
uniform float iCloudMorph;
uniform float iCloudVelX;
uniform float iCloudVelY;
uniform vec3 iFree0;
uniform vec3 iFree1;
uniform vec3 iFree2;

// set these in main, but make global
vec4 previous;
vec2 velocity;

const float pi = 3.1415923;
const float twoPi = 2. * pi;

const vec4 c = vec4(1., 0., -1., .5);

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
float hash(float n) {
    return fract(sin(n) * 43758.5453123);
}

vec2 hash22(vec2 p)
{
    p = p*mat2(127.1,311.7,269.5,183.3);
    p = -1.0 + 2.0 * fract(sin(p + .01 * iNoiseOffset)*43758.5453123);
    return sin(p*6.283);
}

float perlin1D(float x) {
    float i = floor(x);
    float f = fract(x);
    float g0 = hash(i) * 2.0 - 1.0;
    float g1 = hash(i + 1.0) * 2.0 - 1.0;
    float d0 = g0 * f;
    float d1 = g1 * (f - 1.0);
    float u = smoothstep(0., 1., f);
    return mix(d0, d1, u);
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

float fractionalNoiseSum(vec2 p) {
    p *= 4.;
    float a = 1., r = 0., s = 0., noise;
    for (int i=0; i < iFractionalOctaves; i++) {
        noise = perlin2D(p * iNoiseFreq);
        r += a * noise;
        s += a;
        p *= iFractionalScale;
        a *= iFractionalDecay;
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

    // raymarch scene
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
vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}
vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    // Permutations
    i = mod(i, 289.0);
    vec4 p = permute(
        permute(
            permute(i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0)
        )
        + i.x + vec4(0.0, i1.x, i2.x, 1.0)
    );

    // Gradients
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    // Normalize gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;

    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float snoise(vec2 uv, float seedShift) {
    return snoise(vec3(uv, seedShift));
}

float fbm(vec2 p, float seedShift) {
    float v = 0.;
    float a = 1.;
    float s = 0.;
    for (int i = 0; i < iFractionalOctaves; i++) {
        v += a * snoise(p, seedShift);
        s += a;
        p = p * iFractionalScale;
        a *= iFractionalDecay;
    }
    return v / s;
}

const bool TEST_FEEDBACK = false;
const bool STUPID_SMEAR = false;

void renderNoiseClouds(in vec2 uv) {
    vec2 uvTime = uv - vec2(iCloudVelX, iCloudVelY) * iTime;
    float n = fbm(uvTime, iCloudMorph * iTime + iNoiseOffset);
    n *= 4.;
    const float lowerLimit = 0.0; // 0.2
    n = smoothstep(lowerLimit, 1.0, n);
    fragColor = vec4(vec3(n), 1.);
}

void morphNoiseClouds(in vec2 uv, in vec2 st) {
    fragColor = previous;

    if (STUPID_SMEAR) { /* just as to know we are set up... |o| */
        vec3 imageClone = texture(texPrevious, st - vec2(0., 0.002)).rgb;
        fragColor.rgb = mix(fragColor.rgb, imageClone, 0.5);
        return;
    }

    fragColor = pow(fragColor, vec4(9.));
    float time = 0.5 * iTime;
    vec2 perturb = vec2(
        snoise(st + time, 0.),
        snoise(1.5 * st + time - 0.43, 0.4)
    );
    vec2 pos = st;
    vec2 scaleCenter = c.wy;
    pos = 0.99 * (pos - scaleCenter) + scaleCenter;
    // pos -= 0.016 * perturb;
    vec4 prev = texture(texPrevious, pos);
    float mixing = max(max(prev.r, prev.g), prev.b);
    // fragColor = mix(fragColor, advected, 0.5 + 0.5 * mixing);
    // fragColor.rgb += prev.rgb * prev.a;
    fragColor.rgb = mix(fragColor.rgb, prev.rgb, 0.5 + 0.5 * mixing);

    // outData += 1.e-1 * c.yz;
}

void renderScene(in vec2 uv, in vec2 st) {
    vec3 col = c.xxx;
    float d;

    d = sdCircle(uv, 0.02);
    col = mix(c.yyy, c.xxx, smoothstep(0., 0.001, d));

    // applyGrid(col, uv, 0.5);

    vec3 colX = c.xxx;
    if (TEST_FEEDBACK) {
        vec2 somePos = vec2(
            perlin2D(iNoiseLevel * uv + iTime),
            perlin2D(iNoiseLevel * uv * 7. + iTime + 0.312)
        );
        d = sdCircle(uv - somePos, 0.1);
        vec3 color = vec3(0.5 + 0.3 * sin(10. * iTime), 1., 0.8 - 0.2 * cos(4. * iTime + .2));
        colX = mix(color, colX, smoothstep(0.0, 0.02, d));
    }

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

    someRayMarching(colX, uv);
    col = max(col, colX);

    fragColor = vec4(col, 1.0);

    // vec4 clouds = texture(iPrevImage, st);
    // fragColor.r = iNoiseLevel;
}

const vec3 grayScale = vec3(0.299, 0.587, 0.114);

const bool JUST_MIX = true;

vec3 blendColors(vec3 colA, vec3 colB, float alpha, float gamma) {
    // trying less-ugly-but-still-simple ways for RGB mixing
    vec3 blend = mix(colA, colB, alpha);
    if (JUST_MIX) {
        return blend;
    }

    vec3 colAcorr = pow(colA, vec3(gamma));
    vec3 colBcorr = pow(colB, vec3(gamma));
    blend = mix(colAcorr, colBcorr, alpha);
    return pow(blend, vec3(1./gamma));
}

vec3 hsv2rgb(vec3 hsvColor) {
    hsvColor.x /= 360.;
    const vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(hsvColor.xxx + K.xyz) * 6.0 - K.www);
    return hsvColor.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), hsvColor.y);
}

const mat3 rgb2yiq = mat3(
    0.299,  0.5959,  0.2215,
    0.587, -0.2746, -0.5227,
    0.114, -0.3213,  0.3112
);
vec3 rgbToYCh(vec3 rgb) {
    vec3 yiq = rgb2yiq * rgb;
    float C = length(yiq.yz);
    float h = atan(yiq.z, yiq.y);
    return vec3(yiq.x, C, h);
}
vec3 ychToRgb(float Y, float C, float h) {
    float I = C * cos(h);
    float Q = C * sin(h);
    float R = Y + 0.9469 * I + 0.6236 * Q;
    float G = Y - 0.2748 * I - 0.6357 * Q;
    float B = Y - 1.1000 * I + 1.7000 * Q;
    return clamp(vec3(R, G, B), 0.0, 1.0);
}

void postprocess(in vec2 uv, in vec2 st) {
    fragColor = texture(texPrevious, st);

    // some ych-playing-arounds
    float val = dot(grayScale, fragColor.rgb);
    fragColor.rgb = ychToRgb(0.5 + 0.05 * iFree0.x, 0.5 + 0.05 * iFree0.y, 0.2 * iFree1.z + (0.5 + 0.1 * iFree0.z) * pi * val);

    // some gamma
    fragColor.rgb = pow(fragColor.rgb, vec3(1./2.2 + iFree1.x));

    vec4 tex, tex1, texS = c.yyyy;
    vec3 col0 = fragColor.rgb;
    vec3 col = col0;
}

void spawnFunnyShapes(in vec2 uv) {
    const float lifetime = 5.;
    for (float dt = 0.; dt > -lifetime; dt -= 1.) {
        float t = iTime;
        float spawnT = floor(iTime) + dt;
        if (spawnT < 0.) {
            break;
        }
        vec2 spawn = hash22(vec2(0.22, 2.15) * spawnT);
        t -= spawnT;
        vec2 pos = uv - spawn;
        float phi = atan(pos.y, pos.x);
        float rad = 0.5 * t;
        pos *= (1. + 0.1 * rad * rad * cos(10. * phi + 4. * t));
        float d = sdCircle(pos, rad);
        d = abs(d - 0.1);
        float amp = 1.;
        amp = clamp(0., 1., 1. - 0.15 * t);
        amp *= amp;
        fragColor = mix(fragColor, c.xxxx, smoothstep(0.02, 0., d) * amp);
    }
    fragColor = clamp(fragColor, 0., 1.);
}

float max3(vec3 vec) {
    return max(vec.x, max(vec.y, vec.z));
}

float val4(vec4 vec) {
    return vec.a * max3(vec.rgb);
}

vec2 calcGradient(sampler2D tex) {
    vec4 left = texture(tex, stL);
    vec4 right = texture(tex, stR);
    vec4 up = texture(tex, stU);
    vec4 down = texture(tex, stD);
    float valL = val4(left);
    float valR = val4(right);
    float valU = val4(up);
    float valD = val4(down);
    float dx = (valR - valL) * 0.5;
    float dy = (valU - valD) * 0.5;
    return normalize(vec2(dx, dy));
}

void morphDynamics(vec2 uv) {
    vec2 grad = calcGradient(texPrevious);
    if (length(grad) == 0.) {
        return;
    }
    vec4 gradU = texture(texPrevious, st + grad * texelSize);
    vec4 gradD = texture(texPrevious, st - grad * texelSize);
    vec2 ortho = vec2(-grad.y, grad.x);
    vec4 orthoL = texture(texPrevious, st + ortho * texelSize);
    vec4 orthoR = texture(texPrevious, st - ortho * texelSize);
    vec4 diffused = (gradU + gradD + orthoL + orthoR) * 0.25;
    float rate = 0.5 + 0.7 * perlin2D(uv + 0.3 * iTime);
    fragColor = clamp(mix(fragColor, diffused, rate), 0., 1.);
}

vec3 makeSurplusWhite(vec3 color) {
    vec3 surplus = max(c.yyy, color - 1.);
    color = min(color, 1.);
    color.r += surplus.g + surplus.b;
    color.g += surplus.r + surplus.b;
    color.b += surplus.r + surplus.g;
    return clamp(color, 0., 1.);
}

vec4 simulateAdvection(sampler2D fieldTexture, float dissipationFactor) {
    vec2 hasMovedTo = st - deltaTime * velocity * texelSize;
    vec4 advectedValue = texture(fieldTexture, hasMovedTo);
    float decay = 1.0 + dissipationFactor * deltaTime;
    return advectedValue / decay;
}

float calcSunrays() {
    vec2 stCursor = st;
    vec2 cursorDir = st - 0.5;
    cursorDir *= 1. / iSunraysIterations * iSunraysDensity;
    float illumination = 1.;
    // now this is a "red only" texture, i.e. let's call it "value" instead of "color":
    float value = previous.a;
    for (float i=0.; i < iSunraysIterations; i+=1.) {
        stCursor -= cursorDir;
        float cursorVal = texture(texPrevious, stCursor).a;
        value += cursorVal * illumination * iSunraysWeight;
        illumination *= iSunraysDecay;
    }
    value *= iSunraysExposure;
    return value;
}

vec4 blur() {
    vec4 sum = previous * 0.29411764;
    sum += texture(texPrevious, st - 1.333 * texelSize) * 0.35294117;
    sum += texture(texPrevious, st + 1.333 * texelSize) * 0.35294117;
    return sum;
}

vec3 cmap_dream210(float t) {
    return vec3(0.19, 0.24, 0.40)
    +t*(vec3(3.42, -1.41, 4.13)
    +t*(vec3(-21.95, 22.09, -7.62)
    +t*(vec3(66.28, -51.41, -6.87)
    +t*(vec3(-80.01, 41.55, 23.40)
    +t*(vec3(33.21, -11.33, -11.18)
    +t*(vec3(-0.94, 0.52, -1.86)
    ))))));
}

// This is where I got creative with the name..!
void postprocessing(inout vec3 col, in vec2 uv) {
    col = cmap_dream210(clamp(max3(col), 0., 1.));
    col = pow(col, vec3(1./iGamma));

    float vignetteShade = dot(st - 0.5, st - 0.5) * iVignetteScale;
    col *= smoothstep(iVignetteInner, iVignetteOuter, vignetteShade);
}

vec4 linearValue(sampler2D tex, float scaling) {
    float red = texture(tex, st).r * scaling;
    return vec4(
        max(0., red),
        -min(0., red),
        abs(red) > 1.,
        1.
    );
}

#define INIT_VELOCITY_PASS 0
#define INIT_IMAGE_PASS 1
#define INIT_PRESSURE_PASS 2
#define INIT_CURL_FROM_VELOCITY 3
#define PROCESS_VELOCITY_VORTICITY 12
#define PROCESS_DIVERGENCE_FROM_VELOCITY 13
#define PROCESS_PRESSURE 14
#define PROCESS_GRADIENT_SUBTRACTION 15
#define PROCESS_ADVECTION 16
#define PROCESS_FLUID_COLOR_PASS 50
#define POST_PASS_BLOOM_PREFILTER 70
#define POST_PASS_BLOOM_BLUR 71
#define POST_PASS_SUNRAYS_MASK 80
#define POST_PASS_SUNRAYS_ACTUAL 81
#define POST_PASS_SUNRAYS_BLUR 82
#define RENDER_TO_SCREEN_PASS 99

void main() {
    // vec2 uv = (2. * gl_FragCoord.xy) / iResolution.y - vec2(aspRatio, 1.);
    vec2 uv = (2. * gl_FragCoord.xy) * texelSize.y - vec2(aspRatio, 1.);
    // -> uv nützlich, um neu zu zeichnen (Mitte zentriert)
    // -> st nützlich, um Texturen zu verarbeiten
    // -> wenn Textur auf Screen soll, y-Vorzeichen und Aspect Ratio bedenken!

    // brauchen wir nicht für jeden Pass, aber erlauben wir uns für lesbareren Zugriff...
    previous = texture(texPrevious, st);
    velocity = texture(texVelocity, st).xy;

    vec2 spawnRandom = hash22(vec2(1.2, 1.1) * iSpawnSeed);
    vec2 spawnCenter = vec2(spawnRandom.x, spawnRandom.y);
    float spawnSize = clamp(iSpawnAge, 0.18, 1.); // <-- put iSpawnAge in there
    float d, velL, velR, velU, velD, pL, pR, pU, pD, div;

    // this switch has a principle:
    // return; to declare the current rendering done.
    // break; to pass the previous color just through (see below)
    // ...if you modify stuff and then break; you will likely gain nothing :|
    switch (iPassIndex) {
        case INIT_VELOCITY_PASS:
            if (iSpawnSeed < 0.) {
                break;
            }
            vec2 randomVelocity = hash22(vec2(iSpawnSeed, iSpawnSeed + 0.1))
                * iMaxInitialVelocity * vec2(aspRatio, 1.);
            // <-- hash22(x) is _pseudo_random_, i.e. same x results in same "random" value
            // we want randomVelocity.x != randomVelocity.y, thus the 0.1 offset
            // but the overall randomVelocity will only differ when sampleSeed differs.
            //vec2 initialVelocity = randomVelocity;
            // <-- would be random, but can also direct towards / away from center
            // vec2 initialVelocity = uv * iMaxInitialVelocity;
            vec2 initialVelocity = randomVelocity + uv * iMaxInitialVelocity;
            uv = uv - spawnCenter;
            d = sdCircle(uv, spawnSize);
            d = smoothstep(0.02, 0., d);
            d   = exp(-dot(uv, uv) / spawnSize);
            vec2 newValue = d * initialVelocity;
            fragColor.xy = previous.xy + newValue;
            // can ignore fragColor.zw because these will never be read
            return;
        case INIT_IMAGE_PASS:
            if (iSpawnSeed < 0.) {
                break;
            }
            uv = uv - spawnCenter;
            d = sdCircle(uv, spawnSize);
            float a = smoothstep(0.02, 0., d) * exp(-dot(uv, uv) / spawnSize);
            vec3 spawnColor = iSpawnColorHSV;
            spawnColor.x += (360. * hash(iSpawnSeed + 0.12) - 180.) * iSpawnRandomizeHue;
            spawnColor.x += pow(-min(0., d), 0.5) * iSpawnHueGradient;
            vec3 spawn = a * hsv2rgb(spawnColor);
            // spawn.r += pow(-min(0., d), 0.5) * 1.6;
            // mix old stuff in:
            fragColor = vec4(previous.rgb + spawn, 1.);
            // just new stuff:
            // fragColor = vec4(spawn.rgb, 1.);
            return;

        case INIT_CURL_FROM_VELOCITY:
            // this just calculates the "curl" (scalar => only red) for the next pass
            // understand the curl as kind of "orthogonal to the gradient": (x, y) -> (-y, x)
            velL = +texture(texVelocity, stL).y;
            velR = +texture(texVelocity, stR).y;
            velU = -texture(texVelocity, stU).x;
            velD = -texture(texVelocity, stD).x;
            float vorticity = (velR - velL) + (velU - velD);
            fragColor.r = vorticity;
            return;
        case PROCESS_VELOCITY_VORTICITY:
            // the curl from the previous pass is here the "previous.r"
            float curlHere = texture(texCurl, st).x;
            float curlL = texture(texCurl, stL).x;
            float curlR = texture(texCurl, stR).x;
            float curlU = texture(texCurl, stU).x;
            float curlD = texture(texCurl, stD).x;
            vec2 force = vec2(abs(curlU) - abs(curlD), abs(curlR) - abs(curlL));
            force /= length(force) + 0.0001;
            force *= iCurlStrength * curlHere * c.yz;
            velocity += force * deltaTime;
            // velocity = clamp(velocity, -1000., 1000.);
            fragColor.xy = velocity;
            return;
        case PROCESS_DIVERGENCE_FROM_VELOCITY:
            // this handles divergence at the borders
            velL = texture(texVelocity, stL).x;
            velR = texture(texVelocity, stR).x;
            velU = texture(texVelocity, stU).y;
            velD = texture(texVelocity, stD).y;
            // these are equivalent mathematically:
            // if (a < b) { velL = c; }
            // velL = a < b ? c : L;
            // velL = mix(velL, c, float(a < b));
            // velL = mix(velL, c, step(a, b));
            // and compiler might recognize them as equal; but the last one is the most idiomatic GLSL
//            velL = mix(velL, -velocity.x, step(stL.x, 0.0));
//            velR = mix(velR, -velocity.x, step(1.0, stR.x));
//            velU = mix(velU, -velocity.y, step(1.0, stU.y));
//            velD = mix(velD, -velocity.y, step(stD.y, 0.0));
            if (stL.x < 0.0) { velL = -velocity.x; }
            if (stR.x > 1.0) { velR = -velocity.x; }
            if (stU.y > 1.0) { velU = -velocity.y; }
            if (stD.y < 0.0) { velD = -velocity.y; }
            // the divergence texture is scalar / one-dimensional / a single "red" value,
            div = 0.5 * (velR - velL + velU - velD);
            fragColor.r = div;
            return;
        case INIT_PRESSURE_PASS:
            fragColor = iPressure * texture(texPressure, st);
            return;
        case PROCESS_PRESSURE:
            pL = texture(texPressure, stL).x;
            pR = texture(texPressure, stR).x;
            pU = texture(texPressure, stU).x;
            pD = texture(texPressure, stD).x;
            div = texture(texDivergence, st).x;
            float pressure = 0.25 * (pL + pR + pU + pD - div);
            fragColor.r = pressure;
            return;

        case PROCESS_GRADIENT_SUBTRACTION:
            pL = texture(texPressure, stL).x;
            pR = texture(texPressure, stR).x;
            pU = texture(texPressure, stU).x;
            pD = texture(texPressure, stD).x;
            velocity.xy -= vec2(pR - pL, pU - pD);
            fragColor.rg = velocity;
            return;
        case PROCESS_ADVECTION:
            fragColor = simulateAdvection(texVelocity, iVelocityDissipation);
            return;

        case PROCESS_FLUID_COLOR_PASS:
            fragColor = previous;
            // this does not go through right now
            fragColor = simulateAdvection(texPrevious, iColorDissipation);
            return;

        case POST_PASS_BLOOM_PREFILTER: {
            float knee = iBloomThreshold * iBloomSoftKnee + 1.e-4;
            vec3 curve = vec3(iBloomThreshold - knee, knee * 2., 0.25 / knee);
            vec3 col = texture(texPrevious, st).rgb;
            float br = max3(col);
            float rq = clamp(br - curve.x, 0., curve.y);
            rq = curve.z * rq * rq;
            col *= max(rq, br - iBloomThreshold) / max(br, 1.e-4);
            fragColor = vec4(col, 1.);
            return;
        }
        case POST_PASS_BLOOM_BLUR: {
            fragColor = 0.25 * (
                texture(texPrevious, stL) +
                texture(texPrevious, stR) +
                texture(texPrevious, stU) +
                texture(texPrevious, stD)
            );
            return;
        }

        case POST_PASS_SUNRAYS_MASK:
            float br = max3(previous.rgb);
            fragColor.a = 1.0 - clamp(br * 20., 0., 0.8);
            fragColor.rgb = previous.rgb;
            return;
        case POST_PASS_SUNRAYS_ACTUAL:
            fragColor = vec4(calcSunrays(), 0., 0., 1.);
            return;
        case POST_PASS_SUNRAYS_BLUR:
            fragColor = blur();
            return;

        case RENDER_TO_SCREEN_PASS:
            if (doDebugRender > 0) {
                if (doDebugRender == 1) {
                    fragColor = 0.5 * texture(texVelocity, st) + 0.5;
                }
                else if (doDebugRender == 2) {
                    fragColor = linearValue(texCurl, 0.2);
                }
                else if (doDebugRender == 3) {
                    fragColor = linearValue(texPressure, 0.01);
                }
                else if (doDebugRender == 4) {
                    fragColor = linearValue(texDivergence, 1.);
                }
                fragColor.a = 1.;
                return;
            }
            // <-- meant for debugging
            // --> actual rendering / composition of textures

            // 1. first, mimic the gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
            const vec3 bg = c.yyy;
            fragColor.rgb = makeSurplusWhite(previous.rgb);
            fragColor.rgb = previous.rgb + (1. - previous.a) * bg;
            // 2. mix post-processing (bloom & sunrays) in
            float sunrays = texture(texPostSunrays, st).r;
            fragColor.rgb *= sunrays;
            vec3 bloom = texture(texPostBloom, st).rgb;
            bloom *= iBloomIntensity;
            bloom *= sunrays;
            float dither = texture(texPostBloomDither, st * iBloomDitherScale).r;
            dither = dither * 2. - 1.;
            bloom += dither / 255.;
            bloom = max(
                1.055 * pow(max(bloom, c.yyy), vec3(0.4167)) - 0.055,
                c.yyy
            );
            fragColor.rgb += bloom;
            // fragColor.a = max3(fragColor.rgb);
            postprocessing(fragColor.rgb, uv);
            fragColor.a = 1.;
            return;
        default:
            break;
    }
    fragColor = previous;
}
