#version 300 es
precision highp float;

// this is the Hello-World-Shader of shadertoy,
// but translated for our WebGl2 use case.
//
// Note: the pipeline has to be adjusted for this!

out vec4 fragColor;

uniform vec2 iResolution;
uniform float iTime;
uniform float iWhatever;

vec4 c = vec4(1., 0., -1., .5);

vec3 hsl2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );

    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

vec3 HueShift (in vec3 Color, in float Shift)
{
    vec3 P = vec3(0.55735)*dot(vec3(0.55735),Color);

    vec3 U = Color-P;

    vec3 V = cross(vec3(0.55735),U);

    Color = U*cos(Shift*6.2832) + V*sin(Shift*6.2832) + P;

    return vec3(Color);
}

vec3 rgb2hsl( in vec3 c ){
    float h = 0.0;
    float s = 0.0;
    float l = 0.0;
    float r = c.r;
    float g = c.g;
    float b = c.b;
    float cMin = min( r, min( g, b ) );
    float cMax = max( r, max( g, b ) );

    l = ( cMax + cMin ) / 2.0;
    if ( cMax > cMin ) {
        float cDelta = cMax - cMin;

        //s = l < .05 ? cDelta / ( cMax + cMin ) : cDelta / ( 2.0 - ( cMax + cMin ) ); Original
        s = l < .0 ? cDelta / ( cMax + cMin ) : cDelta / ( 2.0 - ( cMax + cMin ) );

        if ( r == cMax ) {
            h = ( g - b ) / cDelta;
        } else if ( g == cMax ) {
            h = 2.0 + ( b - r ) / cDelta;
        } else {
            h = 4.0 + ( r - g ) / cDelta;
        }

        if ( h < 0.0) {
            h += 6.0;
        }
        h = h / 6.0;
    }
    return vec3( h, s, l );
}

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

float sdCircle( in vec2 p, in float r )
{
    return length(p)-r;
}

void main() {
    vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;

    // background
    vec3 bgCol = vec3(0.5 * abs(uv.x), 0.6 ,0.5 + uv.y);
    vec3 col = bgCol * iWhatever;

    // rings
    float d = sdCircle(uv - vec2(0., 0.), 0.3);
    d = 0.5 - 0.5*cos(20.*d);
    vec3 ringCol = d * (0.5 + 0.5*cos(iTime+uv.xyx+vec3(0, 2, 4)));

    // einfachste blending-methoden - aber bei RGB wird das halt Matsch
    float blendingFactor = 0.5;
    col = mix(bgCol, ringCol, blendingFactor);
    // col = max(bgCol, ringCol);
    // col = min(bgCol, ringCol);
    // col = bgCol * ringCol;

    // brighter / darker
    // col = 0.5 + 0.5 * col;
    // col = 0.5 * col;

    // contrast
    const float contrast = 2.;
    col = (col - 0.5) * contrast + 0.5;

    // gamma correction
    const float gamma = 1./2.2;
    col = pow(col, vec3(gamma));

    // grayscale
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    // col = vec3(gray);

    // Output to screen
    fragColor = vec4(col, 1.0);
}
