#version 300 es
precision highp float;
out vec4 farbe;
uniform vec2 iResolution;
uniform float iTime;

// somewhat-common abbreviation for concise but uneasily readable code
vec4 c = vec4(1., 0., -1., 0.5);

// note: "in" is the default qualifier, so could be left out.
float circle_sdf(in vec2 uv) {
    float wrappedTime = mod(iTime, 2.);
    // uv.y = uv.y - 1.0 + 2.0 * wrappedTime;
    //uv.y += -1.;

    float d = length(0.5 * uv);
    d = length(0.5 * uv) - 0.4;
    // d = length(0.5 * uv) - mod(0.5 * iTime, 2.);

    // d = 1. - abs(d);

    return d;
}

// compare above: why return vec3 when we can return float?
// -> uses less memory bandwidth
// but remember: "out float" exists, too, but for float -> usually negligible
float pentagram_sdf(in vec2 uv) {
    // cf. sdStar5 from iq https://iquilezles.org/articles/distfunctions2d/
    float r = 0.7;
    float rf = 0.4; // 0.55 + .45 * sin(2. * iTime);

    // now THAT is something to think about :)
    const vec2 k1 = vec2(0.809016994375, -0.587785252292);
    const vec2 k2 = vec2(-k1.x,k1.y);
    uv.x = abs(uv.x);
    uv -= 2.0*max(dot(k1,uv),0.0)*k1;
    uv -= 2.0*max(dot(k2,uv),0.0)*k2;
    uv.x = abs(uv.x);
    uv.y -= r;
    vec2 ba = rf*vec2(-k1.y,k1.x) - vec2(0,1);
    float h = clamp( dot(uv,ba)/dot(ba,ba), 0.0, r );

    return length(uv - ba*h) * sign(uv.y * ba.x - uv.x * ba.y);
}

void apply_distance_structure(inout float d) {
    // "gamma correction" - nonlinear perception
    // d = pow(d, 3.);
    // use to give distance some scale
    d = 1. - 0.5 * abs(d);
    d = pow(d, 3. + 0.5 * cos(200. * d)); //  + 30. * iTime
}

void main() {
    // Normalize y to [-1.; +1.], and x to [-aspectRatio; +aspectRatio]
    vec2 uv = (2. * gl_FragCoord.xy - iResolution.xy) / iResolution.y;
    // <-- is the same as:
    //   vec2 uv = 2. * gl_FragCoord.xy/iResolution.xy - 1.;
    //   uv.x *= iResolution.x/iResolution.y;

    float d = circle_sdf(uv - vec2(.7, .25));
    apply_distance_structure(d);
    vec3 col = vec3(d);

    // reset
    col = c.xxx;

    d = pentagram_sdf(uv); // -vec2(0.5, 0.);
    apply_distance_structure(d);

    col *= vec3(d);

    farbe = vec4(col, 1.0);
}
