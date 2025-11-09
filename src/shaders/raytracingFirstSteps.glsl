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
// uniform float iFocalLength;
// for you to play around with, put 'em wherever you want:
uniform float iFree0;
uniform float iFree1;
uniform float iFree2;
uniform float iFree3;
uniform float iFree4;
uniform vec3 vecDirectionalLight;
uniform float iDiffuseAmount;
uniform float iSpecularAmount;
uniform float iSpecularExponent;
uniform float iBacklightAmount;
uniform float iSubsurfaceAmount;
uniform float iAmbientOcclusionScale;
uniform float iAmbientOcclusionStep;
uniform float iAmbientOcclusionSamples;

const float pi = 3.141593;
const float twoPi = 2. * pi;
const vec4 c = vec4(1., 0. , -1., .5);

const float GLASS_MATERIAL = 100.;
const float FLOOR_MATERIAL = 1.0;
const float UNKNOWN_MATERIAL = 0.;
const float NOTHING_HIT = -1.;
// weil das material als float ja auch in die Palette eingeht,
// definieren wir hier nur die speziellen Materialien. Darf sich halt nicht überschneiden.

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

float sdBoxFrame( vec3 p, vec3 b, float e )
{
    p = abs(p  )-b;
    vec3 q = abs(p+e)-e;

    return min(min(
    length(max(vec3(p.x,q.y,q.z),0.0))+min(max(p.x,max(q.y,q.z)),0.0),
    length(max(vec3(q.x,p.y,q.z),0.0))+min(max(q.x,max(p.y,q.z)),0.0)),
    length(max(vec3(q.x,q.y,p.z),0.0))+min(max(q.x,max(q.y,p.z)),0.0));
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

float sdCappedTorus(in vec3 p, in vec2 sc, in float ra, in float rb)
{
    p.x = abs(p.x);
    float k = (sc.y*p.x>sc.x*p.y) ? dot(p.xy,sc) : length(p.xy);
    return sqrt( dot(p,p) + ra*ra - 2.0*ra*k ) - rb;
}

float sdHexPrism( vec3 p, vec2 h )
{
    vec3 q = abs(p);

    const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
    p = abs(p);
    p.xy -= 2.0*min(dot(k.xy, p.xy), 0.0)*k.xy;
    vec2 d = vec2(
    length(p.xy - vec2(clamp(p.x, -k.z*h.x, k.z*h.x), h.x))*sign(p.y - h.x),
    p.z-h.y );
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdOctogonPrism( in vec3 p, in float r, float h )
{
    const vec3 k = vec3(-0.9238795325,   // sqrt(2+sqrt(2))/2
    0.3826834323,   // sqrt(2-sqrt(2))/2
    0.4142135623 ); // sqrt(2)-1
    // reflections
    p = abs(p);
    p.xy -= 2.0*min(dot(vec2( k.x,k.y),p.xy),0.0)*vec2( k.x,k.y);
    p.xy -= 2.0*min(dot(vec2(-k.x,k.y),p.xy),0.0)*vec2(-k.x,k.y);
    // polygon side
    p.xy -= vec2(clamp(p.x, -k.z*r, k.z*r), r);
    vec2 d = vec2( length(p.xy)*sign(p.y), p.z-h );
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdCapsule( vec3 p, vec3 a, vec3 b, float r )
{
    vec3 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h ) - r;
}

float sdRoundCone( in vec3 p, in float r1, float r2, float h )
{
    vec2 q = vec2( length(p.xz), p.y );

    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(q,vec2(-b,a));

    if( k < 0.0 ) return length(q) - r1;
    if( k > a*h ) return length(q-vec2(0.0,h)) - r2;

    return dot(q, vec2(a,b) ) - r1;
}

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2)
{
    // sampling independent computations (only depend on shape)
    vec3  ba = b - a;
    float l2 = dot(ba,ba);
    float rr = r1 - r2;
    float a2 = l2 - rr*rr;
    float il2 = 1.0/l2;

    // sampling dependant computations
    vec3 pa = p - a;
    float y = dot(pa,ba);
    float z = y - l2;
    float x2 = dot2( pa*l2 - ba*y );
    float y2 = y*y*l2;
    float z2 = z*z*l2;

    // single square root!
    float k = sign(rr)*rr*rr*x2;
    if( sign(z)*a2*z2 > k ) return  sqrt(x2 + z2)        *il2 - r2;
    if( sign(y)*a2*y2 < k ) return  sqrt(x2 + y2)        *il2 - r1;
    return (sqrt(x2*a2*il2)+y*rr)*il2 - r1;
}

float sdTriPrism( vec3 p, vec2 h )
{
    const float k = sqrt(3.0);
    h.x *= 0.5*k;
    p.xy /= h.x;
    p.x = abs(p.x) - 1.0;
    p.y = p.y + 1.0/k;
    if( p.x+k*p.y>0.0 ) p.xy=vec2(p.x-k*p.y,-k*p.x-p.y)/2.0;
    p.x -= clamp( p.x, -2.0, 0.0 );
    float d1 = length(p.xy)*sign(-p.y)*h.x;
    float d2 = abs(p.z)-h.y;
    return length(max(vec2(d1,d2),0.0)) + min(max(d1,d2), 0.);
}

// vertical
float sdCylinder( vec3 p, vec2 h )
{
    vec2 d = abs(vec2(length(p.xz),p.y)) - h;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

// arbitrary orientation
float sdCylinder(vec3 p, vec3 a, vec3 b, float r)
{
    vec3 pa = p - a;
    vec3 ba = b - a;
    float baba = dot(ba,ba);
    float paba = dot(pa,ba);

    float x = length(pa*baba-ba*paba) - r*baba;
    float y = abs(paba-baba*0.5)-baba*0.5;
    float x2 = x*x;
    float y2 = y*y*baba;
    float d = (max(x,y)<0.0)?-min(x2,y2):(((x>0.0)?x2:0.0)+((y>0.0)?y2:0.0));
    return sign(d)*sqrt(abs(d))/baba;
}

// vertical
float sdCone( in vec3 p, in vec2 c, float h )
{
    vec2 q = h*vec2(c.x,-c.y)/c.y;
    vec2 w = vec2( length(p.xz), p.y );

    vec2 a = w - q*clamp( dot(w,q)/dot(q,q), 0.0, 1.0 );
    vec2 b = w - q*vec2( clamp( w.x/q.x, 0.0, 1.0 ), 1.0 );
    float k = sign( q.y );
    float d = min(dot( a, a ),dot(b, b));
    float s = max( k*(w.x*q.y-w.y*q.x),k*(w.y-q.y)  );
    return sqrt(d)*sign(s);
}

float sdCappedCone( in vec3 p, in float h, in float r1, in float r2 )
{
    vec2 q = vec2( length(p.xz), p.y );

    vec2 k1 = vec2(r2,h);
    vec2 k2 = vec2(r2-r1,2.0*h);
    vec2 ca = vec2(q.x-min(q.x,(q.y < 0.0)?r1:r2), abs(q.y)-h);
    vec2 cb = q - k1 + k2*clamp( dot(k1-q,k2)/dot2(k2), 0.0, 1.0 );
    float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
    return s*sqrt( min(dot2(ca),dot2(cb)) );
}

float sdCappedCone(vec3 p, vec3 a, vec3 b, float ra, float rb)
{
    float rba  = rb-ra;
    float baba = dot(b-a,b-a);
    float papa = dot(p-a,p-a);
    float paba = dot(p-a,b-a)/baba;

    float x = sqrt( papa - paba*paba*baba );

    float cax = max(0.0,x-((paba<0.5)?ra:rb));
    float cay = abs(paba-0.5)-0.5;

    float k = rba*rba + baba;
    float f = clamp( (rba*(x-ra)+paba*baba)/k, 0.0, 1.0 );

    float cbx = x-ra - f*rba;
    float cby = paba - f;

    float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;

    return s*sqrt( min(cax*cax + cay*cay*baba,
    cbx*cbx + cby*cby*baba) );
}

// c is the sin/cos of the desired cone angle
float sdSolidAngle(vec3 pos, vec2 c, float ra)
{
    vec2 p = vec2( length(pos.xz), pos.y );
    float l = length(p) - ra;
    float m = length(p - c*clamp(dot(p,c),0.0,ra) );
    return max(l,m*sign(c.y*p.x-c.x*p.y));
}

float sdOctahedron(vec3 p, float s)
{
    p = abs(p);
    float m = p.x + p.y + p.z - s;

    // exact distance
    #if 0
    vec3 o = min(3.0*p - m, 0.0);
    o = max(6.0*p - m*2.0 - o*3.0 + (o.x+o.y+o.z), 0.0);
    return length(p - s*o/(o.x+o.y+o.z));
    #endif

    // exact distance
    #if 1
    vec3 q;
    if( 3.0*p.x < m ) q = p.xyz;
    else if( 3.0*p.y < m ) q = p.yzx;
    else if( 3.0*p.z < m ) q = p.zxy;
    else return m*0.57735027;
    float k = clamp(0.5*(q.z-q.y+s),0.0,s);
    return length(vec3(q.x,q.y-s+k,q.z-k));
    #endif

    // bound, not exact
    #if 0
    return m*0.57735027;
    #endif
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

// la,lb=semi axis, h=height, ra=corner
float sdRhombus(vec3 p, float la, float lb, float h, float ra)
{
    p = abs(p);
    vec2 b = vec2(la,lb);
    float f = clamp( (ndot(b,b-2.0*p.xz))/dot(b,b), -1.0, 1.0 );
    vec2 q = vec2(length(p.xz-0.5*b*vec2(1.0-f,1.0+f))*sign(p.x*b.y+p.z*b.x-b.x*b.y)-ra, p.y-h);
    return min(max(q.x,q.y),0.0) + length(max(q,0.0));
}

float sdHorseshoe( in vec3 p, in vec2 c, in float r, in float le, vec2 w )
{
    p.x = abs(p.x);
    float l = length(p.xy);
    p.xy = mat2(-c.x, c.y,
    c.y, c.x)*p.xy;
    p.xy = vec2((p.y>0.0 || p.x>0.0)?p.x:l*sign(-c.x),
    (p.x>0.0)?p.y:l );
    p.xy = vec2(p.x,abs(p.y-r))-vec2(le,0.0);

    vec2 q = vec2(length(max(p.xy,0.0)) + min(0.0,max(p.x,p.y)),p.z);
    vec2 d = abs(q) - w;
    return min(max(d.x,d.y),0.0) + length(max(d,0.0));
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

//-- Sinnvolle structs machen auf Dauer wirklich mehr Freude. Is echt so. ------

struct Ray {
    vec3 origin;
    vec3 dir;
};

struct Hit {
    float t;
    float material;
};

struct SurfaceHit {
    Ray ray;
    Hit hit;
    vec3 pos;
    vec3 normal;
};

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

Hit takeCloser( Hit d1, float d2, float material2)
{
    if (d1.t < d2) return d1;
    return Hit(d2, material2);
}

Hit map( in vec3 pos )
{
    Hit res = Hit(pos.y, FLOOR_MATERIAL);
    // Hier war ursprünglich 0.0 == UNKNOWN_MATERIAL initialisiert.
    // Wir kennen aber unsere Szene genug, so dass der Boden einfach default sein darf.

    res = takeCloser(res,
        sdTorus((pos-vec3( 1.0,0.30, 1.0)).xzy, vec2(0.25,0.05) ),
        7.1
    );
    res = takeCloser(res,
        sdBox(pos-vec3( 1.0,0.25, 0.0), vec3(0.3,0.25,0.3) ),
        3.0
    );
    res = takeCloser(res,
        sdSphere(pos-vec3( 0.25,0.2, 0.0), 0.25 ),
        26.9
    );
    res = takeCloser(res,
        sdSphere(pos-vec3( 1.0,0.2,-1.0), 0.25 ),
        GLASS_MATERIAL
    );

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

// Funktion umbenannt, sie hieß bisher raycast(), das fand ich aber nicht so gut.
Hit raymarch(in Ray ray)
{
    Hit res = Hit(-1.0, NOTHING_HIT);

    float tmin = 1.0;
    float tmax = 20.0;

    // trace floor plane analytically
    float tp1 = (0.0-ray.origin.y)/ray.dir.y;
    if( tp1>0.0 )
    {
        tmax = min( tmax, tp1 );
        res = Hit(tp1, FLOOR_MATERIAL);
    }

    // raymarch primitives
    vec2 tb = iBox( ray.origin-vec3(0.0,0.4,-0.5), ray.dir, vec3(2.5,0.41,3.0) );
    if( tb.x<tb.y && tb.y>0.0 && tb.x<tmax)
    {
        //return vec2(tb.x,2.0);
        tmin = max(tb.x,tmin);
        tmax = min(tb.y,tmax);

        float t = tmin;
        for( int i=0; i<70 && t<tmax; i++ )
        {
            ///////////// HIER: map() ///////////////
            Hit h = map( ray.origin + ray.dir * t );
            /////////////////////////&///////////////

            if(abs(h.t)<(0.0001*t) )
            {
                res = Hit(t, h.material);
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

vec3 materialPalette(Hit hit) {
    return 0.2 + 0.2*sin( hit.material*2.0 + vec3(0.0,1.0,2.0) );
}

#define MAX_BOUNCES 5

const float indexOfRefractionAir = 1.0;
const float indexOfRefractionGlass = 1.5;

vec3 render(in Ray ray)
{
    // background
    vec3 bgCol = vec3(0.0, 0., 0.0) - max(ray.dir.y,0.0)*0.3;

    Hit hit;
    vec3 col = c.yyy;
    vec3 throughput = c.xxx;
    // <-- throughput fängt mit 1 an und wird dann pro Interaktion sukzessive verringert
    //     (wie letztes Mal eben die Schatten auch, nur hier für jeden Farbkanal)

    for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
        // Erste Mission: Ersten Strahlabstand finden, d.h. wie gehabt:
        // Marching durch map() und bei minimaler SDF das Material merken.
        hit = raymarch(ray);

        if (hit.material == NOTHING_HIT) {
            col += throughput * bgCol;
            break;
        }

        vec3 baseColor = materialPalette(hit);
        // bool isFloor = hit.material < 1.5; // <-- ursprünglicher Check (zur Referenz)
        bool isFloor = hit.material == FLOOR_MATERIAL;
        float specularCoeff = 1.;
        vec3 shade = c.yyy;
        // <-- shade erfüllt für matte Materialien denselben Zweck wie oben throughput,
        //     nur ist es eben additiv, fängt bei 0 an und sammelt Beleuchtungsstärken zusammen

        vec3 rayPos = ray.origin + hit.t * ray.dir;
        vec3 normal = isFloor ? vec3(0., 1. , 0.) : calcNormal(rayPos);

        if (isFloor) {
            float f = 1. - abs(step(0.5, fract(1.5*rayPos.x)) - step(0.5, fract(1.5*rayPos.z)));
            col = 0.15 + f*vec3(0.05);
            specularCoeff = 0.4;
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
        } else {
            // Hier das alte Beleuchtungsmodell -- undurchlässiges, diffuses Material
            // grob modelliert nach Blinn-Phong (mit etwas Freiheit).
            // Wir können danach also die Schleife abbrechen, der Strahl ist am Ende.

            vec3  lightDirection = normalize(-vecDirectionalLight);
            // Vorzeichenkonvention: lightDirection in den Beleuchtungsmodellen ist ZUM Licht
            // (im Uniform vecDirectionalLight fand ich die andere Richtung aber geeigneter)

            // Ambient Occlusion - Maß für die Verdecktheit / Verwinkelung an einer Stelle
            float occ = calcAmbientOcclusion(rayPos, normal);

            {
                // 1. Effekt: Richtungslicht z.B. der Sonne bzw. einer weit entfernten Lichtquelle.
                //            (-> Alle Lichtstrahlen sind parallel.)
                //            In VL5 wurden auch Punktquellen demonstriert.

                // Halfway wird (z.B. Blinn-Phong) anstatt echtem Reflektionsvektor verwendet.
                // Ist etwas schneller berechnet und macht oft weicheres Licht / breitere Verläufe.
                // Sollte man aber durchaus mal direkt vergleichen.
                vec3  halfway = normalize(lightDirection - ray.dir);
                // Diffuser Teil: dot(normal, lightSource)
                float diffuse = clamp(dot(normal, lightDirection), 0.0, 1.0);
                diffuse *= calcSoftshadow(rayPos, lightDirection, 0.02, 2.5);
                float specular = pow(clamp(dot(normal, halfway), 0.0, 1.0), 20.0);
                const vec3 sourceCol = vec3(1.30, 1.00, 0.70);
                shade += col * 2.20 * sourceCol * diffuse;
                shade +=       3.00 * sourceCol * specular * specularCoeff;
            }

            {
                // 2. Effekt: Himmel - Auch Richtungslicht, direkt von oben aber anders gewichtet.
                //            (hatte ich bisher entfernt, könnt ihr aber mal versuchen zu interpretieren)
                float diffuse = sqrt(clamp(0.5+0.5*normal.y, 0.0, 1.0));
                // <-- hier steht quasi dot(normal, lightDirection) mit lightDirection == (0,1,0)
                // das sqrt() ist m.E. eine willkürliche Graduierung, aber der Effekt ist,
                // dass die Übergänge zwischen verschiedenen Winkeln sanfter ist.
                // (sqrt(x) entspricht pow(x, 0.5) und ist also auch eine Art Gammakorrektur)
                diffuse *= occ;
                vec3 refl = reflect(ray.dir, normal);
                float specular = smoothstep(-0.2, 0.2, refl.y);
                specular *= diffuse;
                specular *= 0.04+0.96*pow(clamp(1.0+dot(normal, ray.dir), 0.0, 1.0), 5.0);
                // <-- Nochmal eine modifizierte Form des Phong-Speculars (Glanzlichts).
                //     So ein pow(..., 5.) ist meist eine Fresnel-Korrektur, soll etwas
                //     realistischere Lichtbrechnung an der Grenzfläche beschreiben.
                //     (d.h. ein Stück näher an der Physik als das rein empirische Phong).
                //     Letztendlich probiert man aus, was im konkreten Fall am besten wirkt.

                //if( spe>0.001 )
                specular *= calcSoftshadow(rayPos, refl, 0.02, 2.5);
                shade += col*0.60*diffuse*vec3(0.40, 0.60, 1.15);
                shade +=     2.00*specular*vec3(0.40, 0.60, 1.30)*specularCoeff;
            }

            {
                // 3. Effekt:
                // "Backlight / Ambient Illumination", Idee ist dass in eher verdeckten Bereichen
                // zusätzliche Beiträge durch irgendwelche Spiegelungen am Boden (für unseren festen Fall y == 0)
                // die Schatten leicht aufweichen
                vec3 lightFloorReflection = normalize(vec3(-lightDirection.x, 0., -lightDirection.z));
                float backlightIllumination = occ
                * clamp(dot(normal, lightFloorReflection), 0.0, 1.0)
                * clamp(1.0 - rayPos.y, 0.0, 1.0);
                shade += col * iBacklightAmount * backlightIllumination * vec3(0.25, 0.25, 0.25);
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
                float subsurfaceScattering = occ * pow(clamp(1.0+dot(normal, ray.dir), 0.0, 1.0), 2.0);
                shade += col * iSubsurfaceAmount * subsurfaceScattering * c.xxx;
            }

            // Man könnte sich hier noch weitere Effekte bzw. Kombinationen ausdenken,
            // und die Werte sind jedesmal andere (es sind empirische Modelle);
            // man sollte aber diese Begriffe zuordnen können und was sie jeweils ausmacht.

            // in der Praxis:
            // im Wesentlichen ist es legitim, sich grob zu überlegen welche Vektoren
            // für das vorliegende Szenario wohl relevant sein könnten und dann
            // entsprechende Terme zu konstruieren wie oben.
            // Und wenn irgendwas sowohl optisch gut wirkt als auch die Formel plausibel ist
            // -> Glückwunsch :)

            col = shade;
            break;
        }
    }

    // Distanznebel ist quasi post-processing auf dem Tracing-Resultat,
    // kann also hier bleiben.
    const vec3 colFog = vec3(0.0, 0.0, 0.0);
    const float fogDensity = 0.0001;
    const float fogGrowth = 3.0;
    float fogOpacity = 1.0 - exp( -fogDensity * pow(hit.t, fogGrowth));
    col = mix(col, colFog, fogOpacity);

    // anderes Tone Mapping, Gamma, etc. könnten auch hier noch passieren.
    // könnte aber auch in der aufrufenden Funktion stehen. Unwichtig, wo genau.

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

void main()
{
    vec2 uv = (2.0 * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    vec2 mo = iMouse.zw / iResolution.y;
    float rot = 0.2;

    // camera
    vec3 cameraTarget = vec3( 0.5 + iFree0, -0.25 + iFree1, 1. + iFree2);
    vec3 rayOrigin = cameraTarget + vec3( 4.5 * cos(twoPi * rot), 1.2, 4.5 * sin(-twoPi * rot));
    // camera-to-world transformation
    mat3 ca = setCamera( rayOrigin, cameraTarget, 0.0 );
    // ray direction
    const float focalLength = 3.5;
    vec3 rayDirection = ca * normalize( vec3(uv, focalLength) );

    // render (s. neue "struct Ray" da oben - ist komfortabler)
    Ray ray = Ray(rayOrigin, rayDirection);
    vec3 col = render(ray);

    // gamma
    const float gamma = 2.2;
    col = pow( col, vec3(1./gamma) );

    fragColor = vec4(col, 1.0);
}
